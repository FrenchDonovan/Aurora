# QASPER evidence-selection pilot v1

This negative-result experiment evaluates known-paper paragraph retrieval. The [frozen protocol](../research/QASPER_PROTOCOL.md) predates local test-label inspection. All selected unlabeled texts contribute to IDF; this is a transductive fixed collection, not unseen-document generalization.

## Reproduce on CPU

Python 3.10+, Node 18+, standard libraries only, from repository root:

```text
python research/download_qasper.py --output work/qasper/raw
python -m research.qasper_study prepare --raw work/qasper/raw
python -m research.qasper_study train --raw work/qasper/raw
python -m research.qasper_study test --raw work/qasper/raw
node scripts/audit-rl.mjs
node scripts/test.mjs
python -m unittest discover -s tests -p "test_*.py" -v
node scripts/build.mjs
node scripts/serve.mjs --port=4183
```

The importer checks original file hashes. Preparation reads paper text and IDs, not question labels. Training opens only train/dev annotations, saves the model and freeze record, then the separate test command opens test annotations. Reproduction now uses released test data; it verifies this experiment, not a fresh confirmatory experiment. Future tuning requires a new untouched set. Descriptive CPU timings vary; model, corpus, rankings and metrics should reproduce. The original Python 3.12 CPU training took about 21.5 seconds; this is not a controlled speed benchmark. No external executable code is run.

Protocol hash: `eb4ecffe4d0038889bb3004ea674934c569b0372135242c33099ece54915967e`. The freeze's `test_labels_opened:false` describes the moment of model freeze, not the post-release state. The protocol file was hashed before labels were inspected; it was not committed to Git before that inspection. The final source commit records the released implementation, not a falsely claimed pre-test source commit.

## Eligibility and leakage

Paper selection by hash yields 64/16/32 train/dev/test papers and 5,329 paragraphs. Train: 200 original questions → 163 eligible; 35 lack mapped textual positives, two normalized duplicates excluded. Validation: 51 → 46; three without mapped positives, two duplicates. Test: 117 → 100; nine without mapped positives, eight duplicates. Train/dev/test have 48/18/67 unmapped evidence entries, including floats/extraction mismatches/omitted paragraphs; not all are annotation errors. Fifteen eligible test questions have mixed answerability responses. Reference union includes only respondents not marking unanswerable. One selected test paper has no eligible question, leaving 31 test metric groups.

Five normalized paragraph hashes occur across partitions, retained in `data/qasper/manifest.json`. Exact source duplication, topic overlap and semantic paraphrases remain limitations. Paper IDs do not cross partitions. Normalized duplicate questions are excluded in train → validation → test order, as declared. There is no semantic paraphrase leakage detector. QASPER humans supplied source annotations, not new Aurora adjudication. Nonselected paragraphs are assumed negatives, not exhaustively reviewed. The legacy schema's `reviewed:true` field records benchmark annotation provenance including that explicit transformation; it does not mean every negative was individually human-adjudicated.

## Model and negative result

The fixed learner is full-batch L2-regularized logistic regression, eight existing lexical features, 400 epochs, lr .1, L2 .01, seed 17, zero initialization. No epoch/threshold/features were chosen from validation/test performance. There are 7,814 training pairs from 163 questions. Binary train loss falls .651 → .154, yet held-out ranking deteriorates. BM25 coefficient −.189 and length-saturation coefficient −.710 directly penalize those features holding others constant. They describe the scoring rule, not a proven causal explanation of generalization failure. Class imbalance, assumed negatives, scaling and pointwise-loss/ranking mismatch are plausible next hypotheses, not experimentally isolated causes. Do not tune on these now-public test outcomes and claim an untouched result.

All methods use identical positive-BM25 candidates within the known paper, with frozen full-corpus statistics. Candidate reference recall is .786 paper-macro. Test nDCG/MRR/recall: BM25 .306/.339/.407; query-token coverage .314/.364/.391; learned .072/.092/.107. Learned-minus-BM25 nDCG mean −.234, 95% paired paper-bootstrap interval [−.323,−.159]; recall delta −.300, interval [−.410,−.207], 1,000 resamples, seed 17. Questions average within paper, then papers equally. Validation is separately reported and also unfavorable; no model selection used it. These are partial-annotation pilot metrics, not QA correctness or official QASPER answer F1.

## Removal atlas and RL

Every eligible test question records top-five retention after all reference paragraphs are removed and after seeded count-matched nonreference removal. Recall after removing all references is zero by construction, not a discovery. The inspectable diagnostic is selection sensitivity, including poor rankers that ignore reference removal entirely. Remaining text may still answer because references are partial. The website exposes largest losses, gains/ties, BM25 zero-recall cases and every released test/validation query, plus custom questions and individual paragraph removal. All recorded removal rankings use the learned model; the live method selector also permits BM25 interventions.

RL audit: 20 preselected real question environments × five seeds × 3,000 episodes, eight BM25 candidates, budget 3, cost .15. All 100 runs achieve zero regret to their exact lexical optimum. Fifteen runs beat greedy, from three repeated environments; none lose. Mean reference recall .170 versus greedy .133. The repeats are not 100 independent annotated tasks. Human references are excluded from the reward. Each policy trains and evaluates in its same query-local environment; no transfer is claimed. Per-run returns, oracle gaps, TD counts, visits, candidate ceiling and reference recall are public. The interactive eight-excerpt arena is separate from this QASPER audit.

## Artifacts, rights and verification

`web/data/study/{corpus,model,report,predictions,rl-audit}.json` are public. `data/qasper/` preserves original archive hashes, selected papers, training pairs, normalized-question exclusions and model freeze. The browser checks SHA-256 of compact sorted-key JSON as written by Python, excluding the final newline. It does not reserialize numeric model/prediction artifacts: JavaScript may turn `0.0` into `0`. Hashes detect change, not provenance truth. Tests check top-eight IDs/scores for both methods across all 146 released dev/test questions, absolute score tolerance 1e-12; this is measured parity for these inputs, not a universal guarantee. Browser acceptance and unit tests are reported separately.

Dataset extractions retain BIBREF artifacts; they are not independently verified current-PDF quotations. [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) credits QASPER authors, CC BY 4.0 dataset redistribution and modifications, and distinguishes original-paper rights. MIT covers original code only. The separate eight-excerpt seed collection remains unmeasured and is not validated by this study.


Re-review correction before publication: the Windows training JSONL initially used CRLF on disk although its declared hash described UTF-8 LF serialization. The writer now emits exact LF bytes; the released file matches the original declared hash. Coefficients, model ID, frozen model hash, predictions and outcomes are unchanged. This repairs data-byte provenance, not model selection or test tuning. A test checks the actual training-file bytes against the freeze.
