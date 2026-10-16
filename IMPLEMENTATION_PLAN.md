# Aurora — Evidence Stress Lab

## Implementation plan, version 1.1 — revised after independent challenge

Date: 2026-10-16 (Europe/Berlin). Status: implementation specification; no research results claimed. Owner: the user. Product goal: a public, interactive website that a CV reader can use without creating an account, installing software, supplying an API key, or reading the repository.

The previous coding-agent prototype will be preserved as legacy work. It is not the new product, its tests are not evidence for this product, and its synthetic results must never appear in this product's benchmark dashboard.

## 1. Product thesis

Aurora helps a visitor investigate claims about efficient and reliable language models. It exposes the relationship between an answer, the passages cited for it, and what happens when those passages disappear. Its defining interaction is to remove a paper from the available evidence and rerun the same question.

The public-facing proposition for the engineering preview is: **Ask a research question. Inspect the evidence. Stress-test the evidence set.** A later validated assistant may synthesize answers; the initial extractive lab does not claim to answer every retrieved question.

This is an evidence exploration and experimental transparency product. It does not establish scientific truth, replace a literature review, or certify that an answer is hallucination-free. Source relevance, source support, source agreement, and the truth of a proposition are separate concepts throughout the implementation.

The first release provides a genuine live retrieval-and-synthesis interaction over a curated corpus. It accepts new questions; it is not just a video, animation, scripted answer lookup, or replay. Extractive synthesis is the dependable default. An optional generative mode may be added only when its cost, claim checking and failure behavior are implemented and tested.

## 2. What makes the work distinguishable and verifiable

| Contribution | Visitor can verify | Research/engineering artifact | Failure condition |
| --- | --- | --- | --- |
| Evidence-removal interaction | Exclude a paper and observe a live rerun | Paired original/ablated trace with identical settings | A visual toggle does not actually alter retrieval |
| Answer provenance | Open each source and its exact excerpt or clearly marked curator note | Versioned source/passages manifest and checksums | Unsupported sentence presented as an exact quote |
| Honest uncertainty | Ask an unsupported question and inspect an explicit limitation | Abstention/risk-coverage evaluation | A high retrieval score is displayed as truth confidence |
| Comparable systems | Switch BM25 and a legitimately trained ranker on the same input | Frozen features, training manifest, ablation report | Hidden changes in corpus, thresholds or budgets |
| Reproducible experiments | Download a JSON/Markdown run receipt | Corpus/model/code hashes, exclusions, result IDs | Irreproducible cached output presented as a live run |
| Inspectable limitations | View a public failure gallery and data provenance | Model card, dataset card, actual failed cases | Placeholder metrics or fabricated positive results |

None of these individual ideas is asserted to be a first-ever research invention. The claim of originality will concern Aurora's implemented interaction, curated challenge set, experimental design, error analysis, and measured outcomes. Maintain a related-work table and include additional overlapping systems discovered during review. A distinctive combination must still produce useful behavior and withstand evaluation.

## 3. Related work and boundaries of the novelty claim

ALCE evaluates cited generation, ARES studies automated RAG evaluation, RAGChecker diagnoses retrieval/generation at fine granularity, and SciFact supplies scientific claim-verification data. CUE-R (2026) already studies removal/replacement/duplication of evidence, and Pair-ID (2026) audits paired evidence interventions with controls. Aurora must credit these antecedents. Their existence rules out a credible claim that citation verification, evidence removal, or RAG evaluation itself is new.

Aurora's proposed differentiator is a small, accessible public lab in which evidence removal, corpus boundaries, source selection, result provenance, and comparative experiments are exposed directly. Whether the associated retrieval/abstention intervention is effective remains a hypothesis. Do not claim a new verification algorithm before an actual method and comparison exist.

Create `docs/RELATED_WORK.md` with columns: system, exact primary reference, overlapping capability, what Aurora reuses, what it implements differently, and what remains unverified. Review at initial delivery and before publishing any novelty claim. Never equate a search that finds no identical website with proof of novelty.

## 4. Intended audiences and the first minute

1. A nontechnical CV reader needs a clear problem, one successful interaction, and an explanation of the author's contribution.
2. A technical hiring reviewer needs to inspect sources, compare methods, see architecture and evidence, and discover limitations without setup.
3. The author needs experiment tools, data provenance, and learning material sufficient to explain every claimed result in an interview.

Design the landing screen around the working application. The visitor should see a question field, three meaningful sample investigations, the corpus scope, and a short statement of what the system actually does. Avoid a large decorative hero that pushes the experiment below the fold. Do not require a tour before trying it.

Target path: open site -> choose a sample or enter a question -> inspect 3–6 relevant passages -> remove one source -> compare changes -> optionally open the methods/evaluation view. Time goals in this plan are engineering targets, never statements about observed recruiter behavior.

## 5. Scope and release ladder

### R0: working public-interface foundation

- Responsive source-grounded application with live lexical retrieval in the browser.
- Curated seed corpus with verified URLs and brief exact excerpts; scope conspicuously bounded.
- Evidence cards, source drawer, exclusions, rerun, original/ablated comparison, and export receipt.
- Extractive synthesis that cannot invent a new empirical claim and cites every included excerpt.
- Clear unsupported-query behavior, model availability indicators, provenance and error states.
- Corpus validation, retrieval tests, exclusion invariants, training/evaluation scaffolding, accessibility smoke checks.
- No paid service, inference key or always-on Python server is required for this release.

### R1: meaningful ML experiment

- A CPU-trained relevance ranker on human-reviewed query/passage judgments.
- Grouped splits, frozen validation procedure, model manifest and browser/Python inference parity.
- BM25 and learned reranking comparison, query-level metrics and documented negative cases.
- Held-out evaluation after feature/threshold selection; no automatic claim of improvement.
- An independent test inventory and sufficiently reviewed labels to support a claim beyond a smoke demonstration.

### R2: research-grade expansion

- Corpus expanded beyond the seed; passage extraction evaluated for quality.
- Calibrated selective-answer policy if enough adjudicated data exists.
- Optional compact embedding model and optional CPU PyTorch ranker, each with matched controls.
- Evidence-removal challenge set, genuinely relevant distractors and paraphrase robustness tests.
- Human-supported citation/support evaluation; disagreement resolution and uncertainty intervals.

