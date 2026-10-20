import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createEngine,sha256} from '../web/lib/engine.js';
const load=name=>JSON.parse(readFileSync(new URL(`../web/data/study/${name}.json`,import.meta.url),'utf8'));
const corpus=load('corpus'),model=load('model'),report=load('report'),predictions=load('predictions');
const engine=createEngine(corpus,{model});
test('released model and predictions match the pre-test model freeze and report fingerprints',()=>{
  for(const [name,expected] of [['corpus',report.manifest.corpus_sha256],['model',report.freeze.model_sha256],['predictions',report.predictions_sha256]])assert.equal(sha256(readFileSync(new URL(`../web/data/study/${name}.json`,import.meta.url),'utf8').trimEnd()),expected);
  assert.equal(model.synthetic,false);assert.equal(report.freeze.test_labels_opened,false);
  const trainingBytes=readFileSync(new URL('../data/qasper/train-validation-judgments.jsonl',import.meta.url));
  assert.equal(createHash('sha256').update(trainingBytes).digest('hex'),report.freeze.training_data_sha256);
  assert.equal(report.test.eligible_queries,100);assert.equal(corpus.papers.length,112);
});
test('real-data Python/browser rankings and scores agree on every released validation and test question',()=>{
  for(const q of predictions)for(const method of ['bm25','learned']){
    const result=engine.ask({question:q.question,paper_id:q.paper_id,method,top_k:8});
    assert.deepEqual(result.evidence.map(p=>p.passage_id),q.rankings[method].map(p=>p.passage_id),`${method} ${q.query_id}`);
    result.evidence.forEach((p,i)=>assert.ok(Math.abs(p.score-q.rankings[method][i].score)<1e-12,`${method} score ${q.query_id}`));
    assert.ok(result.evidence.every(p=>p.paper_id===q.paper_id));
  }
});
test('paper scope and paragraph interventions preserve fixed statistics and remove text before ranking',()=>{
  const q=predictions.find(q=>q.partition==='test');
  const before=engine.ask({question:q.question,paper_id:q.paper_id,method:'learned'});
  const removed=q.reference_ids;
  const after=engine.ask({question:q.question,paper_id:q.paper_id,method:'learned',excluded_passage_ids:removed});
  assert.deepEqual(after.excluded_passage_ids,removed);
  assert.ok(after.evidence.every(p=>!removed.includes(p.passage_id)));
  for(const item of after.evidence){const old=before.evidence.find(p=>p.passage_id===item.passage_id);if(old)assert.equal(old.score,item.score);}
  const empty=engine.ask({question:q.question,paper_id:q.paper_id,excluded_passage_ids:corpus.passages.filter(p=>p.paper_id===q.paper_id).map(p=>p.id)});
  assert.equal(empty.evidence.length,0);assert.equal(empty.claims.length,0);assert.equal(empty.diagnostics.allowed_passage_count,0);
  assert.throws(()=>engine.ask({question:q.question,paper_id:'unknown'}));
  assert.throws(()=>engine.ask({question:q.question,excluded_passage_ids:['unknown']}));
});
test('weak lexical candidates are explicitly distinguished from brief-used paragraphs',()=>{
  const q=predictions[0], r=engine.ask({question:q.question,paper_id:q.paper_id});
  assert.ok(r.evidence.every(p=>Array.isArray(p.matched_text_terms)&&typeof p.used_in_brief==='boolean'));
  assert.deepEqual(r.evidence.filter(p=>p.used_in_brief).map(p=>p.passage_id),r.claims.flatMap(c=>c.passage_ids));
});
test('RL audit preserves independent per-question training boundary, all seeds and unfavorable reference outcomes',()=>{
  const audit=load('rl-audit');assert.equal(audit.runs.length,100);
  assert.deepEqual(audit.seeds,[1,7,17,42,99]);assert.equal(new Set(audit.runs.map(r=>r.query_id)).size,20);
  assert.ok(audit.runs.every(r=>r.regret>=-1e-9&&r.candidate_ids.length<=8));
  assert.ok(audit.runs.some(r=>r.policy_reference_recall===0&&r.regret<1e-9));
});
