import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeEngine } from '../web/ui/model-loader.js';
const corpus = JSON.parse(readFileSync(new URL('./fixtures/synthetic-corpus.json', import.meta.url), 'utf8'));
const query = 'Can quantization preserve accuracy?';
const assertBaseline = result => {
  assert.equal(result.modelHash, null);
  assert.equal(result.engine.available_methods.find(item => item.id === 'learned').available, false);
  assert.equal(result.engine.ask({question:query}).status, 'evidence_found');
  assert.match(result.note, /unavailable/);
};
test('frontend optional model: genuine absence leaves usable baseline', async () => {
  const result = await initializeEngine(corpus, {fetchImpl:async () => ({status:404,ok:false})});
  assertBaseline(result); assert.match(result.note, /No reviewed-data model/);
});
test('frontend optional model: explicit absence never requests a missing asset or leaks parser details', async () => {
  const absent = await initializeEngine(corpus, {modelURL:null, fetchImpl:async () => {throw new Error('Must not fetch');}});
  assertBaseline(absent);
  const rejected = await initializeEngine(corpus, {fetchImpl:async () => ({status:200,ok:true,json:async () => {throw new SyntaxError("Unexpected token '<' private parser details");}})});
  assertBaseline(rejected);
  assert.doesNotMatch(rejected.note, /Unexpected token|private parser/);
});
test('frontend optional model: malformed JSON, HTTP failure, network error and empty artifact are visible failures', async () => {
  const failures = [
    async () => ({status:200,ok:true,json:async () => {throw new SyntaxError('Malformed JSON');}}),
    async () => ({status:503,ok:false}),
    async () => {throw new Error('Network unavailable');},
    async () => ({status:200,ok:true,json:async () => null})
  ];
  for (const fetchImpl of failures) { const result=await initializeEngine(corpus,{fetchImpl}); assertBaseline(result); assert.match(result.note,/could not be loaded or was rejected/); }
});
test('frontend optional model: synthetic and incompatible artifacts are rejected without breaking lexical retrieval', async () => {
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/synthetic-parity.json',import.meta.url),'utf8'));
  for (const model of [fixture.model, {schema_version:999}]) {
    const result=await initializeEngine(corpus,{fetchImpl:async () => ({status:200,ok:true,json:async () => model})});
    assertBaseline(result); assert.match(result.note,/rejected/);
  }
});
test('frontend optional model: an accepted artifact is delegated unchanged and hashed; no fabricated real model fixture', async () => {
  // This isolates loader wiring through an explicit test double. It is not a model-quality or trained-artifact acceptance test.
  const opaqueTestArtifact={test_only:true}; const baseline={kind:'baseline'}; const accepted={kind:'test-double'};
  const result=await initializeEngine(corpus,{
    fetchImpl:async () => ({status:200,ok:true,json:async () => opaqueTestArtifact}),
    engineFactory:(actual,options) => { assert.equal(actual,corpus); if (!options) return baseline; assert.equal(options.model,opaqueTestArtifact); return accepted; },
    hashModel:artifact => { assert.equal(artifact,opaqueTestArtifact);return 'test-only-hash'; }
  });
  assert.equal(result.engine,accepted); assert.equal(result.modelHash,'test-only-hash'); assert.match(result.note,/Choose it explicitly/);
});