### R3: optional generative synthesis

- Backend provider adapter, hard usage quotas, timeouts, logging policy and spend ceiling.
- Claim extraction/citation schema validation and a separately evaluated support checker.
- Unsupported claims removed or explicitly marked; retrieval relevance is never used as entailment.
- The no-key extractive product remains fully usable when generation is disabled or unavailable.

### R4: CV-ready release

- Public no-login URL, verified mobile/desktop flows, measured latency and operational limits.
- Real experiment results, dataset/model cards, failure gallery, complete reproducibility bundle.
- Short demo video as a secondary artifact and a concise technical case study.
- CV claims tied to existing artifacts, actual sample sizes, uncertainty and observed outcomes.

Finishing R0 does not satisfy R4. A polished R0 may be shared as an early preview, but the site must identify its actual stage. No milestone is marked complete merely because its UI exists.

## 6. Domain choice and corpus strategy

Initial domain: **efficient and reliable language models**, focusing on quantization, parameter-efficient adaptation, retrieval/citations, long-context behavior, and attention efficiency. This gives a technical reviewer recognizable questions with scope-dependent answers. It avoids making the first release a clinical or legal advice product.

Seed target: 8–12 real papers, 1–3 brief source excerpts per paper only when redistribution permissions allow. Where permissions are not established, restrict the seed to metadata, a short verified quotation under the applicable use limits, original curator descriptions, and an outbound source link. The implementation session's quotation policy is stricter: no more than 25 verbatim words total from a single source. Agents must honor that limit across every excerpt from that source.

Expanded target, contingent on rights and extraction quality: 30–60 papers, approximately 200–600 useful passages. These are planning targets, not collected-data claims. Do not pad the corpus with irrelevant papers to increase a visible count.

Each paper must have a stable ID, title, authors, year, canonical primary URL, version/revision when available, retrieval timestamp, source kind, license/provenance status, topic tags, and a curator note. Each passage needs its own ID, paper ID, source location, exact text, provenance type, source link and a text hash. Exact quotes and original curator notes are different fields and are visibly labeled.

An arXiv landing page establishes metadata and abstract text; it does not establish that every full paper has a reusable Creative Commons license. Rights are assessed per paper/version. Do not silently redistribute full PDFs or scrape publisher sites. If a license is unknown, record `unknown`; do not fill it with a guessed CC license. Store metadata access terms separately from content reuse terms.

Do not use Semantic Scholar, OpenAlex, or another third-party search API in the critical request path. Adapters can be added offline if available credentials, rate limits, licenses and provenance have been verified. The first release must work without those services.

## 7. Paper and passage ingestion

Offline ingestion stages:

1. Curator proposes canonical paper URL and intended question families.
2. Resolve duplicate IDs, versions, DOI/arXiv aliases and known retractions/corrections where available.
3. Record content rights and permitted storage/display behavior.
4. Obtain metadata and allowed text from primary sources; retain exact source version.
5. Normalize whitespace and Unicode while preserving a map back to original text.
6. Produce candidate passages at sentence/paragraph boundaries; keep section/title context.
7. Reject reference lists, navigation text, broken extraction, isolated equations and passages without sufficient context.
8. Review passages manually for the seed and audit sampled extraction for expansion.
9. Calculate stable IDs/hashes and generate the published corpus manifest.
10. Validate all references, URLs, IDs, lengths, provenance flags and attribution before promotion.

PDF ingestion is a later optional adapter. When added, process in an offline restricted job, apply file/page/time limits, store page numbers, and compare extracted text to the rendered source. User-supplied PDFs, URLs, remote fetching and OCR are excluded from R0. They create additional parsing, licensing, abuse and SSRF responsibilities and do not improve the first-minute demo enough to justify early scope.

## 8. Question types and answer contract

Supported initial interactions:

- Open question: retrieve relevant evidence and produce a short evidence brief.
- Curated challenge: show a curator-defined claim and reviewed relations for its specified sources.
- Evidence stress test: rerun a query after excluding selected paper IDs.
- Baseline comparison: rerun the same query/exclusions with another available ranking method.

An arbitrary open question must not inherit a curated challenge's support/contradiction labels merely because keywords overlap. Such labels belong to a specific, reviewed claim ID. Editing a sample question clears any challenge association. A matched challenge must use both an explicit case ID and the unchanged normalized question.

Open-query output uses terms such as `relevant excerpt`, `source scope`, and `insufficient indexed evidence`. It must not automatically label a passage as supporting or contradicting a user proposition. A high lexical or learned ranking score is a relevance score, not probability of truth, entailment or correctness.

## 9. Extractive synthesis design

The first synthesizer produces an evidence brief rather than pretending to be an unrestricted scientific author. It can introduce the retrieval scope, quote selected short passages with citations, and show original curator context in a separately labeled field. It can summarize observable metadata such as the number of distinct papers returned. It cannot infer a numerical finding or general causal conclusion not represented in reviewed material.

Preserve source qualification: population, model family, dataset, precision, hardware, benchmark, date, and whether a result is from an abstract. Avoid merging findings under different experimental settings into a single unconditional answer. For a source with only abstract evidence, explicitly say so.

Every rendered answer item carries source IDs. If a source is excluded, all its answer items disappear before the candidate brief is generated. Avoid truncating a passage into a misleading fragment. Quotation display must not quietly alter words or remove negation.

The interface should describe this mode as `Extractive evidence brief`. It must not imply that an LLM generated the answer or that automated semantic verification occurred. Making a transparent first release is compatible with later adding stronger learned components.

## 10. Retrieval baseline

Implement BM25 in a dependency-light JavaScript module with deterministic tie-breaking by passage ID. Tokenization is Unicode-normalized, lowercased, punctuation-split, and versioned. Add a small, documented stopword list and technical aliases only if included in the feature specification; avoid query rewriting that changes scientific meaning.

Index title, topic tags and passage text in explicit fields. Separate field boosts from passage frequency, and freeze weights before comparison. Return source excerpts rather than searching curator notes as if they were source evidence. If curator notes are used for candidate discovery, label and ablate that contribution.

