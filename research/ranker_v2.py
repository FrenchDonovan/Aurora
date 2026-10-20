"""Validation-selected LambdaRank; fresh test is a separate frozen-release action."""
import argparse
from collections import Counter,defaultdict
import hashlib
import json
from pathlib import Path
import random
import subprocess
import shutil
import time
from .features import canonical_json,corpus_hash,normalize_question
from .qasper_study import RAW_SHA,FILES,SOURCE,REVISION,norm
from .ranker_v2_features import RankIndex,NAMES,VERSION,normalize_scores,tree_score
from .evaluate import query_metrics

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/ranker-v2'
WEB=ROOT/'web/data/study-v2'
CACHE=ROOT/'work/ranker-v2'
PROTOCOL=ROOT/'research/RANKER_V2_PROTOCOL.md'


def digest(data):return hashlib.sha256(data).hexdigest()
def dump(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes((canonical_json(value)+'\n').encode('utf-8'))
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def raw_data(raw,part):
    path=raw/FILES[part]
    assert digest(path.read_bytes())==RAW_SHA[part]
    return read(path)


def convert(data,ids,part):
    corpus={'schema_version':1,'corpus_version':'qasper-aurora-ranker-v2','domain':'Known-paper QASPER NLP paragraph retrieval','papers':[],'passages':[],'challenges':[]}
    counts=Counter()
    for pid in ids:
        p=data[pid]
        corpus['papers'].append({'id':pid,'title':p['title'],'authors':[],'year':2000+int(pid[:2]),'year_kind':'arxiv_submission','url':'https://arxiv.org/abs/'+pid,'topics':[],'curator_note':'QASPER v0.3 extracted paragraphs. Authors omitted in dataset; see original arXiv record. Extraction markers are retained.','license':{'status':'verified','id':'CC-BY-4.0','scope':'QASPER dataset redistribution','url':SOURCE},'dataset_partition':part})
        seen=set()
        for section in p['full_text']:
            for paragraph in section['paragraphs']:
                text=paragraph.strip();normalized=norm(text)
                if not text or len(text)>12000:counts['empty_or_over_length']+=1;continue
                if normalized in seen:counts['within_paper_duplicate']+=1;continue
                seen.add(normalized)
                corpus['passages'].append({'id':pid+'-p'+str(len(seen)).zfill(4),'paper_id':pid,'text':text,'text_kind':'dataset_paragraph','section':section['section_name'] or 'Unspecified section','source_url':'https://arxiv.org/abs/'+pid,'dataset_url':SOURCE,'dataset_revision':REVISION,'text_sha256':digest(text.encode()),'curator_note':'Dataset extraction, not independently verified against the current PDF.'})
    return corpus,dict(counts)


def prepare(raw):
    original=read(ROOT/'data/qasper/manifest.json')
    train=raw_data(raw,'train');dev=raw_data(raw,'validation');test=raw_data(raw,'test')
    train_ids=sorted(train);dev_ids=sorted(dev)
    fresh=sorted(set(test)-set(original['selection']['test']),key=lambda pid:digest(('aurora-ranker-v2-test:'+pid).encode()))[:64]
    replay_dev=sorted(dev,key=lambda pid:digest(('aurora-ranker-v2-replay:'+pid).encode()))[:16]
    # Only IDs and paper text are accessed in the test partition here, no QA fields.
    tc,ta=convert(train,train_ids,'train');dc,da=convert(dev,dev_ids,'validation');fc,fa=convert(test,fresh,'test');rc,_=convert(dev,replay_dev,'validation')
    public={**fc,'papers':fc['papers']+rc['papers'],'passages':fc['passages']+rc['passages']}
    index=RankIndex(tc)
    dump(CACHE/'train-corpus.json',tc);dump(CACHE/'dev-corpus.json',dc)
    dump(WEB/'corpus.json',public);dump(WEB/'statistics.json',index.stats)
    overlap=defaultdict(set)
    for part,c in [('train',tc),('validation',dc),('test',fc)]:
        for p in c['passages']:overlap[digest(norm(p['text']).encode())].add(part)
    audit=[{'sha256':h,'partitions':sorted(parts)} for h,parts in sorted(overlap.items()) if len(parts)>1]
    manifest={'protocol_sha256':digest(PROTOCOL.read_bytes()),'source':SOURCE,'revision':REVISION,'raw_sha256':RAW_SHA,'selection':{'train':train_ids,'validation':dev_ids,'test':fresh,'public_validation_replay':replay_dev},'excluded_v1_test_papers':original['selection']['test'],'paragraph_exclusions':{'train':ta,'validation':da,'test':fa},'cross_partition_exact_text_overlap':audit,'training_corpus_sha256':corpus_hash(tc),'public_corpus_sha256':corpus_hash(public),'statistics_sha256':corpus_hash(index.stats),'paragraph_counts':{'train':len(tc['passages']),'validation':len(dc['passages']),'test':len(fc['passages']),'public':len(public['passages'])},'global_statistics':'Training text only; local BM25 uses the input paper text; no test labels inspected during prepare'}
    dump(OUT/'manifest.json',manifest)
    print(json.dumps({'selected_papers':{k:len(v) for k,v in manifest['selection'].items()},'paragraph_counts':manifest['paragraph_counts'],'text_overlap_hashes':len(audit),'protocol_sha256':manifest['protocol_sha256']}))


def queries(raw,corpus,part,ids,seen):
    data=raw_data(raw,part);docs=defaultdict(dict);audit=Counter();result=[]
    for p in corpus['passages']:docs[p['paper_id']][norm(p['text'])]=p['id']
    for pid in sorted(ids):
        for qa in sorted(data[pid]['qas'],key=lambda q:q['question_id']):
            audit['all_questions']+=1;q=qa['question'].strip();nq=normalize_question(q)
            if nq in seen:audit['duplicate_question_excluded']+=1;continue
            seen.add(nq)
            answers=[a['answer'] for a in qa['answers']];answerable=[a for a in answers if not a['unanswerable']];refs=set()
            for answer in answerable:
                for text in answer['evidence']:
                    match=docs[pid].get(norm(text));audit['mapped_evidence_entries' if match else 'unmapped_evidence_entries']+=1
                    if match:refs.add(match)
            if not answerable or not refs:audit['no_mapped_text_positive_excluded']+=1;continue
            audit['eligible_questions']+=1;audit['mixed_answerability']+=int(len(answerable)<len(answers))
            result.append({'query_id':qa['question_id'],'question':q,'paper_id':pid,'partition':part,'reference_ids':sorted(refs)})
    return result,dict(audit)


def matrices(index,queries):
    import numpy as np
    features=[];labels=[];metadata=[];sizes=[]
    for q in queries:
        rows=index.rows(q['question'],q['paper_id'])
        start=len(features)
        features.extend(r['features'] for r in rows);labels.extend(int(r['passage_id'] in q['reference_ids']) for r in rows);sizes.append(len(rows))
        metadata.append({**q,'start':start,'end':len(features),'row_ids':[r['passage_id'] for r in rows],'global_bm25':[r['global_bm25'] for r in rows],'local_bm25':[r['local_bm25'] for r in rows]})
    return np.array(features,dtype='<f8'),np.array(labels,dtype='<i4'),metadata,sizes


def score_metrics(q,ids):return query_metrics([{'passage_id':pid} for pid in ids],{pid:1 for pid in q['reference_ids']},5)
def order(ids,scores):return [ids[i] for i in sorted(range(len(ids)),key=lambda i:(-float(scores[i]),ids[i]))]
def macro(items,key='ndcg_at_k'):
    groups=defaultdict(list)
    for q,m in items:groups[q['paper_id']].append(m[key])
    return sum(sum(vals)/len(vals) for vals in groups.values())/len(groups) if groups else 0


def metrics_from_scores(meta,scores,baseline,alpha):
    result=[]
    for q in meta:
        learned=normalize_scores(list(map(float,scores[q['start']:q['end']])));bm=normalize_scores(q[baseline]);mix=[alpha*a+(1-alpha)*b for a,b in zip(learned,bm)]
        result.append((q,score_metrics(q,order(q['row_ids'],mix))))
    return result


def compact_tree(root):
    nodes=[]
    def visit(node):
        idx=len(nodes);nodes.append(None)
        if 'leaf_value' in node:nodes[idx]=node['leaf_value']
        else:
            assert node['decision_type']=='<=' and node.get('missing_type') in {'None','NaN','Zero'}
            # Features are all finite non-missing values; zero is never marked missing by our training params.
            assert node.get('missing_type')!='Zero'
            left=visit(node['left_child']);right=visit(node['right_child']);nodes[idx]=[node['split_feature'],node['threshold'],left,right]
        return idx
    visit(root);return nodes


def train(raw):
    import lightgbm as lgb
    import numpy as np
    manifest=read(OUT/'manifest.json');assert manifest['protocol_sha256']==digest(PROTOCOL.read_bytes())
    stats=read(WEB/'statistics.json');tc=read(CACHE/'train-corpus.json');dc=read(CACHE/'dev-corpus.json')
    seen=set();tq,ta=queries(raw,tc,'train',manifest['selection']['train'],seen);vq,va=queries(raw,dc,'validation',manifest['selection']['validation'],seen)
    start=time.perf_counter();tx,ty,tm,tg=matrices(RankIndex(tc,stats),tq);vx,vy,vm,vg=matrices(RankIndex(dc,stats),vq)
    dump(CACHE/'development-metadata.json',vm);dump(OUT/'seen-development-questions.json',sorted(seen))
    dump(OUT/'development-queries.json',tq+vq)
    np.savez(CACHE/'development-features.npz',features=vx,labels=vy)
    keep=[];groups=[];filtered=Counter()
    for q in tm:
        labels=ty[q['start']:q['end']]
        if not len(labels) or not np.any(labels):filtered['no_candidate_positive']+=1;continue
        if np.all(labels):filtered['no_candidate_negative']+=1;continue
        keep.extend(range(q['start'],q['end']));groups.append(len(labels))
    train_x=tx[keep];train_y=ty[keep]
    baseline_metrics={b:macro([(q,score_metrics(q,order(q['row_ids'],q[b]))) for q in vm]) for b in ['global_bm25','local_bm25']}
    baseline=max(['global_bm25','local_bm25'],key=lambda b:baseline_metrics[b])
    search=[];best=None;selected=None
    for leaves in [7,15,31]:
        for min_leaf in [30,100]:
            params={'objective':'lambdarank','metric':'None','learning_rate':.03,'num_leaves':leaves,'min_data_in_leaf':min_leaf,'lambda_l2':1,'max_bin':127,'label_gain':[0,1],'lambdarank_truncation_level':10,'seed':17,'deterministic':True,'force_col_wise':True,'num_threads':2,'verbosity':-1}
            booster=lgb.train(params,lgb.Dataset(train_x,label=train_y,group=groups,feature_name=NAMES),num_boost_round=600)
            for rounds in [100,300,600]:
                scores=booster.predict(vx,num_iteration=rounds,num_threads=2)
                for alpha in [0,.25,.5,.75,1]:
                    result=macro(metrics_from_scores(vm,scores,baseline,alpha))
                    record={'num_leaves':leaves,'min_data_in_leaf':min_leaf,'rounds':rounds,'learned_fraction':alpha,'validation_paper_macro_ndcg_at_5':result}
                    search.append(record)
                    key=(result,-rounds,-leaves,min_leaf,-alpha)
                    if best is None or key>best:
                        best=key;selected=(record,booster.model_to_string(num_iteration=rounds),params)
            print(json.dumps({'leaves':leaves,'min_leaf':min_leaf,'best_validation_so_far':best[0]}),flush=True)
    config,native,params=selected;booster=lgb.Booster(model_str=native)
    trees=[compact_tree(t['tree_structure']) for t in booster.dump_model()['tree_info']]
    # Direct LightGBM vs exported-tree check on development, before final freeze.
    expected=booster.predict(vx,num_threads=2)
    actual=np.array([tree_score(trees,row) for row in vx])
    error=float(np.max(np.abs(expected-actual)))
    assert error<1e-10, f'Native/export mismatch {error}'
    training_hash=digest(train_x.astype('<f8').tobytes()+train_y.astype('<i4').tobytes())
    source_files=['research/ranker_v2.py','research/ranker_v2_features.py','research/features.py','research/evaluate.py','research/qasper_study.py','research/requirements-ranker.txt']
    source_hashes={p:digest((ROOT/p).read_bytes().replace(b'\r\n',b'\n')) for p in source_files}
    artifact={'schema_version':2,'algorithm':'lightgbm_lambdarank_v2','feature_version':VERSION,'feature_names':NAMES,'trees':trees,'blend':{'learned_fraction':config['learned_fraction'],'baseline':baseline,'normalization':'within-paper minmax before exclusions'},'corpus_sha256':manifest['public_corpus_sha256'],'statistics_sha256':manifest['statistics_sha256'],'training_provenance':{'source':SOURCE,'dataset_revision':REVISION,'training_data_sha256':training_hash,'training_pairs':len(keep),'training_queries':len(groups),'eligible_training_queries':len(tq),'validation_queries':len(vq),'train_audit':ta,'validation_audit':va,'training_group_exclusions':dict(filtered),'train_papers':len(manifest['selection']['train']),'validation_papers':len(manifest['selection']['validation']),'human_annotation_scope':'QASPER selected-reference union; nonselected paragraphs assumed negative, not individually human-reviewed negatives','statistics_scope':'training text only','source_hashes':source_hashes},'selected_configuration':config,'training_parameters':params,'feature_importance_gain':booster.feature_importance(importance_type='gain').tolist(),'pilot':True,'synthetic':False,'lightgbm_version':lgb.__version__}
    artifact['model_id']='aurora-lambdarank-v2-'+corpus_hash(artifact)[:16]
    dump(WEB/'model.json',artifact)
    (OUT/'selected-model.txt').write_bytes(native.encode('utf-8'))
    dump(OUT/'validation-search.json',{'baseline_validation_ndcg':baseline_metrics,'primary_baseline':baseline,'candidates':search,'selected':config,'native_export_max_absolute_score_error':error})
    freeze={'protocol_sha256':manifest['protocol_sha256'],'model_sha256':corpus_hash(artifact),'statistics_sha256':manifest['statistics_sha256'],'manifest_sha256':corpus_hash(manifest),'training_data_sha256':training_hash,'source_hashes':source_hashes,'test_labels_opened':False,'selected_configuration':config,'primary_baseline':baseline,'validation_baseline_ndcg':baseline_metrics,'validation_selected_ndcg':config['validation_paper_macro_ndcg_at_5'],'validation_candidate_count':len(search),'training_seconds_descriptive':time.perf_counter()-start}
    dump(OUT/'freeze.json',freeze)
    print(json.dumps(freeze),flush=True)


def summarize(predictions,baseline):
    methods=['global_bm25','local_bm25','coverage','v1_logistic','learned'];names=['ndcg_at_k','mrr_at_k','recall_at_k','candidate_recall']
    eligible={p['paper_id'] for p in predictions}
    aggregate={m:{name:macro([(p,p['metrics'][m]) for p in predictions],name) for name in names} for m in methods}
    families=sorted(eligible);rng=random.Random(17);intervals={}
    for metric in ['ndcg_at_k','recall_at_k','mrr_at_k']:
        delta={f:sum(p['metrics']['learned'][metric]-p['metrics'][baseline][metric] for p in predictions if p['paper_id']==f)/sum(p['paper_id']==f for p in predictions) for f in families}
        samples=sorted(sum(delta[rng.choice(families)] for _ in families)/len(families) for _ in range(2000))
        intervals[metric]={'mean':sum(delta.values())/len(delta),'low':samples[49],'high':samples[1949],'resamples':2000,'unit':'paper'}
    qdelta=[p['metrics']['learned']['ndcg_at_k']-p['metrics'][baseline]['ndcg_at_k'] for p in predictions]
    pdelta=[sum(p['metrics']['learned']['ndcg_at_k']-p['metrics'][baseline]['ndcg_at_k'] for p in predictions if p['paper_id']==f)/sum(p['paper_id']==f for p in predictions) for f in families]
    counts=lambda values:{'wins':sum(d>1e-12 for d in values),'ties':sum(abs(d)<=1e-12 for d in values),'losses':sum(d<-1e-12 for d in values)}
    return {'eligible_queries':len(predictions),'eligible_papers':len(eligible),'paper_macro_metrics':aggregate,'primary_baseline':baseline,'paired_learned_minus_bm25_95pct_bootstrap':intervals,'ndcg_question_outcomes':counts(qdelta),'ndcg_paper_outcomes':counts(pdelta)}


def test(raw,freeze_commit,freeze_repository=None,reproduce=False):
    import re
    assert re.fullmatch('[0-9a-f]{40}',freeze_commit or ''),'Supply the pushed immutable pre-test commit'
    freeze=read(OUT/'freeze.json');manifest=read(OUT/'manifest.json');model=read(WEB/'model.json');stats=read(WEB/'statistics.json')
    assert freeze['test_labels_opened'] is False and freeze['model_sha256']==corpus_hash(model)
    assert freeze['protocol_sha256']==digest(PROTOCOL.read_bytes()) and freeze['statistics_sha256']==corpus_hash(stats)
    for p,h in freeze['source_hashes'].items():assert digest((ROOT/p).read_bytes().replace(b'\r\n',b'\n'))==h,'Source changed after model freeze: '+p
    assert reproduce or not (OUT/'test-opened.json').exists(),'Test already opened; use --reproduce for a separate verification output'
    # Verify the pre-test model and protocol are the exact committed objects.
    git=shutil.which('git') or r'C:\Program Files\Git\cmd\git.exe'
    repo=freeze_repository or ROOT
    for file in ['data/ranker-v2/freeze.json','web/data/study-v2/model.json','research/RANKER_V2_PROTOCOL.md']:
        content=subprocess.check_output([git,'-C',str(repo),'show',freeze_commit+':'+file])
        assert content.replace(b'\r\n',b'\n')==(ROOT/file).read_bytes().replace(b'\r\n',b'\n')
    if not reproduce:dump(OUT/'test-opened.json',{'pretest_commit':freeze_commit,'model_sha256':freeze['model_sha256'],'note':'Final test annotations opened after immutable commit; not a new model-selection stage'})
    corpus=read(WEB/'corpus.json');seen=set(read(OUT/'seen-development-questions.json'))
    tq,audit=queries(raw,corpus,'test',manifest['selection']['test'],seen)
    index=RankIndex(corpus,stats);predictions=[];old=read(ROOT/'web/data/study/model.json');baseline=model['blend']['baseline'];alpha=model['blend']['learned_fraction']
    for q in tq:
        rows=index.rows(q['question'],q['paper_id']);ids=[r['passage_id'] for r in rows]
        native_scores=[tree_score(model['trees'],r['features']) for r in rows]
        ln=normalize_scores(native_scores);bn=normalize_scores([r[baseline] for r in rows]);learned=[alpha*a+(1-alpha)*b for a,b in zip(ln,bn)]
        score_map={'global_bm25':[r['global_bm25'] for r in rows],'local_bm25':[r['local_bm25'] for r in rows],'coverage':[r['features'][1] for r in rows],'v1_logistic':[old['bias']+sum(a*b for a,b in zip(old['weights'],r['features'][:8])) for r in rows],'learned':learned}
        rankings={m:order(ids,scores) for m,scores in score_map.items()}
        metrics={m:score_metrics(q,ranked) for m,ranked in rankings.items()}
        refs=set(q['reference_ids']);nonrefs=sorted(p['id'] for p in corpus['passages'] if p['paper_id']==q['paper_id'] and p['id'] not in refs)
        rng=random.Random(int(digest((q['query_id']+':control').encode()),16));control=set(rng.sample(nonrefs,min(len(refs),len(nonrefs))))
        top=set(rankings['learned'][:5]);removal={}
        for name,excluded in [('reference_removal',refs),('matched_control',control)]:
            remaining=[pid for pid in rankings['learned'] if pid not in excluded][:5]
            removal[name]={'removed_ids':sorted(excluded),'ranking':remaining,'top5_retention':len(top&set(remaining))/len(top) if top else 1,'original_reference_recall':len(refs&set(remaining))/len(refs)}
        values={m:dict(zip(ids,scores)) for m,scores in score_map.items()}
        predictions.append({**q,'metrics':metrics,'rankings':{m:[{'passage_id':pid,'score':values[m][pid]} for pid in ranked[:8]] for m,ranked in rankings.items()},'removal':removal})
    summary=summarize(predictions,baseline)
    report={'schema_version':2,'status':'pilot','task':'Fresh-paper QASPER known-paper paragraph retrieval; training-only global IDF; k=5','pretest_commit':freeze_commit,'freeze':freeze,'manifest':manifest,'test_audit':audit,'test':summary,'predictions_sha256':corpus_hash(predictions),'model_selection':'90 validation candidates, selected before fresh test; no test tuning','limitations':['Public QASPER partial human references; unselected paragraphs are assumed negatives.','Test paper IDs excluded from v1; no claim of semantic/topic/paraphrase independence.','Training-only global statistics, but input-paper text supplies local features at inference.','Small deterministic held-out subset, not official QASPER answer F1 or semantic correctness.','Test is now released; future tuning needs fresh untouched data.','Historical v1 and RL results remain separate; no new RL improvement is established.']}
    destination=CACHE/'reproduction' if reproduce else WEB
    dump(destination/'predictions.json',predictions);dump(destination/'report.json',report)
    if reproduce:assert corpus_hash(predictions)==read(WEB/'report.json')['predictions_sha256'],'Reproduced predictions differ from the released run'
    print(json.dumps({'test':summary,'audit':audit}),flush=True)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['prepare','train','test']);p.add_argument('--raw',type=Path,required=True);p.add_argument('--freeze-commit');p.add_argument('--freeze-repository',type=Path);p.add_argument('--reproduce',action='store_true');a=p.parse_args()
    if a.action=='test':test(a.raw,a.freeze_commit or (read(WEB/'report.json')['pretest_commit'] if a.reproduce else None),a.freeze_repository,a.reproduce)
    else:globals()[a.action](a.raw)
if __name__=='__main__':main()
