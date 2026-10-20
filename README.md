# Aurora — Evidence Selection & Failure Lab

**A CPU learned ranker, a fresh held-out win, and every failure left inspectable.**

[Live study](https://aurora-evidence-stress-lab.starryshark33.chatgpt.site/#study) · [Fresh results and reproduction](docs/RANKER_V2_RESULTS.md) · [Pre-test freeze](https://github.com/FrenchDonovan/Aurora/commit/2a5be474a19b0d2fb2cc01bcdef46f533d90d258) · [Protocol](research/RANKER_V2_PROTOCOL.md) · [Original negative study](https://aurora-evidence-stress-lab.starryshark33.chatgpt.site/#history)

Choose a known NLP paper, replay a human research question or write your own, compare actual LambdaRank inference with BM25, and remove paragraphs before selection. Inspect source text, partial human references, losses and exportable receipts. Visitor inference runs locally without login, GPU, model API or Python server.

## Fresh-test result

| Method | nDCG@5 | MRR@5 | Reference recall@5 |
|---|---:|---:|---:|
| Global BM25, preselected primary baseline | .389 | .448 | .463 |
| Per-paper text BM25 | .391 | .451 | .467 |
| Token coverage | .380 | .427 | .459 |
| **CPU LambdaRank** | **.507** | **.587** | **.563** |

**30.1% relative nDCG@5 improvement** over the frozen primary BM25 baseline on **158 eligible questions from 63 fresh papers**. Learned-minus-BM25 difference +.117; paired 95% paper-bootstrap interval **[+.071,+.163]**, 2,000 resamples. Questions average within paper, then papers equally. This is partial-reference retrieval on a predetermined subset, not QA accuracy, official QASPER F1 or general/state-of-the-art superiority. The learner also beats the second BM25 variant.

The model, protocol, validation grid and evaluation source were [pushed before fresh annotation inspection](https://github.com/FrenchDonovan/Aurora/commit/2a5be474a19b0d2fb2cc01bcdef46f533d90d258). The 64 selected test papers exclude all 32 v1 test papers. The fixed 90-candidate development search used 768 eligible dev questions; training used 1,723 query groups / 55,755 candidate pairs from the official training partition. Global IDF uses training text only. No fresh-test tuning or outcome-driven rerun occurred. All predictions and eligibility exclusions are public. Learned nDCG wins 77 questions, ties 54 and loses 27; the atlas starts with losses.

## What is learned

LightGBM LambdaRank uses query groups, 50 lexical/context features and 600 seven-leaf boosted trees. Features include global/local BM25, relative scores/ranks, section/query overlap, position, numeric/citation density, suffix/window/neighbor coverage and question-type cue interactions. No answer text or human reference label enters inference. Native training is CPU-only with pinned dependencies; exported numeric trees execute in JavaScript. Software parity is checked against native LightGBM development goldens and every fresh-test top-eight ranking/score.

The original logistic pilot lost (.072 versus .306 nDCG on its own older test). Its code, artifacts, [negative-study documentation](docs/QASPER_STUDY.md), [prior independent review](docs/INDEPENDENT_REVIEW.md) and public replay remain. The old and fresh tests differ; only within-study method comparisons support improvement claims. Multiple model/data changes occurred together, so this is not a causal ablation of which change produced the gain.

## Reinforcement learning remains separate

The arena implements actual tabular Q-learning, epsilon-greedy exploration, TD updates, STOP and reading budgets, with complete receipts and greedy/random/exact baselines. Its historical audit used 20 QASPER questions × five seeds × 3,000 episodes. All 100 runs reached their lexical proxy optimum, but mean human-reference recall was only 17%. Each policy trains/evaluates in the same environment. No new RL improvement, policy transfer, deep RL, RLHF or semantic verification follows from the ranker result.

## Run and verify

Node 18+ and Python 3.10+, standard libraries for application checks:

```text
node scripts/test.mjs
python -m unittest discover -s tests -p "test_*.py" -v
node scripts/build.mjs
node scripts/serve.mjs --port=4184
```

Retraining additionally needs `python -m pip install -r research/requirements-ranker.txt`. [Full reproduction and audit commands](docs/RANKER_V2_RESULTS.md) preserve the released model and outcomes. [Verification record](docs/RANKER_V2_VERIFICATION.md) separates unit/integration tests, author recalculation and actual browser checks. The executable CUA workflow covers inference, ablations, historical replay, exports, provenance/focus, route history, RL cancellation/invalidation and narrow layouts. GitHub Actions' existing account-level billing block is separate from locally observed checks.

## Scope and rights

Public v2 replay contains 80 papers / 3,869 paragraphs (64 fresh test plus 16 dev papers), with 158 test and 46 development question replays. QASPER human annotations are partial; unselected paragraphs are assumed negatives. Normalized duplicate exclusions, exact text overlap and possible topic/semantic overlap constrain interpretation. Released test labels cannot serve as untouched evidence for future tuning. Score normalization and full-paper context stay frozen across paragraph exclusions. Relevance and the lexical brief gate are not truth confidence, entailment or answerability.

The small Evidence lab, Sources and interactive RL arena retain a separate eight-excerpt seed collection; its evaluation remains `not_run`. Legacy coding-agent work is preserved under `legacy/` and excluded from production. MIT covers original code, with separate [third-party dataset/text rights and attribution](THIRD_PARTY_NOTICES.md). No algorithmic-firstness claim is made.
