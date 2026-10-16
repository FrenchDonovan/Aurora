import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256, countWords, validateCorpus, validateEvaluation } from '../scripts/validate-corpus.mjs';
const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const corpus = await load('../web/data/corpus.json');
const evaluation = await load('../web/data/evaluation.json');
const ledger = await load('../data/manifests/source-ledger.json');
const copy = () => structuredClone(corpus);

test('real seed has valid references, pinned sources, bounded quotes and hashes', () => {
  const report = validateCorpus(corpus);
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.papers, 8);
  for (const paper of corpus.papers) {
    const entry = ledger.sources.find(x => x.paper_id === paper.id);
    assert.ok(entry, `missing source ledger ${paper.id}`);
    assert.equal(entry.primary_url, paper.url);
    assert.equal(entry.license_status, paper.license.status);
    assert.equal(entry.quoted_words, corpus.passages.filter(x => x.paper_id === paper.id).reduce((a,b) => a+countWords(b.text), 0));
    assert.equal(entry.independent_human_review, false);
  }
});
test('quote tampering fails the content-integrity check', () => {
  const c = copy(); c.passages[0].text += ' altered';
  assert.ok(validateCorpus(c).errors.some(x => x.includes('SHA-256')));
});
test('source budget is aggregated across passages and paper versions', () => {
  const c = copy(); const p = structuredClone(c.passages[0]); p.id += '-extra'; c.passages.push(p);
  assert.ok(validateCorpus(c).errors.some(x => x.includes('source budget')));
});
test('broken references, duplicate IDs and foreign source URLs are rejected', () => {
  const c = copy(); c.passages[0].paper_id = 'absent'; c.papers[1].id = c.papers[0].id; c.passages[2].source_url = 'https://evil.example/abs/2307.03172v3';
  const errors = validateCorpus(c).errors.join(' ');
  assert.match(errors, /missing paper reference/); assert.match(errors, /duplicate id/); assert.match(errors, /source URL differs/);
});
test('public development cases cannot silently become held-out or unreviewed claims', () => {
  const c = copy(); c.challenges[0].development_only = false; delete c.challenges[1].review; c.challenges[2].relations[0].rationale = '';
  const errors = validateCorpus(c).errors.join(' ');
  assert.match(errors, /development_only/); assert.match(errors, /review provenance/); assert.match(errors, /rationale/);
});
test('unknown reuse permission cannot claim CC licensing', () => {
  const c = copy(); c.papers[0].license.id = 'CC-BY-4.0';
  assert.ok(validateCorpus(c).errors.some(x => x.includes('cannot claim a license')));
});
test('missing arrays and invalid objects produce validation errors', () => {
  assert.equal(validateCorpus(null).valid, false);
  assert.equal(validateCorpus({ schema_version: 1 }).valid, false);
  const c = copy(); c.updated_at = 123; c.papers[0].url = 123;
  assert.equal(validateCorpus(c).valid, false);
});
test('evaluation remains explicitly unmeasured and rejects fabricated result placeholders', () => {
  assert.equal(evaluation.status, 'not_run'); assert.deepEqual(validateEvaluation(evaluation).errors, []);
  assert.equal(validateEvaluation({ ...evaluation, metrics: [{ name: 'accuracy', value: 0.9 }] }).valid, false);
});
test('SHA-256 is a standard UTF-8 checksum, not source verification', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