Compute top-k over allowed passages after exclusions, not before. No excluded source can leak through a precomputed snippet, cached synthesis or fallback. Count distinct papers separately from passages. If every score is zero, return insufficient indexed evidence. A nonzero score alone is not sufficient to establish answerability; R0 uses a conservative explicitly heuristic relevance gate and labels that policy accordingly.

Use lexical baseline as an operationally useful product, not a deliberately weak strawman. Tune on training/validation only. Include queries with jargon, paraphrases, negation, comparisons, and unsupported/out-of-domain questions.

## 11. CPU learned relevance component

Initial model: a small regularized logistic or pairwise linear ranker over query/passage features, trained offline on CPU and exported as a plain JSON artifact. Implement a dependency-free training baseline; an optional PyTorch implementation follows for research comparisons and learning, not as a decorative dependency.

Proposed frozen feature family:

1. BM25 score with documented scaling.
2. Query token coverage in passage.
3. Query token coverage in title.
4. Exact technical phrase overlap.
5. Normalized unique token overlap.
6. Passage length feature with a bounded transform.
7. Numeric/precision token overlap where appropriate.
8. Curator-tag overlap as an explicitly ablated metadata feature, if available.

Exclude paper ID, query ID, source position in a gold list, manual support label, challenge answer, split label, and future evaluation outcome. Do not train the answer gate on test performance. Store all transforms/means/scales in the artifact and use identical transforms in JavaScript. Never clamp or normalize per query differently across runtimes without specifying it.

Candidate generation is shared with the BM25 baseline. Evaluate both candidate recall and reranker metrics, so missed candidates are visible. A model trained on source-derived human judgments can be real trained ML while still having a small and unrepresentative dataset. Call the first such model a pilot. Synthetic fixtures are used for tests and must not be presented as a validated relevance model.

If no legitimate trained artifact exists, the UI disables the learned mode with a plain explanation. It does not load hand-selected weights under a `trained` label. Any default heuristic weights must be identified as heuristic and kept distinct from learned artifacts.

## 12. Labeling and split protocol

Judgment unit: a question–passage pair with a relevance grade of 0 (irrelevant), 1 (partially relevant/contextual), or 2 (directly relevant). Support/contradiction labels are a separate task requiring a specific atomic claim and evidence; they must not be inferred from relevance judgments.

Store question family IDs, source-family IDs, passage IDs, annotator identity/pseudonym, labeling rubric version, label time, adjudication status, and provenance. All paraphrases of the same question belong to one group. Versions/near-duplicates of a paper belong to one source family.

Primary deployment-style split is by question family, with the same indexed corpus allowed across train/validation/test; this tests new questions over a fixed library. A separate source-family-held-out protocol measures transfer to unseen papers. Do not describe the primary split as paper-disjoint if it is not. Report both protocols separately when data permits. AI source-checking and AI-curated relations are development artifacts, never independent human adjudication; real-data model export requires explicit human-review provenance.

Seed/public demonstration questions are explicitly development data and are excluded from confirmatory test claims. Freeze final questions before tuning; keep their answer judgments out of the public runtime bundle until evaluation is complete. Runtime corpus passages may be public; gold relevance labels, challenge verdicts and model weights are different information objects.

Annotation targets for R1: approximately 80–120 question families and 800–1,500 reviewed judgments, if feasible. Reserve a meaningful final set (for example 20–30 families) only after counts and category coverage are known. These are targets, not minimums that justify low-quality labels. A much smaller pilot must be reported as exploratory. Review a subset with a second annotator where possible; report agreement and unresolved uncertainty.

Candidate judgments must include BM25 hard negatives, top candidates from alternative methods, genuinely irrelevant passages and unanswerable questions. Do not make negatives trivially different by topic. Avoid evaluating only cases a method retrieved, since that hides missed evidence. Keep a predeclared judgment pool and report incomplete judgments.

## 13. Answerability and abstention

