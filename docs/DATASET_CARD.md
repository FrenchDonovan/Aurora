> Updated 20 October 2026: a separate real-data QASPER pilot is now released. See [the study documentation](QASPER_STUDY.md) and root README for current model/results. The original eight-excerpt seed collection remains untrained/unmeasured. The dated material below describes that original collection and pipeline; it does not negate or validate the separate study.

# Aurora seed dataset card

Version: `seed-2026-10-16`. Created 2026-10-16. Status: public development corpus; not a benchmark, a training set, or a complete literature collection.

## Composition and intended use

Eight papers, eight short abstract excerpts, and three development investigations cover adaptation, low-bit compression, attention efficiency, context position, retrieval and citations. The data support an interactive, bounded evidence-search demonstration and source-removal sensitivity exploration. They are too small and too deliberately selected to substantiate scientific coverage, automated claim verification, model superiority or broad research-answering quality.

`web/data/corpus.json` is the source of truth. Paper year is the first arXiv submission year; the pinned revision can be newer. Every paper records the complete author list, version-specific primary link, access date, topics and original context. A passage is an exact contiguous excerpt, sometimes a sentence fragment, with its source location and UTF-8 SHA-256. The source ledger records verified metadata and rights checks without duplicating excerpts. Checksums detect changes to stored bytes; they do not prove source authenticity or the truth of the finding.

The implementation agent read the current arXiv landing-page metadata and abstract for each source and confirmed the latest displayed revision matched the pinned URL on 2026-10-16. No PDF, full-text archive or author manuscript was downloaded. Exact wording is copied from the displayed abstract; the QLoRA excerpt retains its visible TeX-style marker. No ellipses or silent wording changes are inserted inside excerpt text. Original curator notes are a different field and must remain visibly labeled. Section strings identify fragments so readers can open the complete sentence.

## Primary-source inventory

| ID | Primary source and indexed version | First submission | Source-page content license observed |
| --- | --- | --- | --- |
| paper-lora | [LoRA](https://arxiv.org/abs/2106.09685v2) | 2021 | arXiv nonexclusive distribution; third-party reuse unknown |
| paper-qlora | [QLoRA](https://arxiv.org/abs/2305.14314v1) | 2023 | CC BY 4.0 |
| paper-lost-middle | [Lost in the Middle](https://arxiv.org/abs/2307.03172v3) | 2023 | arXiv nonexclusive distribution; third-party reuse unknown |
| paper-flashattention | [FlashAttention](https://arxiv.org/abs/2205.14135v2) | 2022 | arXiv nonexclusive distribution; third-party reuse unknown |
| paper-smoothquant | [SmoothQuant](https://arxiv.org/abs/2211.10438v7) | 2022 | CC BY 4.0 |
| paper-gptq | [GPTQ](https://arxiv.org/abs/2210.17323v2) | 2022 | CC BY 4.0 |
| paper-alce | [ALCE](https://arxiv.org/abs/2305.14627v2) | 2023 | arXiv nonexclusive distribution; third-party reuse unknown |
| paper-rag | [RAG](https://arxiv.org/abs/2005.11401v4) | 2020 | arXiv nonexclusive distribution; third-party reuse unknown |

## Rights and attribution

All eight source-page license links were followed. Three resolve to [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the other five resolve to [arXiv's distribution grant](https://arxiv.org/licenses/nonexclusive-distrib/1.0/license.html). That grant is to arXiv and is not treated as a Creative Commons license or an unrestricted third-party reuse grant. Those five records have `license.status: unknown` and `id: null` for Aurora reuse. The observed grant URL is retained separately from an asserted reuse permission. Metadata access is not blanket permission to republish full papers.

The seed stores no full texts and has a strict maximum of 25 quoted words per source across all passages, regardless of revision. This is an implementation quotation budget, not a legal conclusion or a substitute for rights review. Credit is the paper's title, full authors, pinned source link and recorded license. CC-licensed excerpts preserve wording; shortening is identified as excerpting, with separate original notes. The corpus has mixed source rights and no blanket CC license is asserted over it. Code licensing must not relicense source quotations. Before expanding redistribution, establish permissions for each added work/version or retain metadata and an outbound link only. Publication review should consider the five unknown-permission excerpts explicitly.

## Curation and review provenance

Topic choice and excerpt selection are convenience choices by an AI implementation agent. No independent human curator has signed off, no inter-annotator agreement has been measured, and no training labels have been collected. Each challenge includes a specific claim, a relation rationale and explicit review provenance. The rationales were source-checked against the displayed abstract by the same agent; they are development illustrations awaiting human review. They are not automatic semantic judgments for arbitrary visitor questions.

The challenge claim is deliberately narrow enough for the excerpt to bear on it. The quantization example uses two distinct methods as bounded counterexamples to an absolute loss claim; it does not equate their settings. The long-context example concerns the evaluated model/task settings. The citation example preserves ALCE's benchmark-specific scope. Removing a source changes available indexed evidence, not scientific truth.

## Leakage and future annotation

All shipped challenges have `development_only: true`. They must never appear in confirmatory evaluation. No train, validation or test partitions exist yet; there is no production learned model. `data/judgments/ANNOTATION_PROTOCOL.md` defines how to create legitimate labels. Its template has null labels and `reviewed: false`, and is intentionally not a trainable JSONL file.

Later primary splits must group paraphrases by question family and compare new questions on the fixed library. They do not measure unseen-paper transfer. A separate source-family-disjoint protocol is required for that claim. Keep held-out gold outside `web/` and deployment bundles. Publish dataset hashes, group counts, annotation coverage, uncertain judgments and adjudication decisions before measuring performance.

## Known limitations and update policy

English-only, technical, historical and agent-selected abstracts overrepresent recognizable positive method papers. There is little negative replication evidence, no systematic literature-search protocol, and almost no evidence for detailed questions about settings, error bars, datasets or recent methods. Very short fragments can omit conditions; source-specific notes help navigation but cannot replace complete primary reading. Lexical matches can occur without answerability. Source findings, including numbers inside quotations, are not Aurora results.

To update: source-check metadata/version and exact wording; inspect the license link; preserve attribution and a no-more-than-25-word aggregate source budget; review notes and challenge scope; recompute passage hashes and source ledger; increment the corpus version; rerun validation/tests; then independently inspect the public rendering. New rights or corrections must be recorded as new provenance, not silently overwritten.

Validation command: `node scripts/validate-corpus.mjs`. Data tests: `node --test tests/data.test.mjs`. These are engineering integrity checks, not remote revalidation or scientific evaluation.
