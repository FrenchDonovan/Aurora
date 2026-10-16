# Pilot annotation protocol — not collected labels

Version 1, 2026-10-16. No reviewed human relevance judgments exist yet. Do not train on the three public development challenges or reinterpret their claim relations as general relevance gold.

1. Define a question family before looking at model rankings. Keep paraphrases together. Record the library version and whether the question is answerable from the actual indexed excerpts rather than an imagined full paper.
2. Assemble a fixed pool including lexical candidates, alternatives, hard same-topic negatives, irrelevant controls and absent-evidence questions. Label omissions in pool coverage explicitly. For this eight-passage seed, reviewing every passage per question is feasible and avoids top-k-only ascertainment.
3. A human annotator reads the question, excerpt, source context and full primary link when necessary. Relevance grades: 0 = no useful information for the requested detail; 1 = contextual or partial information; 2 = directly useful information. Same topic alone need not be 1. Grade relevance separately from support for an atomic claim and separately from source truth.
4. Preserve disagreements and uncertainty. Ask another human to review a declared subset if possible; report agreement, adjudication rules and counts. AI-proposed labels remain proposals and are not marked reviewed unless a human actually checks them.
5. Assign splits by family before tuning; every paraphrase stays together. Fixed-library evaluation may share papers across splits. A different source-family-disjoint study is needed for unseen-paper claims. Exclude public demo families from confirmatory tests.
6. Export only completed reviewed rows to a new JSONL file. Required engine fields: `query_id`, `question`, `question_family`, `passage_id`, `relevance` (0/1/2), `split` (train/validation/test), `annotator`, `synthetic` (false), `reviewed` (true), `label_provenance` (human review description). Retain rubric version, label date, source-family ID, uncertainty and adjudication in the annotation ledger even if training consumes fewer fields.
7. Freeze model/features/threshold selection on train/validation. Hash the frozen corpus, judgments and protocol. Keep final gold outside `web/`; preserve per-query predictions and failures. Report a small run as exploratory pilot rather than confirmatory evidence.

The JSON template beside this file intentionally contains null placeholders and is not a training JSONL file. Filling names, timestamps or review flags without real annotation is invalid provenance.