R0's decision is heuristic and communicates the indexed corpus boundary. Phrase a refusal as `I don't have enough relevant evidence in this indexed collection`, never `no evidence exists` or `the claim is false`.

For R2, learn or calibrate an answerability gate using labeled answerable and unanswerable questions on training/validation. Evaluate precision/coverage and selective risk, not just refusal count. Candidate thresholds are selected by a predeclared validation policy. Do not let a gate appear improved simply by refusing every difficult query.

Negative controls include missing-topic questions, related but absent details, false premises, questions requiring unavailable full-text content, and queries where only the title matches. Hold out negative-control question families as well as positive ones. Ensure exclusions can turn an answerable case into an insufficient-evidence case without implying that the scientific truth changed.

## 14. Evidence stress test

Input is an existing question, method configuration, full corpus version and a set of excluded paper IDs. Keep the ranking method, threshold, synthesis rules and random seed fixed. Rerun after exclusion. Do not merely hide an evidence card while retaining the excluded source in the answer or cache.

Show: removed sources; retained/new evidence; distinct-source count; answer/brief changes; whether the result abstained; retrieved-passage overlap; and optional rank displacement. A concise textual explanation must accompany colors. Use the label `evidence sensitivity` rather than `causal influence`.

Metric definitions:

- Source reliance indicator: whether removing a paper changes selected answer items or availability status.
- Retrieval overlap: Jaccard overlap of returned passage IDs, with the empty/empty case specified.
- Retained-source ratio: proportion of original distinct sources still returned.
- Retrieval-availability transition: evidence_found -> evidence_found, evidence_found -> insufficient_evidence, insufficient_evidence -> evidence_found, insufficient_evidence -> insufficient_evidence. The pre-release `answer` status was removed after review because retrieval does not establish that a question was answered.

A changed answer is neither automatically good nor bad. A robust answer can survive removal because independent evidence exists; an unchanged answer can be a defect if it retains unsupported text. Evaluate source-removal invariants automatically and assess desirable behavior with reviewed challenge labels.

An adversarial demonstration using a fabricated passage must remain in a separate clearly labeled synthetic stress dataset. Do not insert it into the real-paper corpus. A future misleading-source experiment requires ground-truth relevance/support judgments and a predeclared scoring policy.

## 15. Comparison and experiment matrix

| ID | Candidate generation | Ranking | Answer gate | Purpose |
| --- | --- | --- | --- | --- |
| A | BM25 | BM25 | Fixed heuristic | Working lexical control |
| B | Same candidate set | Trained linear ranker | Same heuristic | Isolate reranking change |
| C | Same as B | Same as B | Validation-calibrated gate | Isolate selectivity change |
| D | Optional dense/hybrid candidate set | Best frozen ranker | Frozen gate | Separate candidate-recall experiment |
| E | Corpus text-only candidate scoring, with title/tag contributions removed at every stage | Ranker without title/tag/curator metadata features | Same evidence gate, also text-only for this ablation | Test the complete metadata pathway rather than only its final feature |

Only A is required for the initial website. B requires a real trained artifact and provenance. C/D/E are separate experiments, not implementation checkboxes. A generative model is a further factor and must not be added simultaneously while claiming an effect from reranking alone.

Keep corpus, candidates when isolating ranking, top-k, query set, hardware, latency measurement method and rendering/synthesis fixed. Save raw per-question predictions before aggregate analysis. Include all predeclared questions and all failures; report crashes and exclusions explicitly. No cherry-picking the better run or selecting a favorable corpus version after evaluation.

## 16. Evaluation metrics and statistical reporting

Retrieval: Recall@k, MRR, nDCG@k with graded relevance, candidate recall, per-category performance and judgment coverage. State whether the unit is passage or paper and whether multiple passages from one paper count separately. Primary retrieval metrics cover questions with judged relevant evidence; do not assign zero retrieval quality to unanswerable questions and mix them into that average. Report their counts and behavior in the separate abstention/negative-control study. Distinguish relevance grade 1 (contextual) from grade 2 (direct); report a grade-2 recall sensitivity analysis.

Evidence brief: source validity (citation points to existing evidence), exact-quote integrity, coverage of answer items by citations, support judged on reviewed examples, and scope qualification errors. Source validity is not semantic faithfulness. Extractive copying can improve citation integrity without establishing that the passage answers the question.

Abstention: coverage, answerable-question recall, unsupported-answer rate on adjudicated cases, and risk-coverage curves. Compute at the question-family level and report uncertainty.

Stress behavior: excluded-source leakage rate (must be zero), appropriate abstention on removed-critical-evidence challenges, response to independently supported evidence, and sensitivity distributions. A selected illustrative case is not a population metric.

Operational: bundle size, first-load time, time to first usable result, cold/warm computation latency, p50/p95 over a named workload, browser/device, memory proxy where measurable, and error rate. Separate client download time, local computation time and optional backend/provider latency. Local no-API inference has no provider charge, but hosting and energy costs are not universally zero.

Use paired query-family bootstrap intervals with a fixed published seed for metric differences where sample size permits. Report both absolute scores and differences. Keep the full distribution and per-question results downloadable. Bootstrap intervals from a tiny convenience sample do not establish broad generalization. Predeclare the primary metric and avoid framing a post-hoc selected metric as confirmatory.

## 17. Public results policy

The evaluation panel reads a versioned results artifact containing status (`not_run`, `pilot`, `validated`), dataset IDs/hashes, split protocol, counts, code/model/corpus versions, timestamps, hardware and measurements. `not_run` renders as `Not measured yet`, never 0%. `pilot` is visibly labeled. Never fill charts with invented plausible values.

A release with only fixture tests displays engineering checks separately from ML performance. A learned model's training loss is not a retrieval benchmark. Precomputed benchmark results are legitimate if they describe actual offline runs and their configuration; they must not be described as the current visitor's query.

Publish an explicit failure gallery: a paraphrase retrieval miss, a related-topic false positive, an evidence gap after removal, and a qualification error if observed. Identify observed versus constructed failures. Show fixes and regressions across versions without erasing the original record.

## 18. User experience and visual direction

Direction: editorial research instrument, with a warm near-white reading surface, charcoal text, restrained aurora-green/blue accents, monospaced provenance labels, generous reading widths, and clear emphasis on the question and evidence. Avoid generic gradient blobs, fake dashboards, decorative metrics and dense engineering logs in the primary flow.

Desktop layout: compact identity/navigation, query composer and sample cases, evidence brief in the main column, source/provenance panel in a side column, and a stress-test comparison below or alongside at sufficient width. Small screens stack query, answer, evidence and comparison, with no horizontal scrolling required for core actions.

Primary controls: Ask; sample question; baseline/learned method when available; open citation; exclude/include paper; reset exclusions; compare original and stress result; export run; inspect corpus; open methods/results. A visitor should not need to understand BM25 before asking a question. Explain technical details at the point they help evaluate a result.

Required states: initial; loading/index preparation; ready; no match; limited evidence; error; invalid/too-long question; all sources excluded; learned model unavailable; selected citation missing; exported receipt complete; storage/network failure; stale/incompatible dataset. Focus and announcements must make each state understandable to keyboard and screen-reader users.

## 19. Accessibility and interaction requirements

Use semantic headings, landmarks, labels, native buttons and form submission. Maintain visible focus, logical tab order, sufficient contrast and adequate touch targets. Source drawers/dialogs must have an accessible name, focus containment if modal, Escape dismissal and return focus. Status updates use appropriate live regions without announcing every token.

Provide text labels for support/qualification/status colors and do not rely on hover. Honor reduced motion and avoid unnecessary animations. Exclusions are represented in text and keyboard-operable. Long titles, long queries, code-like text, Unicode, empty corpus and narrow screens must not break layout.

Target WCAG 2.2 AA for the release, with automated checks plus manual keyboard and screen-reader spot checks. An automated scan alone is not a compliance certification. Native browser interaction tests must exercise actual form and source controls, not only confirm an HTTP 200.

## 20. Architecture and hosting decision

R0 is a buildless static site with browser-executed retrieval, using ES modules and immutable JSON assets. Offline Python tools produce validated corpus/model/evaluation artifacts. This suits CPU-only development, avoids a paid inference dependency and keeps the public demo operational when the author's computer is off.

Production paths:

```text
Offline primary sources + curator judgments
    -> validated, versioned corpus/model/evaluation export
    -> static website assets
    -> visitor browser: index -> query -> ranked evidence -> extractive brief
                                      -> exclude paper -> rerun -> compare/export

Optional later service:
browser -> bounded synthesis API -> approved model provider
                    -> claim/citation checks -> same public answer contract
