import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createTreeIndex,createTreeEngine,predictTrees,TREE_FEATURE_NAMES} from '../web/lib/tree-ranker.js';
const file=p=>new URL('../'+p,import.meta.url);
const load=p=>JSON.parse(readFileSync(file(p),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(file(p),'utf8').trimEnd()).digest('hex');
const corpus=load('web/data/study-v2/corpus.json'),model=load('web/data/study-v2/model.json'),statistics=load('web/data/study-v2/statistics.json');
const engine=createTreeEngine(corpus,{model,statistics,statisticsHash:hash('web/data/study-v2/statistics.json')});
const fixture=load('tests/fixtures/ranker-v2-validation.json');
test('v2 freeze binds real model, training-only statistics and a fresh paper set excluding all v1 test papers',()=>{
  const freeze=load('data/ranker-v2/freeze.json'),manifest=load('data/ranker-v2/manifest.json'),old=load('data/qasper/manifest.json');
  assert.equal(hash('web/data/study-v2/model.json'),freeze.model_sha256);assert.equal(hash('web/data/study-v2/statistics.json'),freeze.statistics_sha256);
  assert.equal(hash('data/ranker-v2/manifest.json'),freeze.manifest_sha256);assert.equal(freeze.validation_candidate_count,90);
  assert.equal(manifest.selection.test.length,64);assert.ok(manifest.selection.test.every(id=>!old.selection.test.includes(id)));
  assert.equal(model.synthetic,false);assert.equal(model.training_provenance.train_papers,888);assert.equal(model.training_provenance.validation_papers,281);
  assert.deepEqual(model.feature_names,TREE_FEATURE_NAMES);
});
test('all 50 browser features and exported tree scores agree with actual native LightGBM development goldens',()=>{
  const index=createTreeIndex(corpus,statistics);
  for(const q of fixture.cases){const rows=index.rows(q.question,q.paper_id);assert.deepEqual(rows.map(r=>r.passage_id),q.rows.map(r=>r.passage_id));
    rows.forEach((row,i)=>{row.features.forEach((v,j)=>assert.ok(Math.abs(v-q.rows[i].features[j])<1e-10,`${q.paper_id} ${row.passage_id} feature ${j}: ${v} vs ${q.rows[i].features[j]}`));assert.ok(Math.abs(predictTrees(model.trees,row.features)-q.rows[i].native_tree_score)<1e-10);});
  }
});
test('v2 filtering freezes context and normalizations and all-excluded scope contains no evidence or claims',()=>{
  const q=fixture.cases[0],args={question:q.question,paper_id:q.paper_id};const before=engine.ask(args),id=before.evidence[0].passage_id;
  const after=engine.ask({...args,excluded_passage_ids:[id]});assert.ok(!after.evidence.some(p=>p.passage_id===id));
  for(const r of after.evidence){const prev=before.evidence.find(p=>p.passage_id===r.passage_id);if(prev)assert.equal(r.score,prev.score);}
  const empty=engine.ask({...args,excluded_passage_ids:corpus.passages.filter(p=>p.paper_id===q.paper_id).map(p=>p.id)});
  assert.equal(empty.evidence.length,0);assert.equal(empty.claims.length,0);assert.equal(empty.diagnostics.allowed_passage_count,0);
  assert.throws(()=>engine.ask({...args,excluded_passage_ids:['unknown']}));assert.throws(()=>engine.ask({...args,paper_id:'unknown'}));
});
test('v2 validates cyclic/malformed trees, feature and statistics mismatches, and copies caller-owned state',()=>{
  const clone=()=>structuredClone(model);let bad=clone();bad.trees=[[[0,1,0,0]]];assert.throws(()=>createTreeEngine(corpus,{model:bad,statistics,statisticsHash:model.statistics_sha256}));
  bad=clone();bad.feature_names=[];assert.throws(()=>createTreeEngine(corpus,{model:bad,statistics,statisticsHash:model.statistics_sha256}));
  assert.throws(()=>createTreeEngine(corpus,{model,statistics,statisticsHash:'0'.repeat(64)}));
  const changed=clone(),copied=createTreeEngine(corpus,{model:changed,statistics,statisticsHash:model.statistics_sha256}),q=fixture.cases[0],args={question:q.question,paper_id:q.paper_id};const expected=copied.ask(args).evidence.map(p=>p.score);changed.trees=[];assert.deepEqual(copied.ask(args).evidence.map(p=>p.score),expected);
});
const released=existsSync(file('web/data/study-v2/report.json'));
test('released fresh-test Python and browser top-eight rankings/scores match for both selected methods',{skip:!released},()=>{
  const report=load('web/data/study-v2/report.json'),predictions=load('web/data/study-v2/predictions.json');assert.equal(hash('web/data/study-v2/predictions.json'),report.predictions_sha256);
  for(const q of predictions)for(const method of ['bm25','learned']){
    const key=method==='bm25'?model.blend.baseline:method;const result=engine.ask({question:q.question,paper_id:q.paper_id,method,top_k:8});
    assert.deepEqual(result.evidence.map(p=>p.passage_id),q.rankings[key].map(p=>p.passage_id));result.evidence.forEach((p,i)=>assert.ok(Math.abs(p.score-q.rankings[key][i].score)<1e-10));
  }
});
