import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEngine, compareResults } from '../web/lib/engine.js';

const corpus = JSON.parse(readFileSync(new URL('../web/data/corpus.json', import.meta.url), 'utf8'));

test('real corpus: each development challenge can run and survives paper-by-paper exclusion invariants', () => {
  const engine = createEngine(corpus);
  for (const challenge of corpus.challenges) {
    const original = engine.ask({ question: challenge.question, challenge_id: challenge.id });
    assert.ok(['evidence_found', 'insufficient_evidence'].includes(original.status));
    for (const paper of corpus.papers) {
      const stressed = engine.ask({ question: challenge.question, challenge_id: challenge.id, excluded_paper_ids: [paper.id] });
      assert.equal(stressed.evidence.some(item => item.paper_id === paper.id), false);
      const removedPassageIds = new Set(corpus.passages.filter(item => item.paper_id === paper.id).map(item => item.id));
      assert.equal(stressed.claims.some(item => item.passage_ids.some(id => removedPassageIds.has(id))), false);
      for (const id of removedPassageIds) assert.equal(stressed.brief.includes(`[${id}]`), false);
      const comparison = compareResults(original, stressed);
      assert.ok(comparison.passage_jaccard >= 0 && comparison.passage_jaccard <= 1);
    }
  }
});

test('real corpus: removing all papers leaves no answer text or stale source references', () => {
  const engine = createEngine(corpus);
  const result = engine.ask({ question: 'How do language models use context?', excluded_paper_ids: corpus.papers.map(item => item.id) });
  assert.equal(result.status, 'insufficient_evidence');
  assert.deepEqual(result.evidence, []);
  assert.deepEqual(result.claims, []);
  assert.equal(result.diagnostics.distinct_papers, 0);
});

test('real corpus: modified sample question never inherits curator relations', () => {
  const engine = createEngine(corpus);
  for (const challenge of corpus.challenges) {
    const result = engine.ask({ question: challenge.question + ' What about a different task?', challenge_id: challenge.id });
    assert.equal(result.challenge_id, null);
    assert.ok(result.evidence.every(item => item.curated_relation === null));
  }
});

test('no production learned model or unmeasured performance is invented', () => {
  const engine = createEngine(corpus);
  assert.equal(engine.available_methods.find(item => item.id === 'learned').available, false);
  assert.throws(() => engine.ask({ question: 'context', method: 'learned' }), /unavailable/i);
  const evaluation = JSON.parse(readFileSync(new URL('../web/data/evaluation.json', import.meta.url), 'utf8'));
  assert.equal(evaluation.status, 'not_run');
  assert.equal(evaluation.metrics.length, 0);
});
