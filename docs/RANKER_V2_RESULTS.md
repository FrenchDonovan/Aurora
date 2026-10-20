# Ranker v2: fresh held-out results

Aurora's CPU LambdaRank model outperforms both BM25 variants on this predetermined fresh QASPER subset. This is a scoped retrieval pilot, not official QASPER QA accuracy, semantic verification or a state-of-the-art claim.

| Method | Paper-macro nDCG@5 | MRR@5 | Reference recall@5 |
|---|---:|---:|---:|
| Global BM25, frozen primary baseline | .389429 | .447972 | .462936 |
| Per-paper text BM25 | .391141 | .451146 | .467034 |
| Token coverage | .379947 | .427138 | .459053 |
| V1 logistic weights on v2 lexical features, diagnostic | .102226 | .123721 | .133588 |
| **V2 LambdaRank** | **.506754** | **.586508** | **.563333** |

The learned-minus-primary-BM25 nDCG difference is **+.117325**, or **30.1% relative improvement**. The paired 95% percentile bootstrap interval is **[+.071065,+.163483]**, 2,000 paper resamples, seed17. Recall difference +.100398, interval [+.050312,+.154449]; MRR difference +.138536, interval [+.077623,+.203593]. Questions average within paper, then papers equally. This is a bootstrap interval for the scoped comparison, not universal superiority. The local BM25 variant happens to score slightly higher than global on the fresh test; both remain below the learner. The primary variant was selected from validation, not switched after seeing test results.

Across 158 eligible fresh-test questions, learned nDCG wins77, ties54 and loses27; across63 eligible papers, wins45/ties7/losses11. Every question, reference set, top-eight ranking and removal/control diagnostic is public. The website begins its atlas with the largest losses. The old v1 negative study remains at `#history`; its different test cannot be used as an unpaired before/after comparison.

## Freeze and selection

