"""Frozen CPU evidence-selection pilot. Run prepare, train, then test in that order."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import random
import time
from .features import CorpusIndex, canonical_json, corpus_hash, normalize_question
from .train_ranker import fit
from .evaluate import query_metrics

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'qasper'
WEB = ROOT / 'web' / 'data' / 'study'
PROTOCOL_SHA = 'eb4ecffe4d0038889bb3004ea674934c569b0372135242c33099ece54915967e'
SOURCE = 'https://huggingface.co/datasets/allenai/qasper'
REVISION = 'fdc9d8214fbab5dd782958601db4d678e6934a54'
N = {'train': 64, 'validation': 16, 'test': 32}
FILES = {'train': 'qasper-train-v0.3.json', 'validation': 'qasper-dev-v0.3.json', 'test': 'qasper-test-v0.3.json'}
RAW_SHA = {'train': '9458bfe76074a8fa8d1685af02bcc73537aa6d338ad20591dfaff1946bc88bf4', 'validation': '2ae7ee62a65b1c4225791c70de80c2aad4e8998cf1fd4f09a53103db4f21af93', 'test': '6e29ad410e6e39aa1936017fb965b30a20eb2e7751997f55b97c9d281aa884e5'}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(canonical_json(value) + '\n', encoding='utf-8')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def norm(text):
    return ' '.join(text.split())


def raw_data(raw, partition):
    path = raw / FILES[partition]
    assert digest(path.read_bytes()) == RAW_SHA[partition], 'Original dataset checksum mismatch'
    return read(path)


def prepare(raw):
    corpus = {'schema_version': 1, 'corpus_version': 'qasper-v0.3-aurora-pilot-v1', 'domain': 'Known-paper NLP evidence paragraph selection; QASPER extracts, not verified original-paper transcription', 'papers': [], 'passages': [], 'challenges': []}
    manifest = {'protocol_sha256': PROTOCOL_SHA, 'source': SOURCE, 'revision': REVISION, 'raw_sha256': RAW_SHA, 'selection': {}, 'paragraph_exclusions': {}, 'dataset_license': 'CC-BY-4.0', 'license_scope': 'QASPER distributed dataset; original paper rights separate', 'fixed_idf': 'All selected unlabeled text; transductive fixed collection'}
    text_partitions = defaultdict(set)
    for partition, count in N.items():
        data = raw_data(raw, partition)
        selected = sorted(data, key=lambda pid: digest(('aurora-qasper-v1:' + pid).encode()))[:count]
        manifest['selection'][partition] = selected
        exclusions = Counter()
        for pid in selected:
            paper = data[pid]
            corpus['papers'].append({'id': pid, 'title': paper['title'], 'authors': [], 'year': 2000 + int(pid[:2]), 'year_kind': 'arxiv_submission', 'url': 'https://arxiv.org/abs/' + pid, 'topics': [], 'curator_note': 'QASPER v0.3 extracted full-text paragraphs. Bibliographic authors omitted in dataset; follow original paper. BIBREF and extraction artifacts are preserved.', 'license': {'status': 'verified', 'id': 'CC-BY-4.0', 'scope': 'QASPER dataset redistribution', 'url': SOURCE}, 'dataset_partition': partition})
            seen = set()
            for section in paper['full_text']:
                for paragraph in section['paragraphs']:
                    text = paragraph.strip()
                    if not text or len(text) > 12000:
                        exclusions['empty_or_over_12000_characters'] += 1
                        continue
                    normalized = norm(text)
                    if normalized in seen:
                        exclusions['duplicate_within_paper'] += 1
                        continue
                    seen.add(normalized)
                    text_partitions[digest(normalized.encode())].add(partition)
                    corpus['passages'].append({'id': pid + '-p' + str(len(seen)).zfill(4), 'paper_id': pid, 'text': text, 'text_kind': 'dataset_paragraph', 'section': section['section_name'] or 'Unspecified section', 'source_url': 'https://arxiv.org/abs/' + pid, 'dataset_url': SOURCE, 'dataset_revision': REVISION, 'text_sha256': digest(text.encode()), 'curator_note': 'Dataset-extracted paragraph; not independently checked against the current paper PDF.'})
        manifest['paragraph_exclusions'][partition] = dict(exclusions)
    manifest['cross_partition_exact_text_hashes'] = sorted(k for k, parts in text_partitions.items() if len(parts) > 1)
    manifest['corpus_sha256'] = corpus_hash(corpus)
    manifest['papers'] = len(corpus['papers'])
    manifest['paragraphs'] = len(corpus['passages'])
    dump(OUT / 'manifest.json', manifest)
    dump(WEB / 'corpus.json', corpus)
    print(json.dumps({'prepared': manifest['papers'], 'paragraphs': manifest['paragraphs'], 'cross_partition_exact_text_duplicates': len(manifest['cross_partition_exact_text_hashes']), 'corpus_sha256': manifest['corpus_sha256']}))


def judgments(raw, partitions, seen_questions):
    corpus = read(WEB / 'corpus.json')
    manifest = read(OUT / 'manifest.json')
    docs = defaultdict(list)
    for passage in corpus['passages']:
        docs[passage['paper_id']].append(passage)
    queries, rows, audit = [], [], Counter()
    for partition in partitions:
        data = raw_data(raw, partition)
        for pid in sorted(manifest['selection'][partition]):
            by_text = {norm(p['text']): p['id'] for p in docs[pid]}
            for qa in sorted(data[pid]['qas'], key=lambda q: q['question_id']):
                audit[partition + '_all_questions'] += 1
                q = qa['question'].strip()
                nq = normalize_question(q)
                if nq in seen_questions:
                    audit[partition + '_duplicate_question_excluded'] += 1
                    continue
                seen_questions.add(nq)
                answers = [a['answer'] for a in qa['answers']]
                answerable = [a for a in answers if not a['unanswerable']]
                refs = set()
                for a in answerable:
                    for evidence in a['evidence']:
                        match = by_text.get(norm(evidence))
                        audit[partition + ('_mapped_evidence_entries' if match else '_unmapped_evidence_entries')] += 1
                        if match:
                            refs.add(match)
                if not answerable or not refs:
                    audit[partition + '_no_mapped_text_positive_excluded'] += 1
                    continue
                audit[partition + '_eligible_questions'] += 1
                audit[partition + '_mixed_answerability'] += int(len(answerable) < len(answers))
                item = {'query_id': qa['question_id'], 'question': q, 'paper_id': pid, 'partition': partition, 'reference_ids': sorted(refs)}
                queries.append(item)
                for p in docs[pid]:
                    rows.append({'query_id': item['query_id'], 'question': q, 'question_family': pid, 'passage_id': p['id'], 'split': partition, 'relevance': int(p['id'] in refs), 'synthetic': False, 'reviewed': True, 'annotator': 'Original QASPER human respondents; not newly reviewed by Aurora', 'label_provenance': 'QASPER v0.3 human-selected evidence union; unselected paragraphs assumed negative; CC-BY-4.0; ' + SOURCE})
    return queries, rows, dict(audit)


def train(raw):
    seen = set()
    queries, rows, audit = judgments(raw, ['train', 'validation'], seen)
    dump(OUT / 'train-validation-queries.json', queries)
    dump(OUT / 'seen-questions.json', sorted(seen))
    serialized = ''.join(canonical_json(r) + '\n' for r in rows)
    (OUT / 'train-validation-judgments.jsonl').write_bytes(serialized.encode('utf-8'))
    start = time.perf_counter()
    model = fit(CorpusIndex(read(WEB / 'corpus.json')), rows, digest(serialized.encode()))
    dump(WEB / 'model.json', model)
    freeze = {'protocol_sha256': PROTOCOL_SHA, 'model_sha256': corpus_hash(model), 'training_data_sha256': digest(serialized.encode()), 'training_seconds_descriptive': time.perf_counter() - start, 'training_audit': audit, 'test_labels_opened': False, 'model_selection': 'None; fixed hyperparameters, validation descriptive only'}
    dump(OUT / 'model-freeze.json', freeze)
    print(json.dumps(freeze))


def rankings(index, question, pid, model):
    # Shared candidates and frozen features; scope before sorting.
    pool = index.rank(question, model, paper_id=pid)
    return {
        'learned': pool,
        'bm25': sorted(pool, key=lambda r: (-r['lexical_score'], r['passage_id'])),
        'coverage': sorted(pool, key=lambda r: (-r['features'][1], r['passage_id']))}


def summarize(predictions):
    family = defaultdict(list)
    for item in predictions:
        family[item['paper_id']].append(item)
    names = ['ndcg_at_k', 'mrr_at_k', 'recall_at_k', 'candidate_recall']
    means = {method: {name: sum(sum(p['metrics'][method][name] for p in members) / len(members) for members in family.values()) / len(family) for name in names} for method in ['bm25', 'coverage', 'learned']}
    rng = random.Random(17)
    families = sorted(family)
    intervals = {}
    for name in ['ndcg_at_k', 'recall_at_k']:
        deltas = [sum(p['metrics']['learned'][name] - p['metrics']['bm25'][name] for p in family[f]) / len(family[f]) for f in families]
        samples = sorted(sum(rng.choice(deltas) for _ in deltas) / len(deltas) for _ in range(1000))
        intervals[name] = {'mean': sum(deltas) / len(deltas), 'low': samples[24], 'high': samples[974], 'unit': 'paper', 'resamples': 1000}
    return {'eligible_queries': len(predictions), 'eligible_papers': len(family), 'paper_macro_metrics': means, 'paired_learned_minus_bm25_95pct_bootstrap': intervals}


def test(raw):
    freeze = read(OUT / 'model-freeze.json')
    model = read(WEB / 'model.json')
    assert freeze['model_sha256'] == corpus_hash(model)
    assert freeze['test_labels_opened'] is False
    test_queries, _, audit = judgments(raw, ['test'], set(read(OUT / 'seen-questions.json')))
    corpus = read(WEB / 'corpus.json')
    index = CorpusIndex(corpus)
    predictions = []
    start = time.perf_counter()
    for item in test_queries + [q for q in read(OUT / 'train-validation-queries.json') if q['partition'] == 'validation']:
        rs = rankings(index, item['question'], item['paper_id'], model)
        gold = {pid: 1 for pid in item['reference_ids']}
        metrics = {method: query_metrics(ranking, gold, 5) for method, ranking in rs.items()}
        refs = set(gold)
        nonrefs = sorted(p['id'] for p in corpus['passages'] if p['paper_id'] == item['paper_id'] and p['id'] not in refs)
        rng = random.Random(int(digest((item['query_id'] + ':control').encode()), 16))
        controls = set(rng.sample(nonrefs, min(len(refs), len(nonrefs))))
        ranked = rs['learned']
        top = {r['passage_id'] for r in ranked[:5]}
        interventions = {}
        for name, removed in [('reference_removal', refs), ('matched_control', controls)]:
            remainder = [r for r in ranked if r['passage_id'] not in removed]
            ids = [r['passage_id'] for r in remainder[:5]]
            interventions[name] = {'removed_ids': sorted(removed), 'ranking': ids, 'top5_retention': len(top & set(ids)) / len(top) if top else 1, 'original_reference_recall': len(refs & set(ids)) / len(refs)}
        predictions.append({**item, 'metrics': metrics, 'rankings': {m: [{'passage_id': r['passage_id'], 'score': r['score'] if m == 'learned' else r['lexical_score'] if m == 'bm25' else r['features'][1]} for r in ranking[:8]] for m, ranking in rs.items()}, 'removal': interventions})
    heldout = [p for p in predictions if p['partition'] == 'test']
    validation = [p for p in predictions if p['partition'] == 'validation']
    manifest = read(OUT / 'manifest.json')
    report = {'schema_version': 1, 'status': 'pilot', 'task': 'Known-paper paragraph retrieval on a deterministic QASPER subset; k=5', 'freeze': freeze, 'manifest': manifest, 'test_audit': audit, 'test': summarize(heldout), 'validation': summarize(validation), 'evaluation_seconds_descriptive': time.perf_counter() - start, 'limitations': ['Small deterministic subset, paper-disjoint labels but transductive unlabeled IDF.', 'Human benchmark annotations are reused, not new Aurora adjudication; nonselected paragraphs are assumed negatives.', 'No official QASPER answer F1, generative QA, semantic verification or novelty claim.', 'Test references now public: future model changes require a new untouched set for confirmatory testing.', 'This study does not validate the separate eight-excerpt demonstration.'], 'predictions_sha256': corpus_hash(predictions)}
    dump(WEB / 'report.json', report)
    dump(WEB / 'predictions.json', predictions)
    dump(OUT / 'test-release.json', {'model_sha256': corpus_hash(model), 'predictions_sha256': corpus_hash(predictions), 'protocol_sha256': PROTOCOL_SHA, 'note': 'First release, no hyperparameter selection from test results'})
    print(json.dumps({'test': report['test'], 'validation': report['validation'], 'audit': audit}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'train', 'test'])
    parser.add_argument('--raw', type=Path, required=True)
    args = parser.parse_args()
    assert digest((ROOT / 'research' / 'QASPER_PROTOCOL.md').read_bytes()) == PROTOCOL_SHA, 'Protocol changed after freeze'
    globals()[args.action](args.raw)


if __name__ == '__main__':
    main()
