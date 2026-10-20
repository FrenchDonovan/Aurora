/** Predeclared QASPER query-local RL audit; never a transfer benchmark. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createEvidenceEnvironment, createQLearner } from '../web/lib/rl.js';
import { sha256, corpusHash } from '../web/lib/engine.js';
const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const corpus = load('../web/data/study/corpus.json');
const predictions = load('../web/data/study/predictions.json');
const selected = predictions.filter(q => q.partition === 'test').sort((a,b) => sha256('aurora-rl-v1:' + a.query_id).localeCompare(sha256('aurora-rl-v1:' + b.query_id))).slice(0,20);
const runs = [];
for (const query of selected) {
  const ids = new Set(query.rankings.bm25.map(r => r.passage_id));
  const bounded = {...corpus, papers:corpus.papers.filter(p=>p.id===query.paper_id), passages:corpus.passages.filter(p=>ids.has(p.id))};
  const env = createEvidenceEnvironment(bounded,{question:query.question,budget:3,cost:0.15});
  const optimum=env.optimal(), greedy=env.greedy(), random=env.randomBaseline();
  const recall = ids => ids.filter(id=>query.reference_ids.includes(id)).length/query.reference_ids.length;
  for(const seed of [1,7,17,42,99]) {
    const start=performance.now(); const learner=createQLearner(env,{seed,episodes:3000,alpha:0.2});
    learner.train(3000); const snapshot=learner.snapshot();
    runs.push({query_id:query.query_id,paper_id:query.paper_id,seed,environment_sha256:env.identity,candidate_ids:env.candidates.map(p=>p.passage_id),reference_candidate_recall:recall(env.candidates.map(p=>p.passage_id)),return:snapshot.policy.utility,regret:optimum.utility-snapshot.policy.utility,greedy_return:greedy.utility,oracle_return:optimum.utility,random_mean_return:random.mean_return,policy_reference_recall:recall(snapshot.policy.passage_ids),greedy_reference_recall:recall(greedy.passage_ids),policy_ids:snapshot.policy.passage_ids,visited_state_actions:snapshot.visited_state_actions,td_updates:snapshot.updates,training_ms_descriptive:performance.now()-start});
  }
}
const mean=key=>runs.reduce((s,r)=>s+r[key],0)/runs.length;
const regrets=runs.map(r=>r.regret).sort((a,b)=>a-b);
const result={status:'pilot',protocol_sha256:load('../data/qasper/model-freeze.json').protocol_sha256,corpus_sha256:corpusHash(corpus),question_environments:selected.length,seeds:[1,7,17,42,99],episodes_per_run:3000,budget:3,cost:0.15,aggregate:{mean_regret:mean('regret'),max_regret:regrets.at(-1),median_regret:regrets[Math.floor(regrets.length/2)],optimal_runs:runs.filter(r=>r.regret<1e-9).length,total_runs:runs.length,strictly_better_than_greedy:runs.filter(r=>r.return>r.greedy_return+1e-9).length,worse_than_greedy:runs.filter(r=>r.return<r.greedy_return-1e-9).length,mean_policy_reference_recall:mean('policy_reference_recall'),mean_greedy_reference_recall:mean('greedy_reference_recall'),mean_td_updates:mean('td_updates')},limitations:['A separate learner is trained and evaluated in each same environment. No policy transfer or held-out generalization.', 'Top-eight BM25 candidate cap; human reference may be absent from the pool.', 'Lexical proxy reward can prefer paragraphs not selected by QASPER annotators. Partial reference labels are not exhaustive truth.', 'Runtime is a local descriptive measurement, not a controlled speed comparison.'],runs};
writeFileSync(new URL('../web/data/study/rl-audit.json',import.meta.url),JSON.stringify(result)+'\n');
console.log(JSON.stringify(result.aggregate));
