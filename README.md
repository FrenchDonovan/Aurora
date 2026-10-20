# Aurora — Evidence Selection & Failure Lab

**A working CPU ML experiment. Including the result that did not work.**

[Live study](https://aurora-evidence-stress-lab.starryshark33.chatgpt.site/#study) · [Frozen protocol](research/QASPER_PROTOCOL.md) · [Reproduce and inspect results](docs/QASPER_STUDY.md) · [Third-party rights](THIRD_PARTY_NOTICES.md)

Choose an NLP paper, replay a human research question or write your own, compare BM25 with an actual trained logistic ranker, and remove paragraphs before reranking. Inspect the source, partial human reference annotations, failure atlas and exportable fingerprints. Visitor ranking runs locally; no paid API, GPU or login is required.

## Recorded results

The deterministic QASPER v0.3 subset contains **112 papers and 5,329 contextual paragraphs**. Labels are paper-disjoint: 64 training papers, 16 validation papers, 32 test papers selected by hash. Predetermined eligibility produces 163 training questions / **7,814 question–paragraph pairs**, 46 validation questions and **100 test questions from 31 papers**. The model was saved before locally inspecting test annotations. IDF uses all unlabeled selected texts: this is a **transductive fixed-collection pilot**, not unseen-document generalization.

| Method | Test nDCG@5 | MRR@5 | Reference recall@5 |
|---|---:|---:|---:|
| BM25 | 0.306 | 0.339 | 0.407 |
| Query-token coverage | 0.314 | 0.364 | 0.391 |
| CPU logistic ranker | 0.072 | 0.092 | 0.107 |

Questions average within paper, then papers equally. Learned-minus-BM25 nDCG is **−0.234**, paired 95% paper-bootstrap interval **[−0.323, −0.159]**, 1,000 resamples. No improvement is claimed. BM25 remains the default. Every eligible test query and its predictions, including zero-recall cases, is public. Annotations come from QASPER humans; unselected paragraphs are assumed negatives, not individually verified negatives. This is known-paper paragraph retrieval, not official QASPER answer F1, generative QA, semantic verification or a new algorithm. See the [full study](docs/QASPER_STUDY.md) for omissions, leakage limitations and the failed learner's coefficients.

## Reinforcement learning and reward mismatch

The interactive arena implements real tabular Q-learning, epsilon-greedy exploration, TD updates, STOP and a reading budget. Receipts include Q-values, visits, trajectories, curves, greedy/random baselines and an exact subset oracle. Every question/environment gets a fresh policy trained from zero.

A predeclared audit uses **20 QASPER questions × five seeds × 3,000 episodes**, eight BM25 candidates per environment. All 100 runs reach their lexical proxy optimum; 15 runs (three repeated environments) beat greedy, none lose. Mean reference recall is **17.0%**, versus greedy **13.3%**. Proxy optimality is not semantic evidence quality. There is no policy-transfer, deep-RL, RLHF or held-out RL generalization claim. [Full audit](web/data/study/rl-audit.json).

## Run and verify

Node 18+, Python 3.10+, standard libraries only:

```text
node scripts/test.mjs
python -m unittest discover -s tests -p "test_*.py" -v
node scripts/build.mjs
node scripts/serve.mjs --port=4183
```

Open the printed local URL. [Reproduce the research run](docs/QASPER_STUDY.md). `scripts/browser-acceptance.mjs` is an executable public-UI workflow for a supplied Codex CUA Tab/Browser, separate from unit tests. See [review remediation](docs/REVIEW_REMEDIATION.md) for observed verification and limits. Now-public test labels are a development resource for future changes, not an untouched confirmatory set.

## Project boundaries

Evidence lab, Sources and the interactive RL arena retain a **separate eight-excerpt seed collection**, labeled as a development demonstration. Its `web/data/evaluation.json` remains `not_run`; the QASPER study does not validate that collection. Weak candidates are distinguished from brief-used excerpts. Relevance and the lexical brief gate do not establish truth, entailment or answerability. No hidden LLM generation occurs.

Aurora contributes an inspectable experiment and failure-removal workflow, not a first-ever algorithm. [Related work](docs/RELATED_WORK.md) discusses prior research. The old coding-agent prototype remains under `legacy/coding-agent/` and is excluded from production. MIT applies to original code; third-party text/data retain separate rights under [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
