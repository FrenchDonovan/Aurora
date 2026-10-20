# Aurora ranker v2: fresh-test protocol

Declared before inspecting any new test question/reference labels. This is a second, validation-selected known-paper retrieval study, not a revision of the old negative-result test. Preserve v1 code, data, scores and failure history.

## Data boundaries

Use all 888 official QASPER v0.3 train papers for coefficient/tree training and all 281 official dev papers for model selection. The old 64/16 subsets may be reused as train/dev; the old 32 test papers and their outcomes are not training/validation data. Fresh final test: select the 64 lowest SHA-256(`aurora-ranker-v2-test:` + paper ID) among official test papers **excluding every v1 test paper**. Record IDs using keys only, without inspecting questions/answers. Unselected remaining test papers remain unused. No source selection based on relevance/performance.

Use the same paragraph eligibility, exact-whitespace evidence union, non-unanswerable respondent rule and assumed-negative limitations as v1. Deduplicate whitespace-normalized paragraphs within paper; nonempty length ≤12,000 characters. Exclude duplicate NFKC/lowercase/whitespace-normalized questions across papers in train → dev → test order, then paper/question ID order. Record eligibility counts, unmapped evidence, mixed answerability and exact text overlap. No semantic/paraphrase independence claim. Training text alone supplies the frozen global IDF/average-length statistics; per-paper BM25 uses the input paper's unlabeled text at inference. No test references or test-derived normalization fit training.

## Features and learner

CPU LightGBM 4.6.0 LambdaRank (binary gains), seed17, deterministic, force_col_wise, two threads, learning rate .03, no bagging/feature sampling, lambda_l2=1, max_bin=127, truncation level10, label_gain=[0,1]. Fit to known-paper, positive-global-BM25 candidate groups, excluding query groups with no candidate positive or no candidate negative from training only. Evaluation keeps all eligible questions, including candidate misses. No generated/LLM labels. No pretrained model or paid service.

Features: frozen lexical-v1 transforms, text-only global and local BM25, within-paper score and rank normalizations, section/query overlap, relative position, length and numeric/citation density, section flags, question-type/paragraph cue interactions, simple suffix-normalized coverage, best40-token-window coverage and neighbor coverage. All feature formulas/lexicons must be saved with code hashes at model freeze. They use question and document text/structure only, never reference IDs, answer text or question/paper identifiers. No test-conditioned rule changes.

Predeclared validation grid: num_leaves∈{7,15,31}, min_data_in_leaf∈{30,100}, rounds∈{100,300,600}. For each of these18 checkpoints, blend min-max normalized model score with the stronger validation BM25 baseline score, learned fraction∈{0,.25,.5,.75,1}. Compare global field-weighted BM25 (v1 formula, training-only IDF) and text-only per-paper BM25; choose the primary BM25 variant by validation paper-macro nDCG@5, retaining both in final results. Every method uses the identical positive-global-BM25 candidate pool. Rank ties by passage ID. Choose the candidate with highest validation paper-macro nDCG@5; exact ties prefer fewer rounds, fewer leaves, larger min-leaf, then smaller learned fraction. Do not refit using dev labels. Record every validation candidate, not just the winner. A no-gain validation selection must be reported rather than portrayed as a learned improvement.

## Freeze, test and success

Before opening fresh test labels, commit protocol, selection manifest, feature/training/evaluation source, validation search results, exact selected model, source/training/statistics hashes and chosen BM25 baseline to Git. Record that immutable commit and its remote push. Then evaluate fresh test exactly once. Corrections may rerun only with explicit defect/rerun disclosure, preserving original outputs; no outcome-driven tuning on this test. Release all eligible per-query rankings, partial reference IDs, misses and removal/control diagnostics.

Primary endpoint: learned-minus-frozen-primary-BM25 paper-macro nDCG@5. Secondary: MRR@5, recall@5, candidate recall and comparisons with the other BM25 variant, token coverage and the exported v1 logistic weights on v2 lexical features (diagnostic only, not a recreation of v1's corpus). Questions average within paper, then papers equally. Paired percentile bootstrap: 2,000 paper resamples, seed17; record95% interval and question/paper populations. Positive point difference is a scoped observed win; claim statistically supported improvement only if interval lower bound>0. Also report wins/ties/losses by question and paper, and all fixed removal/control outcomes. No general or official-QASPER superiority claim.

If fresh test does not beat BM25, report that fact and keep BM25 default; do not relabel validation improvement as held-out success. A further attempt requires an explicitly logged new protocol and a separate untouched test subset, while retaining all attempts and accounting for repeated testing. No promised positive outcome can override this rule.

## Public release

Deploy the actual selected model with deterministic browser tree inference, Python/LightGBM/browser score and ranking parity checks, standalone receipts and data/license attribution. Keep v1 negative study accessible. Show fresh results and uncertainty, same-pool baselines, failures and scope. Promote learned ranking to default only if fresh primary nDCG improves; qualify statistical uncertainty. RL's original study stays historical/separate; new ranking results do not imply improved RL or semantic truth verification.