```

The first hosting candidate is the installed Sites workflow for a static deployment. Sites ownership/default audience and availability must be read from returned native tools. A successful private preview does not satisfy the public CV-link requirement. Public no-login behavior must be checked independently before calling R4 complete. The source remains portable to another static host if the deployment service is unavailable or account constraints apply.

Do not run Python, a local model, PDF parsing, or large ML weights inside a Cloudflare Worker. If a backend becomes necessary, host it separately or implement a small HTTP-only gateway within verified platform limits. The selected Sites skill documents a 128 MB Worker isolate; current platform limits must be rechecked at backend design time.

Avoid a framework solely for appearance. Upgrade to a component framework only if interaction complexity justifies installation/build/runtime costs. A clear modular vanilla implementation is an intentional architecture choice, not a claim of ML novelty.

## 21. Repository and migration layout

Canonical user location remains `C:\Users\donov\Downloads\Aurora`. Implementation may be staged in the writable Codex workspace and synchronized after checks, because Downloads is outside the session's default writable roots. Preserve the original prototype before migration; do not overwrite unrelated user changes.

```text
Aurora/
  README.md
  IMPLEMENTATION_PLAN.md
  AGENTS.md
  web/
    index.html
    styles.css
    app.js
    lib/engine.js
    data/corpus.json
    data/model.json                # only if legitimately trained; otherwise absent
    data/evaluation.json
  research/
    __init__.py
    features.py
    train_ranker.py
    evaluate.py
    validate_corpus.py
  data/
    judgments/                    # public dev/pilot; held-out gold kept out of runtime
    manifests/
  tests/
    engine.test.mjs
    test_research.py
    integration.test.mjs
  scripts/
    serve.mjs
    validate.mjs
    build.mjs
  docs/
    CONTRACTS.md
    DATASET_CARD.md
    MODEL_CARD.md
    RELATED_WORK.md
    EXPERIMENT_PROTOCOL.md
    RELEASE_CHECKLIST.md
    PLAN_REVIEW.md
  artifacts/
    evaluation/
    models/
  legacy/coding-agent/            # original project preserved, excluded from deployment
  .github/workflows/ci.yml
  .openai/hosting.json             # native identity only after actual Site registration
  dist/                           # generated deployable web only
