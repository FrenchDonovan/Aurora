import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createEngine, compareResults, tokenize, sha256, corpusHash, featureVector, FEATURE_NAMES } from '../web/lib/engine.js';

const corpus = JSON.parse(readFileSync(new URL('./fixtures/synthetic-corpus.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(corpus);
const engine = createEngine(corpus);
const stable = result => { const copy = structuredClone(result); delete copy.diagnostics.elapsed_ms; return copy; };

test('real new-query path retrieves exact snippets with citation identity and deterministic tied ordering', () => {
  const result = engine.ask({ question: 'What happens to accuracy degradation with 4 bit weights?' });
  assert.equal(result.status, 'evidence_found');
  assert.deepEqual(result.evidence.slice(0, 2).map(item => item.passage_id), ['synthetic-p-a', 'synthetic-p-c']);
  assert.deepEqual(stable(result), stable(engine.ask({ question: result.question })));
  for (const claim of result.claims) {
    const source = result.evidence.find(item => item.passage_id === claim.passage_ids[0]);
    assert.equal(claim.text, source.text); assert.ok(result.brief.includes(source.text));
    assert.equal(source.text_sha256, createHash('sha256').update(source.text).digest('hex'));
    assert.equal(source.curated_relation, null);
  }
  assert.equal(result.model_id, null);
});

test('exclusions precede top-k and brief generation and remain explicit in exported receipt', () => {
  const original = engine.ask({ question: '4 bit weights accuracy degradation', top_k: 1 });
  const stressed = engine.ask({ question: original.question, top_k: 1, excluded_paper_ids: ['synthetic-alpha'] });
  assert.deepEqual(stressed.excluded_paper_ids, ['synthetic-alpha']);
  assert.equal(stressed.evidence[0].passage_id, 'synthetic-p-c');
  assert.ok(!stressed.brief.includes('[synthetic-p-a]'));
  assert.ok(stressed.claims.every(claim => !claim.passage_ids.includes('synthetic-p-a')));
  assert.ok(stressed.evidence.every(item => item.paper_id !== 'synthetic-alpha'));
  const receipt = JSON.parse(JSON.stringify(stressed));
  assert.equal(receipt.corpus_sha256.length, 64); assert.equal(receipt.diagnostics.top_k, 1);
  assert.equal(receipt.feature_version, 'aurora-lexical-v1');
  const comparison = compareResults(original, stressed);
  assert.deepEqual(comparison.removed_paper_ids, ['synthetic-alpha']);
  assert.deepEqual(comparison.added_passage_ids, ['synthetic-p-c']);
  assert.equal(comparison.passage_jaccard, 0);
});

test('all exclusions remove all evidence, exact claims and source text', () => {
  const result = engine.ask({ question: 'attention memory', excluded_paper_ids: corpus.papers.map(paper => paper.id) });
  assert.equal(result.status, 'insufficient_evidence');
  assert.deepEqual(result.evidence, []); assert.deepEqual(result.claims, []);
  assert.equal(result.diagnostics.allowed_passage_count, 0);
  assert.ok(!result.brief.includes('tiling'));
});

test('unchanged normalized challenge and explicit ID are required for every curated relation', () => {
  const exact = engine.ask({ question: '  CAN quantization   preserve accuracy? ', challenge_id: 'synthetic-case' });
  assert.equal(exact.challenge_id, 'synthetic-case');
  assert.equal(exact.evidence.find(item => item.passage_id === 'synthetic-p-a').curated_relation.relation, 'challenges');
  assert.equal(exact.evidence.find(item => item.passage_id === 'synthetic-p-a').curated_relation.review.independent_human_review, false);
  const edited = engine.ask({ question: 'Can quantization always preserve accuracy?', challenge_id: 'synthetic-case' });
  assert.equal(edited.challenge_id, null); assert.ok(edited.evidence.every(item => item.curated_relation === null));
  const unbound = engine.ask({ question: corpus.challenges[0].question });
  assert.ok(unbound.evidence.every(item => item.curated_relation === null));
  const excluded = engine.ask({ question: corpus.challenges[0].question, challenge_id: 'synthetic-case', excluded_paper_ids: ['synthetic-alpha'] });
  assert.ok(excluded.evidence.every(item => item.curated_relation === null));
});

test('lexical gate uses title context plus exact text, refuses title-only matches and never searches notes', () => {
  assert.equal(engine.ask({ question: 'Can quantization preserve accuracy?' }).status, 'evidence_found');
  const titleOnly = engine.ask({ question: 'quantization experiments' });
  assert.equal(titleOnly.status, 'insufficient_evidence'); assert.deepEqual(titleOnly.claims, []);
  assert.ok(titleOnly.evidence.length > 0, 'Relevant title remains inspectable without becoming a brief');
  assert.equal(engine.ask({ question: 'aardvark' }).evidence.length, 0);
  assert.equal(engine.ask({ question: 'volcano dinosaur geology' }).status, 'insufficient_evidence');
  assert.equal(engine.ask({ question: 'the and is' }).evidence.length, 0);
});

test('empty corpus is safe and empty/empty Jaccard is one', () => {
  const empty = createEngine({ schema_version: 1, corpus_version: 'empty-fixture', domain: 'Synthetic fixture', papers: [], passages: [], challenges: [] });
  const result = empty.ask({ question: 'memory' });
  assert.equal(result.status, 'insufficient_evidence'); assert.equal(result.diagnostics.candidate_count, 0);
  assert.equal(compareResults(result, result).passage_jaccard, 1);
});

test('false-specificity queries yield relevant excerpts, never an invented answer to the requested detail', () => {
  const result = engine.ask({ question: 'What is memory efficient attention accuracy?' });
  assert.equal(result.status, 'evidence_found');
  assert.ok(result.evidence.some(item => item.passage_id === 'synthetic-p-b'));
  assert.ok(result.claims.every(item => item.text === corpus.passages.find(passage => passage.id === item.passage_ids[0]).text));
  assert.ok(!result.brief.toLowerCase().includes('accuracy'));
  assert.ok(result.limitations.some(item => item.includes('does not mean the question was answered')));
});

test('unavailable learned methods, invalid inputs and unknown IDs reject clearly', () => {
  assert.equal(engine.available_methods.find(method => method.id === 'learned').available, false);
  for (const input of [{question:''},{question:' '.repeat(5)},{question:'x'.repeat(1201)},{question:'memory',method:'magic'},{question:'memory',method:'learned'},{question:'memory',excluded_paper_ids:['unknown']},{question:'memory',excluded_paper_ids:'bad'},{question:'memory',top_k:0},{question:'memory',top_k:1.5},{question:'memory',challenge_id:'unknown'}]) assert.throws(() => engine.ask(input));
});

test('bad schema, dangling references, malformed quotes and duplicate IDs reject', () => {
  const mutations = [c => c.schema_version=2, c => c.papers.push(c.papers[0]), c => c.passages.push(c.passages[0]), c => c.passages[0].paper_id='unknown', c => c.passages[0].text_kind='curator_paraphrase', c => c.passages[0].text='', c => c.passages[0].text_sha256='invalid', c => c.papers[0].url='javascript:alert(1)', c => c.challenges[0].relations[0].passage_id='unknown'];
  for (const mutate of mutations) { const invalid = fresh(); mutate(invalid); assert.throws(() => createEngine(invalid)); }
});

test('caller mutation cannot silently change corpus or trained coefficients', () => {
  const mutable = fresh(); const isolated = createEngine(mutable);
  const before = stable(isolated.ask({ question: '4 bit weights accuracy' }));
  mutable.passages[0].text='tampered'; mutable.papers[0].title='tampered';
  assert.deepEqual(stable(isolated.ask({ question: '4 bit weights accuracy' })), before);
});

test('SHA256 matches cryptographic reference for Unicode and multiple blocks', () => {
  for (const text of ['', 'abc', 'École ８ bit 🔬', 'x'.repeat(10000)]) assert.equal(sha256(text), createHash('sha256').update(text).digest('hex'));
  assert.equal(corpusHash(corpus).length, 64);
});

test('comparison rejects changing the scientific configuration', () => {
  const a = engine.ask({ question:'attention memory', top_k:2 });
  const b = engine.ask({ question:'attention memory', top_k:3 });
  assert.throws(() => compareResults(a,b), /same question/);
});

test('Python-generated synthetic parity fixture agrees in features, scores and ordering; synthetic deployment is refused', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/synthetic-parity.json', import.meta.url), 'utf8'));
  assert.equal(fixture.synthetic, true); assert.equal(fixture.model.synthetic, true);
  assert.equal(corpusHash(corpus), fixture.corpus_sha256);
  assert.deepEqual(fixture.model.feature_names, FEATURE_NAMES);
  assert.throws(() => createEngine(corpus, {model:fixture.model}), /real-data pilot/);
  for (const query of fixture.queries) {
    const actual = engine.ask({question:query.question,top_k:20});
    assert.deepEqual(actual.evidence.map(item => item.passage_id), query.bm25_order);
    for (const expected of query.rows) {
      const passage = corpus.passages.find(item => item.id === expected.passage_id), paper = corpus.papers.find(item => item.id === passage.paper_id);
      const evidence = actual.evidence.find(item => item.passage_id === passage.id);
      const features = featureVector(query.question, {fields:{text:tokenize(passage.text),title:tokenize(paper.title),tags:tokenize(paper.topics.join(' '))}}, evidence?.lexical_score || 0);
      features.forEach((value,i) => assert.ok(Math.abs(value-expected.features[i])<1e-12, `${query.question}: ${FEATURE_NAMES[i]}`));
      const logit = fixture.model.bias + features.reduce((sum,value,i) => sum+value*fixture.model.weights[i],0);
      assert.ok(Math.abs(1/(1+Math.exp(-logit))-expected.learned_score)<1e-12);
    }
  }
});
