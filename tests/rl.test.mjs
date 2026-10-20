import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEvidenceEnvironment, createQLearner, seededRandom } from '../web/lib/rl.js';

const real = JSON.parse(readFileSync(new URL('../web/data/corpus.json', import.meta.url), 'utf8'));
// Artificial counterexample used only for algorithm correctness, never a research result.
function fixture(texts) {
  const corpus = structuredClone(real);
  corpus.challenges = [];
  corpus.papers = corpus.papers.slice(0, texts.length).map((paper, i) => ({ ...paper, title: `Candidate ${i}`, curator_note: 'alpha beta gamma delta' }));
  corpus.passages = texts.map((text, i) => ({ id: `synthetic-${i}`, paper_id: corpus.papers[i].id, text, text_kind: 'verbatim_excerpt', section: 'Synthetic test only', source_url: corpus.papers[i].url, curator_note: 'alpha beta gamma delta' }));
  return corpus;
}
const makeCounterexample = () => createEvidenceEnvironment(fixture(['alpha beta', 'alpha gamma', 'beta delta']), { question: 'alpha beta gamma delta', budget: 2, cost: 0.4 });

test('RL MDP rewards telescope to declared final utility and enforce budget/no-repeat actions', () => {
  const env = makeCounterexample();
  let state = 0, sum = 0;
  for (const action of [1, 2]) { const step = env.step(state, action); sum += step.reward; state = step.state; }
  assert.equal(env.metrics(state).coverage, 1);
  assert.ok(Math.abs(sum - env.metrics(state).utility) < 1e-12);
  assert.deepEqual(env.actions(state), [env.stop]);
  assert.throws(() => env.step(state, 0), /unavailable/);
  assert.throws(() => env.step(1, 0), /unavailable/);
  assert.throws(() => env.metrics(-1), /Invalid/);
  assert.throws(() => env.metrics(1.5), /Invalid/);
  const stopped = env.step(0, env.stop);
  assert.equal(stopped.reward, 0); assert.equal(stopped.done, true);
});

test('Q-learning learns delayed value beyond a myopic greedy choice on an explicit synthetic counterexample', () => {
  const env = makeCounterexample();
  assert.ok(env.optimal().utility > env.greedy().utility + 0.5);
  const learner = createQLearner(env, { seed: 17, episodes: 5000 });
  assert.equal(learner.evaluate().utility, 0);
  const trained = learner.train(5000);
  assert.ok(Math.abs(trained.policy.utility - env.optimal().utility) < 1e-8);
  assert.equal(trained.completed, 5000);
  assert.ok(trained.updates >= 5000);
  assert.ok(learner.receipt().q_table.some(row => row.actions.some(action => action.visits > 0 && action.q > 0)));
});

test('RL training is deterministic and batch boundaries do not change Q-values or checkpoints', () => {
  const a = createQLearner(makeCounterexample(), { seed: 0, episodes: 700 });
  const b = createQLearner(makeCounterexample(), { seed: 0, episodes: 700 });
  a.train(700); for (let i = 0; i < 7; i++) b.train(100);
  assert.deepEqual(a.receipt(), b.receipt());
  const before = a.receipt(); a.train(100); assert.deepEqual(a.receipt(), before);
  const external = a.receipt(); external.q_table[0].actions[0].q = 999;
  assert.deepEqual(a.receipt(), before);
});

test('excluded sources are removed before state/action construction and absent from RL receipts', () => {
  const excluded = real.papers[0].id;
  const env = createEvidenceEnvironment(real, { question: 'language models', excluded_paper_ids: [excluded] });
  const learner = createQLearner(env, { episodes: 100 }); learner.train(100);
  const receipt = learner.receipt();
  assert.ok(receipt.candidates.every(item => item.paper_id !== excluded));
  assert.ok(receipt.training.policy.steps.every(item => item.paper_id !== excluded));
  const excludedIds = new Set(real.passages.filter(item => item.paper_id === excluded).map(item => item.id));
  assert.ok(receipt.q_table.every(row => row.actions.every(action => !excludedIds.has(action.action))));
  assert.throws(() => createEvidenceEnvironment(real, { question: 'models', excluded_paper_ids: ['unknown'] }), /Unknown/);
});

test('zero-match and all-excluded environments learn STOP without consuming spurious evidence', () => {
  for (const options of [{ question: 'zyxwvut98765' }, { question: 'models', excluded_paper_ids: real.papers.map(item => item.id) }]) {
    const env = createEvidenceEnvironment(real, options);
    const learner = createQLearner(env, { episodes: 300 }); learner.train(300);
    assert.deepEqual(learner.evaluate().passage_ids, []);
    assert.equal(learner.evaluate().steps[0].action, 'STOP');
    assert.equal(env.optimal().utility, 0);
    assert.equal(env.greedy().utility, 0);
    assert.ok(Number.isFinite(env.randomBaseline().standard_error));
  }
});

test('exact oracle agrees with independent feasible-subset enumeration on real source snapshots', () => {
  for (const cost of [0, 0.15, 1.5]) for (const budget of [1, 3, 5]) {
    const env = createEvidenceEnvironment(real, { question: 'quantization memory accuracy language models', budget, cost });
    let best = 0;
    for (let mask = 0; mask < 2 ** env.candidates.length; mask++) {
      if (mask.toString(2).replaceAll('0', '').length > budget) continue;
      const selected = env.candidates.filter((_, i) => mask & 2 ** i);
      const covered = new Set(selected.flatMap(item => item.matches));
      let overlap = 0;
      for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) overlap += selected[i].matches.filter(term => selected[j].matches.includes(term)).length / env.query.length;
      best = Math.max(best, 3 * covered.size / env.query.length - cost * selected.length - 0.25 * overlap);
    }
    assert.ok(Math.abs(best - env.optimal().utility) < 1e-12);
  }
});

test('reward ignores curator annotations; receipts identify environment and complete reproducibility settings', () => {
  const corpus = fixture(['unrelated', 'other']);
  const env = createEvidenceEnvironment(corpus, { question: 'alpha beta' });
  assert.equal(env.metrics(1).coverage, 0);
  assert.ok(env.metrics(1).utility < 0);
  const receipt = createQLearner(env, { seed: 42, episodes: 10 }).receipt();
  assert.equal(receipt.algorithm.gamma, 1);
  assert.equal(receipt.algorithm.seed, 42);
  assert.match(receipt.environment_sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(env.identity, createEvidenceEnvironment(corpus, { question: 'alpha beta', cost: 1 }).identity);
  assert.ok(receipt.limitations.some(text => text.includes('No cross-question generalization')));
  assert.deepEqual(env.randomBaseline(23), env.randomBaseline(23));
});

test('invalid RL settings fail explicitly and state space is bounded', () => {
  for (const options of [{ question: '' }, { question: 'the and' }, { question: 'models', budget: 0 }, { question: 'models', budget: 6 }, { question: 'models', cost: NaN }, { question: 'models', cost: -1 }]) assert.throws(() => createEvidenceEnvironment(real, options));
  assert.throws(() => seededRandom(-1)); assert.throws(() => seededRandom(1.5));
  const env = makeCounterexample();
  assert.throws(() => createQLearner(env, { episodes: 0 })); assert.throws(() => createQLearner(env, { alpha: 0 }));
  assert.throws(() => createQLearner(env).train(0));
  const tooBig = structuredClone(real);
  tooBig.passages = Array.from({ length: 13 }, (_, i) => ({ ...tooBig.passages[0], id: `many-${i}` }));
  tooBig.challenges = [];
  assert.throws(() => createEvidenceEnvironment(tooBig, { question: 'models' }), /at most 12/);
});