```

Agents must not publish legacy traces, local paths, private judgments, planning notes or credentials into `dist`. Build uses an explicit allowlist. Copying the whole repository into a deployment archive is forbidden by the project design.

## 22. Contract and schema versioning

`docs/CONTRACTS.md` is the implementation contract and is written before agent dispatch. Corpus `schema_version` starts at 1; model `schema_version` starts at 1; result `schema_version` starts at 1. Readers reject unsupported versions with a user-visible error. IDs are stable within a corpus version, and a model records the feature/corpus/training hashes it expects.

Corpus root: version, domain, updated date, provenance declaration, papers, passages and curated challenges. Paper/passages have separate stable IDs. Curated challenges contain a reviewed claim/question and optional explicitly curated relations. They are not training labels unless included in a declared training dataset.

Engine entry point is an importable pure JavaScript factory receiving validated corpus data and optional model data. It returns the same result schema for baseline and learned modes. Exclusions, ranking configuration, source items and evidence availability are explicit. The UI owns rendering; the engine owns ranking, selection and exclusion invariants. Tests can run the engine under Node without a browser.

No agent may change a cross-agent contract unilaterally. Send a specific proposed change to the parent with affected files and tests. Parent resolves and communicates changes to all owners. Unknown optional fields must not silently become required for another agent.

## 23. Artifact and reproducibility receipts

Each exported run receipt includes app version, corpus version/hash, method name, model identifier/hash if used, feature/tokenizer version, original question, exclusions, result passage IDs, selected-source count, response mode, decision status, limitations, timing type and optional browser environment. Hashing uses a specified canonical serialization; timestamps are excluded from content hashes.

Export JSON for reproducibility and a readable Markdown brief for sharing. No PDF export is necessary for R0. Content must be generated from current result state; exports must not accidentally use stale original evidence after an ablation. Do not embed user-agent fingerprints or persistent tracking IDs.

Model manifests include actual optimizer, seed, train/validation groups, feature ordering, scaling, data hash, training code version, iterations/stopping rule and whether data are synthetic/pilot/reviewed. Results files include enough information to rerun comparison and identify corpus/model incompatibility.

## 24. Data privacy, application security and abuse controls

The static release sends no questions to a model provider. Paper source links navigate normally; explain external navigation. Do not add analytics or remote fonts that silently undermine a `local query processing` claim. Queries remain in memory unless the visitor explicitly exports a receipt; optional local persistence must be opt-in and clearable.

Treat questions, paper titles, excerpts, curator notes and imported JSON as untrusted text. Use safe text rendering, never concatenate them into HTML. Source URLs are restricted to HTTPS and approved source domains during validation, and links use appropriate external-link protections. No arbitrary user HTML, PDF/URL fetching or server-side execution is in R0.

Optional backend: strict request schema/size limits, per-origin rate limits, concurrency cap, server-side secrets, request timeout, provider spend limit, cancellation, and a no-content-logging default. CORS is not authentication or an abuse-control system. Prompt injection in retrieved content is treated as source data and evaluated; it is not solved by a system prompt alone.

Keep deployment credentials in session memory, pass through supported stdin mechanisms, never write them to repository files, terminal arguments, screenshots, logs or planning documents. No agent can access production credentials or publish independently. Only the parent owns deployment and source synchronization.

## 25. Performance and cost targets

Initial targets on a named contemporary desktop browser: static compressed asset budget under roughly 1 MB for the seed release, usable query interface within 2 seconds on a normal connection, and warm retrieval/brief construction under 250 ms for the seed corpus. These are targets to measure and adjust, not promised results. On lower-end mobile, preserve responsiveness by indexing in a worker if profiling justifies it.

Measure startup separately from query execution. Debounce only where needed; explicit Ask is adequate initially. Cache the built index by corpus version in memory. A result cache key includes normalized question, complete exclusion set, corpus/model versions, method and relevant thresholds. Never use a cache that ignores exclusions.

No paid resource is provisioned without an explicit budget decision. Static deployment availability does not imply free generative inference, guaranteed uptime, custom domains or unlimited traffic. The no-paid-service release should be usable indefinitely within actual hosting account limits; check those limits before public promotion. Save hosting/account requirements as an operational note, not marketing claims.

## 26. Failure handling and operational visibility

Local structured development logs identify schema mismatch, missing corpus, missing model, zero evidence, invalid exclusions and export failure. Public UI explains actionable failures without leaking local paths, stack traces or secrets. A broken learned model disables that mode explicitly and leaves baseline available; the mode label must not silently change beneath a visitor's selected comparison.

Static service outage: a separately hosted release artifact or local instructions remain useful, but a video backup is not a replacement for a claimed live demo. Corpus/model updates are atomic deployable versions. A corrupt/new incompatible artifact must not partially replace a working release.

If privacy-respecting aggregate analytics is later added, use explicit disclosure and collect no raw query text by default. Measure application errors without persisting sensitive paper questions. Define retention and deletion before adding server persistence.

## 27. Test strategy

Unit tests: tokenizer technical terms and Unicode; BM25 known ordering; deterministic ties; all-zero query; exclusions before ranking; no source leakage; no duplicate IDs; invalid URLs/schema; exact quote/provenance field integrity; feature transforms; model serialization; deterministic training; metric edge cases; correct unsupported-query behavior.

Integration tests: corpus loads -> new query produces evidence -> source excluded -> result/export contain no excluded IDs -> reset restores original deterministically. Learned mode with an absent/incompatible artifact is unavailable. A mutated challenge text loses curated stance labels. Model Python/JavaScript scores match to a stated tolerance on fixed fixtures. Build allowlist excludes legacy/private files.

UI tests: ask via button/Enter; sample populates and executes; keyboard-only source opening and exclusion; mobile stacking; focus restoration; all-source removal; loading/error/empty states; citation navigation; readable exports; reduced motion; no stale comparison panel. Browser QA must exercise actions, not only capture a static screenshot.

Evaluation tests: query-family split leakage detection; source-family secondary split checks; train/test near-duplicate flags; no gold labels in production assets; bootstrap determinism; missing-label accounting; no fabricated metrics when results absent. Tests on synthetic examples validate software only, not ML generalization.

CI separates fast dependency-light tests from optional PyTorch or live-provider tests. Required checks do not need a model key or network calls. Run lint only if requested or selected as a documented project requirement; syntax/test/build checks are sufficient initially. No test should merely repeat an implementation constant without checking meaningful behavior.

## 28. Deployment workflow and public-access gate

1. Parent creates/registers one Site only after the local application is recognizable and native tool requirements are known.
2. Persist returned identity through the supported helper; do not invent a project ID or duplicate uncertain registration.
3. Build an allowlisted `dist` and validate all required assets.
4. Run appropriate tests and preview the actual built output.
5. Package source/deployment artifact with the Sites source helper, passing credentials through stdin only.
6. Deploy a preview using the actual supported audience and record the returned version/URL.
7. Verify visitor behavior at the deployed URL. A private owner preview is labeled private.
8. When content and release criteria are satisfied, use supported native access controls to make the intended recruiter experience public, then verify in an unauthenticated context.
9. Preserve the previous working version for rollback and record release metadata.

Do not mark hosting complete after creating a local server or saving a source version. Only a successful deployment result plus appropriate access verification supports a public CV-link claim. If Sites access is unavailable, retain a portable validated static artifact and report the exact blocker; do not impersonate a successful deployment.

## 29. Documentation and learning deliverables

README: product purpose, current implemented stage, quick start, no-key behavior, actual limitations, deployment URL/status and precise verification commands.

Dataset card: scope, sources/versions, rights, curation, passages versus notes, judgments, split design, demographics/domain limitations where applicable, update process and exclusions.

Model card: algorithm/features, actual training data, intended relevance task, unavailable capabilities, pilot status, validation results, source of uncertainty, inference parity and licensing.

Experiment report: hypothesis, baselines, configurations, task/query inventory, raw and aggregate results, intervals, failure cases, ablations, compute/hardware, code/data/model versions and limits. Include negative findings.

Architecture walkthrough: diagrams and a trace of a single query through normalization, retrieval, ranking, evidence selection, exclusion and export. Explain every score the UI displays and why it is not truth confidence.

Interview notes: what the author implemented, what libraries/providers do, tradeoffs, what failed, why evidence-removal is diagnostic, and what the experiment actually supports. Do not prepare claims for work still planned.

## 30. Delivery backlog with acceptance gates

| Work package | Dependency | Owner | Exit criteria |
| --- | --- | --- | --- |
| P0 plan/contracts/legacy inventory | None | Parent | Detailed plan and interfaces saved before dispatch |
| P1 source corpus and provenance | P0 | Data/ML agent | Real URLs checked; brief exact quotes; schema-valid seed; no invented evidence |
| P2 engine and offline ML tools | P0; fixture before P1 | Engine/ML agent | Pure engine and meaningful tests; training/eval commands; unavailable states correct |
| P3 public interface | P0; fixture before P1/P2 | Frontend agent | Working responsive interaction against contract; evidence stress controls |
| P4 independent plan critique | P0; first concurrency slot freed | Reviewer agent | Ranked defects, counterexamples, revised gates and unresolved questions |
| P5 integration and review fixes | P1–P4 | Parent + owners | Contract-compatible integrated app; blocking review findings addressed |
| P6 verified local release | P5 | Parent | Tests/build/actual browser interaction verified; provenance inspected |
| P7 deployable preview | P6 + hosting access | Parent | Native deployment success; actual access level stated |
| P8 real judgments and pilot study | P1/P2 + manual review | Parent/author | Real labeled data, frozen protocol, honest pilot outcomes |
| P9 confirmatory/public CV release | P7/P8 + gates | Parent/author | Public no-login URL and supported portfolio claims |

The first dispatch starts P1/P2/P3. The independent reviewer critiques the entire plan, including assumptions that constrain those implementations. Implementation work can be revised; speed does not override valid review findings.

## 31. Agent ownership and concurrency

The session permits four total active agents including the parent. Three implementation agents can run concurrently. A fourth child reviewer cannot run at that same instant. Start the three requested implementation agents after saving the plan; start the independent reviewer immediately when a child finishes and frees a slot. All four requested child roles will be launched. Do not represent the capacity limit as five concurrent agents.

Frontend owner: `web/index.html`, `web/styles.css`, `web/app.js`, UI-specific assets/tests only. No edits to engine, real corpus, model weights, deployment credentials or research evaluation code.

Engine/ML owner: `web/lib/engine.js`, `research/`, engine/research tests and optional clearly named test fixtures. No edits to real corpus judgments, site styling, root docs or deployment configuration.

Data/provenance owner: `web/data/corpus.json`, `web/data/evaluation.json`, `data/`, dataset/model/related-work cards, source-validation tooling and data tests. No invented performance numbers, fake sources, unverified license labels or production learned weights. Leave the learned artifact absent until trained from declared data.

Reviewer: read-only over implementation files; owns `docs/PLAN_REVIEW.md`. Independently challenge novelty, scope, user value, licensing, truth/relevance confusion, split leakage, abstention, statistical power, hosting feasibility, security, UX and agent contract gaps. Classify blockers and give concrete remedies. The reviewer is not asked to endorse the plan.

Parent: cross-agent contracts, integration, migration, CI/build/serve, root documentation, review resolution, native Sites workflow and release claims. Review every agent result before syncing to Downloads. No child spawns additional agents or publishes externally without a specific new assignment.

## 32. Principal risks and decisions

| Risk | Early signal | Response/stop rule |
| --- | --- | --- |
| Product becomes generic search UI | Visitors cannot explain the stress test | Make evidence removal/comparison first-class and test it |
| Unique-looking feature has no evaluable value | Only selected demos look useful | Define challenge labels and report failures before claiming novelty |
| Seed too small for meaningful ML | Validation flips under one query change | Label pilot, collect better judgments, avoid significance claims |
| Curator notes leak answers | Ranker succeeds on topic tags rather than passages | Ablate notes/tags; separate corpus and gold |
| Relevance mistaken for support | UI says a source proves an arbitrary user claim | Remove automatic stance labels until reviewed/validated |
| Ablation mistaken for causal proof | Marketing calls removal causal attribution | Use sensitivity terminology and explicit limitations |
| Evidence with missing qualifications | Brief universalizes a narrow result | Preserve context; add reviewed qualification checks |
| License blocks corpus display | Paper's actual reuse terms unknown | Use metadata/link/short permitted excerpt; exclude fulltext |
| Browser and Python models differ | Scores/ranks disagree on parity set | Freeze feature order/transforms and block learned promotion |
| Hosting requires an account/paid backend | Public demo depends on private preview or local machine | Static live baseline, verify actual public access, separate optional services |
| API costs/abuse | Unbounded generation endpoint | Do not enable until quotas/spend limits implemented |
| Legacy results contaminate new site | Coding-agent success appears in dashboard | Separate legacy and deploy allowlist; validate artifact provenance |
| Plan overreaches | R0 blocked by model training or document uploads | Ship honest extractive lab first, retain explicit research gates |

## 33. Definition of an impressive completed project

The public website works from a fresh browser and lets a visitor ask a new in-scope question, inspect real evidence, alter the evidence set, and see a faithful rerun. Its distinctive interaction is functional and explained in plain language. Its learned component has declared training data and a meaningful comparison. Its results, limitations and failure examples are verifiable. Its deployment does not depend on the author's laptop being online. Its code, data and experiment receipts support the exact CV claims.

The release does not need to beat a frontier research system, use a large model, or have every proposed feature. It must do its chosen task well enough to demonstrate real engineering judgment and scientific honesty. If the learned intervention fails to improve results, a reproducible explanation is still a legitimate contribution; disguising that result is not.

## 34. Initial release checklist

- [ ] Plan and contracts saved; legacy preserved.
- [ ] Primary sources and brief quotations checked; corpus/provenance valid.
- [ ] Live new-question baseline works; no scripted-answer substitution.
- [ ] Source exclusion affects ranking, brief and export; leakage tests pass.
- [ ] Curated labels cannot attach to edited arbitrary questions.
- [ ] Unsupported/out-of-scope queries show corpus-limited uncertainty.
- [ ] Learned mode is genuinely trained and compatible, or explicitly unavailable.
- [ ] Results panel uses measured artifacts or says not measured.
- [ ] All exact quotes/notes/source links are distinguishable.
- [ ] Responsive and keyboard interactions checked on actual built site.
- [ ] Build/deployment excludes legacy, secrets and held-out gold.
- [ ] Reviewer blockers resolved or explicitly documented as release blockers.
- [ ] Tests/build and verification report saved.
- [ ] Downloads contains the actual pivoted code and preserved legacy.
- [ ] Deployment/access status stated accurately; public no-login gate checked before CV use.

## 35. Primary references consulted

These references support design constraints and related-work context, not claims that Aurora has reproduced their results.

- ALCE: https://arxiv.org/abs/2305.14627 and https://github.com/princeton-nlp/ALCE — cited generation/evaluation antecedent.
- ARES: https://arxiv.org/abs/2311.09476 and https://github.com/stanford-futuredata/ARES — automated RAG evaluation antecedent.
- RAGChecker: https://arxiv.org/abs/2408.08067 and https://github.com/amazon-science/RAGChecker — diagnostic evaluation antecedent.
- SciFact: https://github.com/allenai/scifact — scientific claim/evidence task context; no claim of dataset reuse without separate license review.
- arXiv licenses: https://info.arxiv.org/help/license/index.html — per-work/version content rights differ from metadata rights.
- Cloudflare Worker limits: https://developers.cloudflare.com/workers/platform/limits/ — verify current constraints before adding a server runtime.
- PyTorch CPU-capable training introduction: https://docs.pytorch.org/tutorials/beginner/basics/quickstart_tutorial.html — possible later training implementation, not an installed dependency claim.

## 36. Review and change control

Version 1.0 was the initial implementation hypothesis. Version 1.1 records the independent review and its accepted changes below; the separate critique remains intact. Parent records every accepted/rejected/deferred finding with rationale in a review-resolution section. Update the plan version when a material product, scientific or interface decision changes.

Progress is recorded by completed evidence, not agent activity. A file, test report, measured artifact, or verified deployment backs each completed item. Open research work remains open even if implementation agents finish their current coding assignments.

## 37. Independent-review resolutions and harder release gates

The independent reviewer was expressly asked to reject weak reasoning. Its complete findings live in `docs/PLAN_REVIEW.md`; this section records decisions rather than replacing the independent critique.

### 37.1 Novelty claim narrowed — accepted

Evidence removal already has direct research precedents: [CUE-R](https://arxiv.org/abs/2604.05467) and [Pair-ID](https://arxiv.org/abs/2608.08944). Add them to the related-work matrix. Aurora may claim original software, a reviewed dataset, an inspectable public workflow, and its actual empirical analysis. It may not claim to invent evidence ablation, establish causal attribution, or be globally unique because no identical UI was found.

### 37.2 Eight short abstract fragments are an engineering seed — accepted

The eight-paper seed demonstrates the data contract and UI. It is insufficient evidence for an impressive trained research assistant. R4 now has an explicit additional blocker: choose one narrower question domain and obtain appropriately licensed, context-preserving evidence before making assistant-quality claims. The proposed next scope is **quantization trade-offs and the conditions attached to reported efficiency/accuracy findings**, retaining broad seed topics only as development examples.

Expand this domain with approximately 12–20 suitably licensed primary works, substantive passages that preserve method, model, precision, workload, hardware and measured outcomes, and human-reviewed question/evidence labels. If rights, context or review capacity are unavailable, reduce scope and call the release an excerpt retrieval lab. Do not compensate by adding more shallow snippets or question-specific hardcoded answers.

### 37.3 Relevance availability renamed — accepted and implemented in contract

The engine status is `evidence_found`, never `answer`. Counterexamples include asking for SmoothQuant's exact benchmark hardware when the available excerpt only reports a broad speedup, or asking for medical-diagnosis accuracy when no medical evaluation is indexed. Such queries may find related text; a retrieval hit must not be described as an answered scientific question. The UI, receipts, tests and limitations must carry this distinction. A real answerability decision remains future evaluated work.

The frozen R0 heuristic requires at least one query token in the exact excerpt, at least two unique query matches across title plus excerpt when the query has at least two meaningful tokens, and at least 0.35 combined coverage. It does not use curator notes/tags for that gate. These thresholds are an engineering heuristic, not a calibrated estimate. Changing them for a sample must trigger a version update and broad regression tests; no per-sample override is allowed.

### 37.4 Relation provenance retained end to end — accepted

Curated relations carry their review object from corpus to engine to UI/export. Current seed relations explicitly state independent human review is false. If review fields are absent, never infer independent human review. The sample claim, relation rationale and non-adjudicated status travel together. Generated annotations cannot become human gold because a file says `reviewed` without actual review.

### 37.5 Removal utility needs ground truth and controls — accepted; research blocker

Removing copied text necessarily changes an extractive brief. That proves the exclusion mechanism, not usefulness. Build three challenge categories: unique critical evidence; independent redundant evidence; and irrelevant or contextual evidence. Add matched sham removals, preserve query/method/settings, and score the appropriateness of remaining evidence/abstention using independent judgments. Include multi-source removal cases where sources can interact. Keep mechanical zero-leakage tests separate from this evidence-utility experiment.

### 37.6 Metadata pathways and evaluation population — accepted

Ablating only `tag_coverage` leaves metadata in BM25's title/tag scores and candidate selection. A text-only experiment must remove those pathways at candidate generation, scoring, model features and any gate that uses them. Report exactly which pathways remain. Query/metadata aliases are versioned transforms, not free improvements hidden in the baseline.

Unanswerable questions belong in a separate answerability/selectivity analysis. Do not interpret assigning them zero nDCG as poor evidence retrieval, or select a refusal threshold using that conflation. Report contextual (grade 1) versus directly relevant (grade 2) judgments and give direct-evidence recall alongside broad relevance. A relevance ranker is never an entailment checker.

### 37.7 Public release requires content and access verification — retained hard gate

Even a native deployment success is not proof of no-login public availability. Verify an unauthenticated session before providing a CV-ready claim. Human content review, meaningful experiments and a public URL are all required; publishing the seed as a labeled engineering preview does not bypass them. No paid infrastructure is silently provisioned.

## 38. Execution schedule, effort and decision checkpoints

These are provisional effort ranges, not a promised completion date. Hardware, the author's ML experience, available weekly time, labeling assistance and source rights are not yet known. Agents accelerate implementation; they cannot substitute for independent human judgments or completed experiments.

| Stage | Indicative focused effort | Deliverable and decision |
| --- | --- | --- |
| Plan + engineering skeleton | 1–3 development sessions | Contract, reviewed plan, source-traceable live retrieval/stress UI; decide whether the central interaction is understandable |
| Narrow corpus/rights pilot | 2–4 sessions plus source review | Context-preserving licensed evidence; stop if sources cannot support intended questions |
| Annotation rubric + pilot | 2–3 sessions plus human review | 15–25 question families, independent sample review, disagreements and revised rubric; do not train final study yet |
| Full reviewed judgment collection | Effort measured from the pilot, likely the largest manual component | Frozen grouped train/validation/test inventory; reduce study size openly if review capacity is insufficient |
| Trained ranker + parity | 2–4 implementation/analysis sessions | Reproducible model, controls, identical browser/offline scores and real validation report |
| Evidence-utility study | 3–5 experiment/analysis sessions after labels | Unique/redundant/irrelevant and sham controls; paired results and negative cases |
| Product/release QA | 2–4 sessions | Actual visitor-flow tests, accessibility, performance and public-access proof |
| Case study and CV | 1–2 sessions after valid results | Concise measured story, failure gallery, reproducibility receipt and public link |

Default operational decisions: paid-service budget is zero; no generative provider enabled; no custom domain purchased; no end-user account collection; no document uploads; no analytics query logging; no GPU dependency. Decisions that may later improve scope are the exact domain subset, author time/RAM, availability of a second human annotator, and whether a small hosting/model budget is acceptable. They do not block the current no-key engineering implementation. Any paid or privacy-affecting change needs its concrete configuration reviewed against the user's instructions.

The R0 exit review must include an honest decision: does a visitor learn something useful by inspecting/removing evidence, or does the product merely look polished? If the latter, improve the domain data and interaction before adding more infrastructure or calling it CV-ready.
