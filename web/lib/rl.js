/** Query-local tabular Q-learning. Reward is an explicit lexical proxy, never truth. */
import { tokenize, corpusHash, createEngine } from './engine.js?v=aurora-study-v1';

export const RL_VERSION = 'aurora-evidence-mdp-v1';
const check = (condition, message) => { if (!condition) throw new Error(message); };
const count = mask => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };
export function seededRandom(seed) {
  check(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Seed must be a 32-bit unsigned integer.');
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createEvidenceEnvironment(inputCorpus, { question, budget = 3, cost = 0.15, excluded_paper_ids = [] } = {}) {
  createEngine(inputCorpus); // Reuse the corpus/schema/hash validation of the research engine.
  check(typeof question === 'string' && question.trim().length > 0 && question.length <= 600, 'Enter a question of 1–600 characters.');
  const query = [...new Set(tokenize(question))];
  check(query.length > 0, 'The question needs at least one non-stopword term.');
  check(Number.isInteger(budget) && budget >= 1 && budget <= 5, 'Evidence budget must be an integer from 1 to 5.');
  check(Number.isFinite(cost) && cost >= 0 && cost <= 2, 'Reading cost must be between 0 and 2.');
  const corpus = structuredClone(inputCorpus);
  const papers = new Map(corpus.papers.map(paper => [paper.id, paper]));
  check(Array.isArray(excluded_paper_ids) && excluded_paper_ids.every(id => papers.has(id)), 'Unknown excluded paper.');
  const excluded = new Set(excluded_paper_ids);
  const candidates = corpus.passages.filter(passage => !excluded.has(passage.paper_id)).map(passage => {
    const paper = papers.get(passage.paper_id);
    const tokens = new Set(tokenize(paper.title + ' ' + passage.text));
    return { passage_id: passage.id, paper_id: paper.id, title: paper.title, text: passage.text, url: passage.source_url, matches: query.filter(term => tokens.has(term)) };
  }).sort((a, b) => a.passage_id < b.passage_id ? -1 : a.passage_id > b.passage_id ? 1 : 0);
  check(candidates.length <= 12, 'This tabular arena supports at most 12 active excerpts. Exclude sources to reduce the state space.');
  const stop = candidates.length;
  const maxMask = (1 << candidates.length) - 1;
  const config = { version: RL_VERSION, question: question.trim(), budget, cost, coverage_weight: 3, redundancy_weight: 0.25, excluded_paper_ids: Object.freeze([...excluded].sort()), corpus_sha256: corpusHash(corpus) };
  const identity = corpusHash({ ...config, candidate_ids: candidates.map(item => item.passage_id) });
  const validMask = mask => check(Number.isInteger(mask) && mask >= 0 && mask <= maxMask && count(mask) <= budget, 'Invalid evidence state.');
  const cache = new Map();
  function metrics(mask) {
    validMask(mask);
    if (cache.has(mask)) return { ...cache.get(mask) };
    const selected = candidates.filter((_, i) => mask & (1 << i));
    const covered = new Set(selected.flatMap(item => item.matches));
    let overlap = 0;
    for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) overlap += selected[i].matches.filter(term => selected[j].matches.includes(term)).length / query.length;
    const coverage = covered.size / query.length;
    const result = { coverage, redundancy: overlap, reading_cost: cost * selected.length, selected_count: selected.length, utility: 3 * coverage - cost * selected.length - 0.25 * overlap };
    cache.set(mask, result);
    return { ...result };
  }
  function actions(mask) {
    validMask(mask);
    return [stop, ...(count(mask) >= budget ? [] : candidates.map((_, i) => i).filter(i => !(mask & (1 << i))))];
  }
  function step(mask, action) {
    check(actions(mask).includes(action), 'Action is unavailable, repeated, or exceeds the evidence budget.');
    const next = action === stop ? mask : mask | (1 << action);
    return { state: next, action, reward: metrics(next).utility - metrics(mask).utility, done: action === stop || count(next) >= budget };
  }
  function rollout(policy) {
    let mask = 0;
    const steps = [];
    for (let t = 0; t <= budget; t++) {
      const action = policy(mask, actions(mask));
      const transition = step(mask, action);
      const candidate = action === stop ? null : candidates[action];
      steps.push({ step: t + 1, from_state: mask, to_state: transition.state, action: candidate?.passage_id ?? 'STOP', paper_id: candidate?.paper_id ?? null, title: candidate?.title ?? 'Stop collecting evidence', reward: transition.reward, ...metrics(transition.state) });
      mask = transition.state;
      if (transition.done) break;
    }
    return { ...metrics(mask), state: mask, passage_ids: candidates.filter((_, i) => mask & (1 << i)).map(item => item.passage_id), steps };
  }
  function greedy() {
    return rollout((mask, available) => available.reduce((best, action) => step(mask, action).reward > step(mask, best).reward + 1e-12 ? action : best, stop));
  }
  function optimal() {
    let best = 0;
    for (let mask = 1; mask <= maxMask; mask++) if (count(mask) <= budget && metrics(mask).utility > metrics(best).utility + 1e-12) best = mask;
    return rollout((mask, available) => available.find(action => action !== stop && (best & (1 << action)) && !(mask & (1 << action))) ?? stop);
  }
  function randomBaseline(seed = 991, episodes = 200) {
    check(Number.isInteger(episodes) && episodes >= 2 && episodes <= 10000, 'Random baseline requires 2–10000 episodes.');
    const random = seededRandom(seed);
    const returns = Array.from({ length: episodes }, () => rollout((_, available) => available[Math.floor(random() * available.length)]).utility);
    const mean = returns.reduce((a, b) => a + b, 0) / episodes;
    return { mean_return: mean, standard_error: Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (episodes - 1) / episodes), episodes, seed, note: 'Uniform valid actions including STOP; repeated rollouts in the same environment, not held-out questions.' };
  }
  return Object.freeze({ stop, identity, config: Object.freeze(config), query: Object.freeze(query), candidates: Object.freeze(candidates.map(item => Object.freeze({ ...item, matches: Object.freeze(item.matches) }))), metrics, actions, step, rollout, greedy, optimal, randomBaseline });
}

