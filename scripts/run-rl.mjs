// Offline reproduction of the exact browser MDP and learner; no third-party packages.
import { readFileSync } from 'node:fs';
import { createEvidenceEnvironment, createQLearner } from '../web/lib/rl.js';

const args = process.argv.slice(2);
const allowed = new Set(['question', 'budget', 'cost', 'seed', 'episodes', 'exclude']);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  const name = args[i].startsWith('--') ? args[i].slice(2) : '';
  if (!allowed.has(name) || args[i + 1] === undefined || args[i + 1].startsWith('--') || Object.hasOwn(options, name)) throw new Error('Use --question "terms" [--budget 3] [--cost 0.15] [--seed 17] [--episodes 3000] [--exclude paper-id,paper-id]');
  options[name] = args[i + 1];
}
if (!options.question) throw new Error('Supply --question "your question or research terms".');
const corpus = JSON.parse(readFileSync(new URL('../web/data/corpus.json', import.meta.url), 'utf8'));
const environment = createEvidenceEnvironment(corpus, { question: options.question, budget: Number(options.budget ?? 3), cost: Number(options.cost ?? 0.15), excluded_paper_ids: options.exclude ? options.exclude.split(',') : [] });
const learner = createQLearner(environment, { seed: Number(options.seed ?? 17), episodes: Number(options.episodes ?? 3000) });
learner.train(Number(options.episodes ?? 3000));
console.log(JSON.stringify(learner.receipt(), null, 2));
