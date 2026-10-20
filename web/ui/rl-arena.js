import { createEvidenceEnvironment, createQLearner } from '../lib/rl.js?v=aurora-ranker-v2';

const $ = id => document.getElementById(id);
const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const number = value => value.toFixed(3);

export function initializeRLArena(corpus, { getInvestigation, inspectSource }) {
  let generation = 0, learner = null, environment = null, activeReceipt = null;
  const controls = $('rl-settings');
  function invalidate() {
    generation++; learner = null; activeReceipt = null;
    $('rl-results').hidden = true; $('rl-idle').hidden = false; $('rl-export').disabled = true;
    $('rl-status').textContent = 'Settings changed. Train a fresh policy for this environment.';
    $('rl-error').hidden = true; $('rl-progress').value = 0;
  }
  for (const paper of corpus.papers) {
    const label = make('label', 'rl-source-toggle');
    const checkbox = make('input'); checkbox.type = 'checkbox'; checkbox.value = paper.id; checkbox.name = 'rl-exclude';
    label.append(checkbox, make('span', '', paper.title)); $('rl-sources').append(label);
  }
  controls.addEventListener('input', invalidate);
  $('rl-cost').addEventListener('input', () => { $('rl-cost-value').textContent = Number($('rl-cost').value).toFixed(2); });
  $('rl-use-question').addEventListener('click', () => {
    const current = getInvestigation();
    if (!current) { $('rl-status').textContent = 'Run an investigation in The lab first, or enter a question here.'; return; }
    invalidate(); $('rl-question').value = current.question;
    document.querySelectorAll('[name="rl-exclude"]').forEach(input => { input.checked = current.excluded_paper_ids.includes(input.value); });
    $('rl-status').textContent = 'Copied the displayed investigation and its source exclusions. Train to explore this environment.';
  });
  document.querySelectorAll('[data-rl-question]').forEach(button => button.addEventListener('click', () => { invalidate(); $('rl-question').value = button.dataset.rlQuestion; }));
  function busy(value) {
    controls.disabled = value; $('rl-train').disabled = value; $('rl-cancel').hidden = !value;
    $('rl-export').disabled = value || !activeReceipt;
  }
  $('rl-cancel').addEventListener('click', () => {
    generation++; learner = null; activeReceipt = null; busy(false);
    $('rl-progress').value = 0;
    $('rl-results').hidden = true; $('rl-idle').hidden = false; $('rl-export').disabled = true;
    $('rl-status').textContent = 'Training cancelled. The partial policy was discarded; the next run starts from zero.';
  });
  $('rl-form').addEventListener('submit', async event => {
    event.preventDefault();
    const thisRun = ++generation;
    $('rl-error').hidden = true; $('rl-results').hidden = true; $('rl-idle').hidden = false; activeReceipt = null;
    try {
      environment = createEvidenceEnvironment(corpus, { question: $('rl-question').value, budget: Number($('rl-budget').value), cost: Number($('rl-cost').value), excluded_paper_ids: [...document.querySelectorAll('[name="rl-exclude"]:checked')].map(input => input.value) });
      learner = createQLearner(environment, { seed: Number($('rl-seed').value), episodes: Number($('rl-episodes').value) });
      busy(true); $('rl-progress').value = 0; $('rl-progress').max = Number($('rl-episodes').value);
      $('rl-results').hidden = false; $('rl-idle').hidden = true; $('rl-comparisons').replaceChildren(); $('rl-trajectory').replaceChildren(); $('rl-curve-table').replaceChildren();
      $('rl-gap').textContent = ''; $('rl-fingerprint').textContent = '';
      renderCandidates(environment); drawCurve(learner.snapshot().curve);
      // Yield between real training batches so progress, cancellation and navigation remain responsive.
      while (thisRun === generation) {
        await new Promise(resolve => window.setTimeout(resolve, 0));
        if (thisRun !== generation) return;
        const progress = learner.train(100);
        $('rl-progress').value = progress.completed;
        $('rl-status').textContent = `Training ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} episodes · ${progress.updates.toLocaleString()} temporal-difference updates.`;
        drawCurve(progress.curve);
        if (progress.completed === progress.total) break;
      }
      if (thisRun !== generation) return;
      activeReceipt = learner.receipt(); renderResults(activeReceipt);
      $('rl-status').textContent = `Training complete. ${activeReceipt.training.updates.toLocaleString()} Q-value updates across ${activeReceipt.training.visited_state_actions} visited state–action pairs. These results concern this question and proxy reward only.`;
      busy(false);
    } catch (error) {
      if (thisRun !== generation) return;
      activeReceipt = null; busy(false); $('rl-results').hidden = true; $('rl-idle').hidden = false;
      $('rl-error').hidden = false; $('rl-error').textContent = error.message || 'The experiment could not run.';
      $('rl-status').textContent = 'No completed policy is available. Adjust the settings and try again.';
    }
  });
  function renderCandidates(env) {
    $('rl-candidate-list').replaceChildren(...env.candidates.map(item => {
      const row = make('li'); row.append(make('strong', '', item.title), make('span', '', item.matches.length ? `Matched query terms: ${item.matches.join(', ')}` : 'No query terms matched in title or excerpt.'));
      return row;
    }));
    if (!env.candidates.length) $('rl-candidate-list').append(make('li', '', 'All sources excluded. STOP is the only action.'));
    $('rl-environment').textContent = `${env.candidates.length} candidate excerpts · ${env.query.length} unique query terms · budget ${env.config.budget} · cost ${env.config.cost.toFixed(2)} per selection. Starting state: no excerpts. STOP is always available.`;
  }
  function drawCurve(curve) {
    const svg = $('rl-chart');
    const values = curve.flatMap(item => [item.greedy_return, item.exploration_mean_return]).filter(Number.isFinite);
    const min = Math.min(0, ...values) - 0.15, max = Math.max(0.3, ...values) + 0.15;
    const total = Number($('rl-episodes').value);
    const x = episode => 54 + episode / total * 620;
    const y = value => 180 - (value - min) / (max - min) * 155;
    const svgNode = (tag, attrs, text) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; return node; };
    svg.replaceChildren(svgNode('title', {}, 'Training on this question: greedy policy return and exploration return'), svgNode('desc', {}, 'Reward is a lexical proxy, not answer accuracy. Exact checkpoint values are in the table below.'));
    for (const value of [min + 0.15, 0, max - 0.15]) {
      svg.append(svgNode('line', { x1: 54, x2: 674, y1: y(value), y2: y(value), stroke: '#d7d4ca' }), svgNode('text', { x: 44, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#565954' }, value.toFixed(1)));
    }
    for (const [key, color] of [['exploration_mean_return', '#777b76'], ['greedy_return', '#c43d20']]) {
      const points = curve.filter(item => Number.isFinite(item[key])).map(item => `${x(item.episode)},${y(item[key])}`).join(' ');
      svg.append(svgNode('polyline', { points, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': key === 'exploration_mean_return' ? '5 5' : 'none' }));
    }
    svg.append(svgNode('text', { x: 54, y: 209, 'font-size': 11, fill: '#565954' }, '0 episodes'), svgNode('text', { x: 674, y: 209, 'text-anchor': 'end', 'font-size': 11, fill: '#565954' }, `${total.toLocaleString()} episodes`));
  }
  function renderResults(value) {
    const policy = value.training.policy;
    const baselines = value.baselines;
    const rows = [['Q-learning policy', policy.utility, `${policy.selected_count} excerpt${policy.selected_count === 1 ? '' : 's'} · ${Math.round(policy.coverage * 100)}% lexical coverage`], ['Greedy marginal reward', baselines.greedy.utility, 'Chooses the largest positive immediate reward, then stops.'], ['Random policy · 200 rollouts', baselines.random.mean_return, `Mean ± standard error ${number(baselines.random.standard_error)}; same environment.`], ['Exact optimum · exhaustive', baselines.exact_optimum.utility, 'Planning oracle over every feasible subset; upper bound, not learning.']];
    $('rl-comparisons').replaceChildren(...rows.map(([label, score, note]) => {
      const row = make('div', 'rl-score-row'); row.append(make('strong', '', label), make('b', '', number(score)), make('p', '', note)); return row;
    }));
    const gap = Math.max(0, baselines.exact_optimum.utility - policy.utility);
    $('rl-gap').textContent = `Gap to the exact proxy optimum: ${number(gap)}. A tie with greedy is a valid result; this small task does not establish an advantage for RL.`;
    $('rl-trajectory').replaceChildren(...policy.steps.map(step => {
      const item = make('li', 'rl-step');
      const button = make('button', 'text-button', step.title); button.type = 'button';
      if (step.paper_id) button.addEventListener('click', () => inspectSource(step.paper_id, button)); else button.disabled = true;
      item.append(make('span', 'rl-step-number', String(step.step).padStart(2, '0')), button, make('b', '', `${step.reward >= 0 ? '+' : ''}${number(step.reward)}`), make('p', '', `State ${step.from_state} → ${step.to_state} · coverage ${Math.round(step.coverage * 100)}% · accumulated reading cost ${number(step.reading_cost)} · overlap ${number(step.redundancy)}`));
      return item;
    }));
    $('rl-curve-table').replaceChildren(...value.training.curve.map(point => {
      const row = make('tr'); for (const cell of [point.episode, number(point.greedy_return), point.exploration_mean_return === null ? '—' : number(point.exploration_mean_return), point.epsilon.toFixed(3)]) row.append(make('td', '', cell)); return row;
    }));
    $('rl-fingerprint').textContent = `Environment SHA-256: ${value.environment_sha256}. Seed ${value.algorithm.seed}; α ${value.algorithm.alpha}; γ 1; ε decays from 1 to 0.05. No pretrained policy.`;
  }
  $('rl-export').addEventListener('click', () => {
    if (!activeReceipt) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(activeReceipt, null, 2)], { type: 'application/json' }));
    const link = make('a'); link.href = url; link.download = `aurora-rl-seed-${activeReceipt.algorithm.seed}.json`; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('rl-status').textContent = 'Experiment receipt downloaded, including your question, active source excerpts, Q-values, visit counts, settings, and comparisons.';
  });
  $('rl-train').disabled = false;
}
