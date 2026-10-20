# Aurora RL arena

The arena implements actual, query-local **tabular Q-learning** for sequential evidence selection. A visitor trains from zero in browser memory; there are no prewritten trajectories, pretrained weights, paid APIs or GPU requirements. This is a small educational optimization experiment on Aurora's existing excerpt collection. It is separate from the supervised relevance ranker, which remains unavailable without reviewed training data.

## Markov decision process

- **Environment:** one fixed question, source snapshot, exclusion set, reading cost and evidence budget. Active passages are sorted by ID. At most 12 passages are permitted, bounding the bitmask state space to 4,096 masks before the budget constraint. The current seed contains 8 passages.
- **State:** bitmask of selected passages. Remaining budget is derived from the number of set bits; no history variable is hidden from the policy.
- **Actions:** select any unread passage, or STOP. Excluded papers are filtered before constructing candidates, action indices, rewards or receipts. Reading the same passage twice is impossible.
- **Transitions:** deterministic set addition. STOP terminates; reaching the evidence budget also terminates. Every episode starts at the empty set.
- **Coverage:** fraction of unique non-stopword question tokens found in selected titles or exact excerpts. Tokenization reuses the baseline's NFKC/Unicode tokenizer. Curator notes, tags and development claim labels are unused.
- **Overlap:** sum, over unordered pairs of selected passages, of shared query-token count divided by unique query-token count. It measures redundant query-term coverage, not semantic redundancy.
- **Utility:** `3 * coverage - cost * selected_count - 0.25 * overlap`.
- **Reward:** utility after the action minus utility before the action. STOP has zero reward. With gamma 1, undiscounted episode return telescopes to final utility. There is no hidden terminal bonus or ground-truth correctness label.

## Learning

All Q-values begin at zero. The epsilon-greedy behavior policy samples uniformly among valid actions when exploring (including STOP); otherwise it chooses the largest Q-value. Ties prefer STOP, then candidate ID order. The update is:

```text
Q(s,a) += alpha * (r + gamma * max_valid Q(s',a') - Q(s,a))
```

Terminal transitions use zero future value. Alpha is 0.2 and gamma is 1. Epsilon decreases linearly from 1 to 0.05 across the configured training episodes. The seeded PRNG controls training actions. UI training batches yield to the event loop, preserving cancellation and navigation. Batch boundaries do not change numerical training outcomes. A cancelled run discards its partial policy; changed settings invalidate results and exports. A subsequent run starts from zero.

The chart distinguishes greedy policy evaluation (exploration disabled) from mean exploratory episode return in each 100-episode window. Neither is a held-out metric. Constant learning rate, nonzero final exploration and finite training do not satisfy an asserted asymptotic convergence guarantee. Policies may remain suboptimal and their curves may fluctuate.

Algorithm reference: [Watkins and Dayan, Q-learning (1992)](https://www.gatsby.ucl.ac.uk/~dayan/papers/wd92.html). Aurora implements the temporal-difference control mechanism; it does not claim a novel RL algorithm.

## Controls and comparisons

All strategies share the question, active candidates, budget, reward and cost:

1. **Learned greedy Q-policy:** replay after training with exploration disabled.
2. **Greedy marginal reward:** select the action with greatest positive immediate reward; stop on nonpositive ties.
3. **Uniform random policy:** sample valid actions including STOP for 200 independent seeded rollouts. Display mean return and Monte Carlo standard error. That error describes stochastic rollout variability in this environment, not generalization uncertainty across questions or research papers.
4. **Exact optimum:** enumerate every feasible subset and replay a maximizing subset. This is a small-state planning oracle and upper bound, not a trained baseline or human evaluation. State utility is order independent, so enumerating subsets covers all feasible final returns.

Report the gap to the exact optimum, including zero gaps and ties with greedy. The real seed is often simple enough that greedy is already optimal. RL is useful here as an inspectable learning demonstration; superiority over a simpler algorithm has not been established.

The user can adjust question, maximum selections, cost, seed and training duration; exclude sources; import the current investigation's displayed question/exclusions; inspect selected source records; and download a complete experiment receipt. The main evidence-retrieval pipeline and its provenance checks remain unchanged.

## Reproducibility

The JSON receipt contains environment and corpus SHA-256 identities, the active candidate snapshot and matched tokens, exact reward configuration, seed and all learning settings, training checkpoints, TD update/visited-action counts, greedy trajectory, baseline results, and learned Q-values with visit counts for valid actions. STOP is explicit. The environment identity changes when the source snapshot, question, exclusions, cost or budget changes. There is no timestamp-dependent training input.

Run the algorithm tests with `node --test tests/rl.test.mjs`; run all website checks with `node scripts/test.mjs`. The artificial delayed-value counterexample is constructed inside the test file only. It demonstrates software correctness; it is not an observed research-quality result or a deployed evidence source. Tests also cover independent oracle enumeration, reward accounting, seeded/batch reproducibility, invalid actions, source-exclusion invariants, irrelevant and all-excluded environments, annotation leakage and state-space limits.

## Offline reproduction

The browser and command line share the same environment and learner, with no reimplementation. For the default experiment:

```sh
node scripts/run-rl.mjs --question "quantization memory accuracy language models" --seed 17 --episodes 3000 --budget 3 --cost 0.15 > rl-receipt.json
```

Pass `--exclude paper-smoothquant` to reproduce removal of that source. Receipts are emitted to stdout; saving one explicitly persists the question and active excerpts. Given identical settings and source, browser and command-line receipts contain identical JSON data. Open the hosted `/#rl` route to reach the arena directly.

## Scope and future research

This optimizes lexical coverage under a hand-designed proxy. A policy can collect overlapping words without collecting scientifically useful evidence. Reward design is exposed specifically so visitors can see that failure mode. Training and evaluation reuse one fixed environment; there is no transfer to new questions, no RLHF, no deep RL and no improvement claim for answer accuracy, faithfulness or human preferences. No RL results are written into the unmeasured research evaluation artifact.

A later study could introduce independently reviewed evidence-utility rewards, query-family-disjoint training/evaluation, multiple training seeds, strong greedy/optimization baselines, reward-ablation controls and held-out removal tests. Those are future experiments, not evidence supplied by this sandbox.
