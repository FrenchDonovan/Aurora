# Aurora QASPER pilot: frozen protocol v1

Declared 20 October 2026, before locally inspecting question/evidence labels or outcomes. This protocol is a bounded portfolio pilot, not an official QASPER leaderboard run. Freeze its SHA-256 in the experiment manifest. Source is Ai2 QASPER v0.3, dataset CC BY 4.0 (see THIRD_PARTY_NOTICES.md). Original paper licensing is separate.

## Selection and leakage boundaries

Use the 64/16/32 papers with smallest SHA-256(`aurora-qasper-v1:` + paper ID) in the official train/dev/test partitions respectively. Never select based on questions, labels, relevance or performance. Preserve official partitions; validation maps to dev. Include nonempty full-text paragraphs at most 12,000 characters, deduplicated by whitespace-normalized text within paper. Do not import floats or figures as paragraphs. Preserve all selected papers and report all exclusions and unmapped annotations. No semantic label creation or human adjudication by Aurora.

Group questions by paper. Keep first occurrence of a whitespace/NFKC/lowercase-normalized question across papers/partitions, in train, validation, test order, then paper ID and question ID order; report duplicates. Exact duplicated paragraph text across partitions is audited and reported; no claim of topic/semantic independence. All papers' unlabeled text contributes to frozen IDF: this is a transductive fixed collection with paper-disjoint labels, not unseen-document generalization.

Use every question with at least one human evidence paragraph that maps exactly after whitespace normalization and at least one answer annotation not marked unanswerable. Positive labels are the union of mapped evidence from non-unanswerable annotators. Nonselected paragraphs are assumed negatives; annotations are partial, not exhaustive relevance judgments. Queries without mapped textual positives are counted separately and excluded from ranking denominators. Report mixed answerability and incomplete evidence mapping. Do not optimize eligibility after seeing results.

## Supervised learner and comparisons

Eight frozen aurora-lexical-v1 features; binary regularized logistic regression, zero initialization, seed 17, 400 full-batch epochs, learning rate 0.1, L2 0.01. Train labels only; validation is descriptive, with no parameter/model selection. All eligible train query–paragraph pairs are training rows. Save training-data hash, model and protocol hashes before opening test annotations. Test is evaluated once with these settings; subsequent code corrections must disclose reruns.

Known-paper paragraph retrieval, not open-domain QA. All methods share positive-BM25 candidates inside that paper and fixed full-collection statistics. Compare BM25, paragraph query-token coverage, and learned logistic score. Rank ties by passage ID. No score is truth confidence. At k=5 report nDCG, reciprocal rank, recall and candidate recall. Average questions within paper, then equally average eligible papers. Paired 95% percentile bootstrap, 1,000 paper resamples, seed 17, for learned-minus-BM25 nDCG and recall. Publish every eligible test query, reference IDs and top rankings; don't select only wins. No generated answer F1, official benchmark equivalence or causal claim.

## Removal atlas

For every eligible test query, remove all mapped reference paragraphs before ranking, leaving IDF fixed. Matched control removes the same number of nonreference paragraphs, sampled with seed from SHA-256(question ID + `:control`); if fewer controls exist, record count mismatch. Record top-five set retention and original-denominator reference recall for both interventions. Reference removal recall is zero by construction, not a scientific discovery. Inspect surviving candidate text and expose unfavorable/zero-recall cases alongside improvements. These are sensitivity diagnostics against partial annotation, not proof that remaining text cannot answer.

## RL audit

For the first 20 eligible test queries sorted by SHA-256(`aurora-rl-v1:` + question ID), use each paper's first eight BM25 candidates as a bounded environment. Train independently per question, seeds 1, 7, 17, 42, 99, 3,000 episodes, alpha .2, gamma 1, existing epsilon schedule, budget 3, cost .15, lexical coverage weight 3 and redundancy .25. Compare learned, myopic greedy, exact subset optimum, and existing seeded 200-rollout random baseline. Publish per-run returns, regret, visited state/action pairs, TD updates and descriptive runtime. Report reference recall for policy selections to probe reward mismatch. No transfer/generalization claim: training and evaluation share each environment. Preserve ties and failures; exact and greedy may dominate RL.

## Release and interpretation

No parameter tuning to force improvement or an 8/10 review. Negative results are publishable. Release data/model/source fingerprints, eligibility counts, leakage audit, per-query results, code, commands and limitations. Once test labels/results are public, this subset becomes a development resource for future changes; a later confirmatory claim needs a new untouched test set. The original eight-excerpt demo is separate and not validated by this study.
