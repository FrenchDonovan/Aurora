# Aurora integration contracts — v1

This file is authoritative for the first implementation wave. Propose changes to the parent before modifying a shared interface. Use Node ES modules; no TypeScript/compiler or dependency installation is required for the first release.

## File ownership

- Frontend agent: `web/index.html`, `web/styles.css`, `web/app.js`, frontend-specific assets/tests.
- Engine/ML agent: `web/lib/engine.js`, `research/**`, `tests/engine.test.mjs`, `tests/test_research.py`, clearly named fixtures under `tests/fixtures/`.
- Data/provenance agent: `web/data/corpus.json`, `web/data/evaluation.json`, `data/**`, `docs/DATASET_CARD.md`, `docs/MODEL_CARD.md`, `docs/RELATED_WORK.md`, `scripts/validate-corpus.mjs`, `tests/data.test.mjs`.
- Parent: root files, build/serve/CI, integration, this contract, deployment and migration.
- Reviewer: `docs/PLAN_REVIEW.md` only; read other files freely.

## Corpus JSON

```json
{
  "schema_version": 1,
  "corpus_version": "seed-2026-10-16",
  "domain": "Efficient and reliable language models",
  "updated_at": "2026-10-16",
  "provenance_note": "Curated short source excerpts and separately labeled original notes. Not full-paper indexing.",
  "papers": [{
    "id": "paper-lost-middle",
    "title": "Real verified title",
    "authors": ["Verified author"],
    "year": 2023,
    "url": "https://arxiv.org/abs/2307.03172",
    "version": "v3",
    "accessed_at": "2026-10-16",
    "license": {"status": "unknown", "id": null, "source_url": null},
    "topics": ["long context"],
    "curator_note": "Original, accurately scoped description."
  }],
  "passages": [{
    "id": "passage-lost-middle-1",
    "paper_id": "paper-lost-middle",
    "text": "An exact short excerpt copied from the verified source.",
    "section": "Abstract",
    "source_url": "https://arxiv.org/abs/2307.03172",
    "text_kind": "verbatim_excerpt",
    "curator_note": "Separate original context, never represented as source wording."
  }],
  "challenges": [{
    "id": "challenge-long-context",
    "question": "Does a longer context guarantee that a model uses all the evidence?",
    "claim": "A longer context guarantees effective use of all available evidence.",
    "description": "A curator-reviewed development example, not a held-out test.",
    "development_only": true,
    "relations": [{
      "passage_id": "passage-lost-middle-1",
      "relation": "challenges",
      "rationale": "Original explanation tied to this specific claim."
    }]
  }]
}
```

All example source wording above is a schema illustration, not actual source evidence. Real excerpts must be verified. No more than 25 verbatim words total per primary source during this implementation session. No invented quotes, paper titles, authors, IDs, license claims or findings. Use 8–12 primary papers when feasible, preferring a correct smaller seed over filler. One brief excerpt per paper is adequate. Choose papers on quantization, LoRA/QLoRA, retrieval/citations, long contexts, attention efficiency. Potential sample questions: quantization preserving accuracy; long context guaranteeing evidence use; citations guaranteeing supported answers. Verify paper associations and avoid absolute science claims.

Only `verbatim_excerpt` is permitted for source text in v1. Original paraphrases belong in clearly labeled curator-note fields. Add SHA-256 passage hashes in export/validation if feasible; do not pretend an unverified supplied hash proves provenance. Runtime challenge labels are development/demo-only and must not enter held-out metrics.

## JavaScript engine

`web/lib/engine.js` exports:

```javascript
export function createEngine(corpus, { model = null } = {}) { /* engine */ }
export function compareResults(original, stressed) { /* comparison */ }
```

Engine exposes:

```javascript
engine.available_methods // [{id: 'bm25', label: 'BM25 baseline', available: true, reason: null}, ...]
engine.ask({
  question: '...',
  method: 'bm25', // or 'learned' only with valid trained model
  excluded_paper_ids: [],
  top_k: 5,
  challenge_id: null
}) // synchronous deterministic result
```

Result shape:

