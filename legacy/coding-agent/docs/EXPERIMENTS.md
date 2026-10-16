# Experiment protocol

## Hypothesis and controls

Primary question: does one suggestion chosen by a learned failure classifier improve task resolution with the same model and inference budget?

- A: base agent, no intervention.
- B: same base agent, one suggestion at the first observable failure.
- Optional C: one heuristic-selected suggestion under exactly the same trigger and budget. Implement this control before claiming the learned selection itself is valuable.

The current code supplies A and B. It supplies heuristic classifier metrics, but **does not yet implement the heuristic agent intervention control**. The original four-way retrieval/LoRA/failure-aware data-selection study remains a later research phase. This CPU study tests recovery advice; it does not establish that failure-aware SFT selection works.

## Freeze before running

Save task IDs, repository identities, exact commit SHAs, evaluator hashes, container image IDs, local model digest, provider version, hardware, OS, Aurora revision, and budget. Archive a configuration and list of planned tasks outside generated run folders. A task fingerprint identifies a task, not an entire experiment. Review all relevant dataset and repository licenses.

Set the same step, response-token, total reported-token, test-time, and agent-time limits. A and B receive the same tool permissions and source. Use the same model quantization, context configuration and prompt template. Run each planned task once per configuration for pass@1. A retry is another experiment; do not choose the best attempt after seeing outcomes.

## Dataset partitions

Training failure prefixes supply the classifier. Validation repositories tune its features, taxonomy and advice. Final test repositories and evaluator tests remain sealed until the experiment is frozen. Deduplicate issue IDs, commits, patches and near-identical descriptions; the automatic guards only detect exact text and explicit task/repository-group overlap.

Repository aliases, forks and cherry-picked patches can evade these checks. Record decisions. Public benchmarks may occur in model pretraining; this cannot be ruled out just by separating local splits. The classifier pipeline forbids test rows and annotation export from test tasks. Manual edits to data can bypass safeguards, so keep versioned manifests and review provenance.

## What is measured

Primary metric: resolved tasks / eligible first attempts. Invalid baselines are reported separately and must be removed by a predeclared rule, not opportunistically. Provider failures and agent budget exhaustion remain unsuccessful attempted tasks. The local grader requires a known failing baseline plus acceptance and regression success. For SWE-bench, use its official harness as the source of truth.

Report sample size, pass@1, 95% Wilson interval, paired wins/losses, exact McNemar p-value, median and p95 latency, tokens, tool calls, outcome categories, and infrastructure exclusions. Report classifier macro-F1, accuracy, confusion matrix, class counts, and majority/heuristic controls on validation. Small samples produce wide intervals; the p-value is not a substitute for effect size or a larger study.

Aurora currently does not calculate a paired confidence interval for the improvement, per-category human failure rates, or GPU/energy costs. Add a seeded paired bootstrap for the difference and inventory reconciliation before making formal research claims. USD cost is unknown by default and is never inferred from missing data.

## Promotion rule

Choose the promotion criterion before seeing the final results. For example, require a positive validation resolution difference without unacceptable latency or tool-use growth, then report the fixed policy once on held-out tasks. Label that criterion exploratory if it was chosen after analysis. Do not automatically change model weights from individual failures.

Keep negative results, failing traces, and the hypothesis that failed. A credible report can show that a classifier predicts categories well while its advice does not help the coding agent.

## Report outline

1. Task and inference-budget definition.
2. Dataset provenance, splits and deduplication decisions.
3. Agent/tools and execution environment.
4. Labeling procedure and inter-annotator review where possible.
5. Classifier validation against controls.
6. Paired agent results, uncertainty and failure cases.
7. Limitations, compute consumed, artifacts and exact commands.

Leave result tables empty until data exists. Scripted fixture results belong in engineering verification, never in a real-model benchmark table.