[Immutable pre-test GitHub commit 2a5be47](https://github.com/FrenchDonovan/Aurora/commit/2a5be474a19b0d2fb2cc01bcdef46f533d90d258) was committed, pushed and remote-HEAD-verified before the separate test command opened fresh question/answer annotations. It contains the protocol, selection manifest, training/features/evaluation source, validation grid, selected native/exported model, training-statistic fingerprints and development parity tests. No model, hyperparameter, feature or baseline selection used this fresh test. No outcome-driven rerun occurred.

Protocol SHA-256: `7501710488ebbf23dd4f134ad187e279fc34ed42171fa2e0baeee3bdbbeea234`. Model: `0e9710710b8b76fc9443841c95f07f1c11405c5e81a712bbb2fb695a2b2d19ac`. Training statistics: `12cf00a5e4014544fb2e33eb52aa8962ecfc4484eba04ff28bb95cde91d507bb`. The protocol is a public Git freeze, not external peer review or an independent preregistration service. Public benchmark labels are not globally secret; 'fresh' refers to exclusion from prior Aurora test/model-selection inspection.

The official888 training papers supply training text and IDF. Of2,593 training questions,157 normalized duplicates and464 without mapped textual positives are excluded by protocol, leaving1,972 eligible. Ranking training additionally excludes239 groups with no candidate positive and10 without a candidate negative, giving **1,723 usable query groups /55,755 candidate pairs**. Those candidate-miss questions are retained in evaluation; no evaluation group is dropped merely because retrieval missed its references.

The official281 dev papers supply model selection. Of1,005 questions,133 normalized duplicates and104 without mapped positives are excluded, leaving **768 validation questions**. The fixed search compares90 candidates: six leaf/min-leaf settings × three tree counts × five blends. Global BM25 validation nDCG=.351618, local=.338858; the chosen LambdaRank configuration=.446368. Selection:600trees,7leaves, min-leaf30, learned fraction1 (no BM25 blend). All candidate results are in `data/ranker-v2/validation-search.json`; no development-label refit followed selection.

Fresh test selects64 papers by hash from the official test partition, excluding all32 v1 test papers. Unlabeled paper text was prepared before training; fresh questions and annotation labels were opened only after the pushed freeze. Of214 questions,30 normalized duplicates across train/dev/earlier test-in-this-run and26 without mapped textual positives are excluded by the predeclared rule, leaving **158 questions /63 papers**. One selected paper has no eligible question. Seventeen eligible questions have mixed answerability responses. There are105 unmapped evidence entries. References union only non-unanswerable respondents and are partial, not exhaustive judgments. There are41 exact normalized paragraph hashes across the selected train/dev/test partitions; all are recorded in the manifest. Topic/semantic/paraphrase independence is not claimed.

## What changed technically

The v1 pointwise logistic model trained on a small subset and penalized BM25 score/length. V2 uses **query-group LambdaRank**, with gradients tied to ranking quality, **50 lexical/context features**, and a much larger train/dev pool. Features add relative global/local BM25, section coverage/flags, normalized paragraph position, length/citation/numeric density, suffix-normalized and short-window coverage, neighboring-paragraph coverage, and question-type/cue interactions. The learned trees consume no answer text, reference IDs, query IDs or paper identity as a memorized relevance signal.

Several changes occurred together, so this experiment does not isolate which caused the gain. Gain-based feature importance is descriptive, not a causal ablation. Global IDF/average lengths are fitted to training text only; local paper features use the input paper's unlabeled text. All methods use the same positive-global-BM25 pool. Candidate reference recall is .806599, limiting this candidate generator. Exclusions preserve full-paper context, ranks and min-max score normalization; removed paragraphs cannot appear as selected evidence or claims, while their text still informed the frozen context. A full re-indexing intervention would be a different experiment.

LightGBM4.6.0 trains on CPU using pinned dependencies in `research/requirements-ranker.txt`. Exported numeric trees run in browser JavaScript with no LightGBM library, API, Python server, model download service or GPU. A relevance score and the lexical brief gate are not truth confidence or answerability. See [LightGBM parameters](https://lightgbm.readthedocs.io/en/v4.6.0/Parameters.html) and [model export API](https://lightgbm.readthedocs.io/en/v4.6.0/pythonapi/lightgbm.Booster.html).

## Reproduce and audit

Node18+ and Python3.10+; training additionally requires the pinned CPU packages:

```text
python -m pip install -r research/requirements-ranker.txt
python research/download_qasper.py --output work/qasper/raw
python -m research.ranker_v2 test --raw work/qasper/raw --freeze-commit 2a5be474a19b0d2fb2cc01bcdef46f533d90d258 --reproduce
python -m research.audit_ranker_v2 --raw work/qasper/raw
python -m research.reproduce_ranker_v2 --raw work/qasper/raw
node scripts/test.mjs
python -m unittest discover -s tests -p "test_*.py" -v
node scripts/build.mjs
node scripts/serve.mjs --port=4184
```

Use a full Git clone containing the freeze commit. `--reproduce` writes a separate verification output under ignored `work/ranker-v2/reproduction/` and checks predictions against the original report. The isolated retraining helper copies research/data/web into a new ignored directory, reruns preparation and all90 development candidates, then compares the model, statistics, training-data and stable freeze fields. Only the descriptive training duration is allowed to differ; after those checks it restores original freeze metadata in that isolated directory for the Git-object check and reproduces original predictions. It does not modify the released model or outcomes. A repeated retraining verification requires a new directory; existing output is preserved. Retraining may vary across native library/platform/compiler versions; do not overwrite the release to hide differences. Original training used Python3.12, LightGBM4.6.0, NumPy2.2.6, SciPy1.15.3, deterministic two-thread CPU training, about118 seconds including features/search. Timing is descriptive, not a controlled benchmark.

`audit_ranker_v2` is a separate implementation by the project author, not an independent reviewer. It rebuilds raw reference alignment and fresh-paper selection, recalculates all five methods' metrics, paper aggregation, primary bootstrap and intervention checks. All match. Development native-LightGBM/export checks and browser parity cover real data; all fresh-test top-eight IDs/scores agree across Python/browser to absolute1e-10 tolerance. Public UI receipts bind model/statistics/protocol and freeze commit. Historical RL results are unchanged and do not inherit ranker gains.

The new labels are now released. Future feature/model selection requires another untouched test set for confirmatory claims. Partial annotations, assumed negatives, hash-subset sampling, normalized duplicate exclusions and remaining exact/semantic overlap constrain interpretation. Data rights and modifications remain in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