```json
{
  "schema_version": 1,
  "question": "...",
  "method": "bm25",
  "corpus_version": "seed-2026-10-16",
  "model_id": null,
  "response_mode": "extractive",
  "status": "evidence_found",
  "brief": "An evidence brief derived only from the selected, cited excerpts.",
  "excluded_paper_ids": [],
  "challenge_id": null,
  "evidence": [{
    "passage_id": "p-1",
    "paper_id": "d-1",
    "title": "...",
    "authors": ["..."],
    "year": 2023,
    "url": "https://...",
    "text": "Exact source excerpt",
    "section": "Abstract",
    "text_kind": "verbatim_excerpt",
    "curator_note": "Clearly labeled original note",
    "score": 1.23,
    "score_kind": "bm25_relevance",
    "curated_relation": null
  }],
  "claims": [{"text": "Exact selected excerpt", "passage_ids": ["p-1"], "kind": "extractive"}],
  "limitations": ["Curated abstract/excerpt collection, not a complete literature review.", "Relevance scores do not measure truth or entailment."],
  "diagnostics": {"distinct_papers": 1, "candidate_count": 1, "elapsed_ms": 0.5, "gate": "heuristic_v1"}
}
```

Status enum is `evidence_found` or `insufficient_evidence`. This pre-release naming correction was accepted after independent review: it records retrieval availability, never that a question has been answered. Insufficient results have an explicit corpus-limited brief and empty claims; evidence may be empty. No hidden LLM calls. Do not imply semantic support/verification from query relevance. `curated_relation` is `{relation, rationale, review}` only if the requested challenge ID exists AND the normalized question equals its stored question; `review` preserves the challenge review provenance and never assumes independent human review. Editing a sample clears that privilege; arbitrary queries get null relations. Filter source exclusions BEFORE retrieval and synthesis. No excluded source may appear in any evidence, claim reference, brief or export. Reject invalid input, unknown exclusions and unsupported modes with understandable errors; UI catches and renders them.

The engine may add extra optional result fields but must preserve these. `compareResults` returns `{removed_paper_ids, added_passage_ids, removed_passage_ids, retained_passage_ids, passage_jaccard, status_transition}`. Empty/empty Jaccard = 1. Timing is diagnostic and excluded from deterministic comparisons. A score is labeled relevance, never confidence.

## Model artifact / offline training

The engine/ML owner defines an exact frozen feature list and identical Python/JS implementation, writes it in `research/README.md`, and adds parity fixtures. Artifact has `schema_version`, `model_id`, `algorithm`, `feature_version`, `feature_names`, `weights`, `bias`, transforms, training provenance, dataset hash, seed and pilot/synthetic flags. No model is available by default. Hand-set weights must not appear as learned. Optional artifact file is absent until actually trained from declared data. Synthetic unit fixtures must be under `tests/fixtures/` only.

Judgment files are JSONL, one `{query_id, question, question_family, passage_id, relevance, split, annotator, synthetic}` per row. `relevance` is 0/1/2; `split` is train/validation/test. Trainer uses train only and validation for reported development measurements. Reject overlapping question families across partitions and unknown passage IDs. A separate source-family-disjoint evaluation is a later protocol, not something to claim based on query splits.

Contract clarification approved by parent: export of a non-synthetic trained artifact additionally requires each judgment's `reviewed: true` and nonempty `label_provenance` explaining its human review. A script-generated label is not human review. Feature version `aurora-lexical-v1` orders `[log1p_bm25, passage_coverage, title_coverage, bigram_coverage, token_jaccard, length_saturation, numeric_coverage, tag_coverage]`; full transforms/model protocol live in `research/README.md`. Browser inference rejects synthetic model artifacts and incompatible feature/corpus signatures. No production learned artifact is supplied before reviewed training.

## Evaluation artifact

Initial `web/data/evaluation.json`:

```json
{"schema_version":1,"status":"not_run","title":"Research evaluation","note":"No held-out study has been completed.","metrics":[],"runs":[],"engineering_checks":[]}
```

No made-up metric values. Tests validate code behavior; they are not real model performance. If an actual pilot runs, keep it separate from this unmeasured confirmatory artifact unless it is explicitly labeled with the complete provenance.

## Integration and build

`web/index.html` loads `./app.js` as a module; app fetches `./data/corpus.json` and `./data/evaluation.json`, imports `./lib/engine.js`, and treats a missing model as unavailable. Relative paths must work at a hosted root. No remote fonts, analytics or CDN dependencies for v1. No service worker needed.

Deployment integration correction: app also loads `data/runtime.json` (`schema_version:1`, `model:null` or `{url:'./data/model.json'}`). Build derives this declaration from the existence of an approved model artifact. A declared absence skips the request entirely, because some static hosts return index HTML with HTTP 200 for missing assets. Rejection messages stay understandable and do not expose raw parser details.

Parent's `scripts/build.mjs` copies only `web/**` into `dist`, excludes test-only data, and rejects production files containing held-out labels or credentials. `scripts/serve.mjs` serves `dist` on loopback with path containment and correct MIME types. `package.json` sets `type: module`, commands `build`, `test`, `start`; Node built-ins suffice. Browser/ML versions and public-access status must be reported honestly.