export function createQLearner(environment, { seed = 17, episodes = 3000, alpha = 0.2 } = {}) {
  check(Number.isInteger(episodes) && episodes >= 1 && episodes <= 20000, 'Training requires 1–20000 episodes.');
  check(Number.isFinite(alpha) && alpha > 0 && alpha <= 1, 'Learning rate must be in (0, 1].');
  const random = seededRandom(seed);
  const q = new Map();
  const visits = new Map();
  const curve = [];
  let completed = 0, updates = 0, windowReturn = 0, windowCount = 0;
  const row = mask => { if (!q.has(mask)) q.set(mask, new Float64Array(environment.stop + 1)); return q.get(mask); };
  function choose(mask) {
    const available = environment.actions(mask);
    return available.reduce((best, action) => row(mask)[action] > row(mask)[best] + 1e-12 ? action : best, environment.stop);
  }
  const evaluate = () => environment.rollout(mask => choose(mask));
  curve.push({ episode: 0, greedy_return: evaluate().utility, exploration_mean_return: null, epsilon: 1 });
  function train(batch = 100) {
    check(Number.isInteger(batch) && batch > 0 && batch <= 20000, 'Invalid training batch.');
    const end = Math.min(episodes, completed + batch);
    for (; completed < end;) {
      const epsilon = 1 - 0.95 * (completed / Math.max(1, episodes - 1));
      let mask = 0, episodeReturn = 0;
      for (let t = 0; t <= environment.config.budget; t++) {
        const available = environment.actions(mask);
        const action = random() < epsilon ? available[Math.floor(random() * available.length)] : choose(mask);
        const transition = environment.step(mask, action);
        const future = transition.done ? 0 : Math.max(...environment.actions(transition.state).map(next => row(transition.state)[next]));
        const target = transition.reward + future; // gamma = 1 in this finite, absorbing MDP.
        row(mask)[action] += alpha * (target - row(mask)[action]);
        const key = `${mask}:${action}`;
        visits.set(key, (visits.get(key) ?? 0) + 1);
        updates++; episodeReturn += transition.reward; mask = transition.state;
        if (transition.done) break;
      }
      completed++; windowReturn += episodeReturn; windowCount++;
      if (completed % 100 === 0 || completed === episodes) {
        curve.push({ episode: completed, greedy_return: evaluate().utility, exploration_mean_return: windowReturn / windowCount, epsilon });
        windowReturn = 0; windowCount = 0;
      }
    }
    return snapshot();
  }
  function snapshot() { return { completed, total: episodes, updates, visited_state_actions: visits.size, curve: structuredClone(curve), policy: evaluate() }; }
  function receipt() {
    return { receipt_schema_version: 1, experiment: RL_VERSION, environment_sha256: environment.identity, configuration: structuredClone(environment.config), query_tokens: [...environment.query], candidates: structuredClone(environment.candidates), algorithm: { name: 'tabular Q-learning', seed, alpha, gamma: 1, epsilon_start: 1, epsilon_end: 0.05, planned_episodes: episodes, tie_break: 'STOP, then candidate ID order', initialization: 'all zero' }, training: snapshot(), q_table: [...q].sort((a, b) => a[0] - b[0]).map(([state, values]) => ({ state, actions: environment.actions(state).map(action => ({ action: action === environment.stop ? 'STOP' : environment.candidates[action].passage_id, q: values[action], visits: visits.get(`${state}:${action}`) ?? 0 })) })), baselines: { greedy: environment.greedy(), exact_optimum: environment.optimal(), random: environment.randomBaseline() }, limitations: ['Training and evaluation reuse this one question and environment. No cross-question generalization or held-out improvement is claimed.', 'Reward is lexical query-term coverage using titles and excerpts, minus reading cost and overlap. It is not scientific support, factual accuracy, or human preference.', 'Finite training may be suboptimal. The exhaustive oracle is a planning upper bound on this small proxy problem, not a learned model.', 'Q-table is trained in browser memory from zero; it does not enable the supervised learned ranker or alter the main retrieval pipeline.'] };
  }
  return Object.freeze({ train, snapshot, evaluate, receipt });
}
