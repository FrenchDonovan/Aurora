# Independent adversarial review of Aurora

Reviewed: 2026-10-16 (Europe/Berlin). Initial specification: `IMPLEMENTATION_PLAN.md` v1.0, `AGENTS.md`, and `docs/CONTRACTS.md` v1 plus clarification. Implementation inspected while the frontend and engine owners were still working; observations below describe that review snapshot, not a certification of a later release. This reviewer changed only this file.

## Verdict

**Proceed with an explicitly labeled engineering preview; do not declare the flagship project or CV-ready research release complete.** The plan is careful about claims, but care is not the same as a compelling capability. Eight short abstract fragments, three curated absolute-claim examples, browser lexical search, and a disabled learned mode can demonstrate sound implementation. They do not yet deliver the approved evidence-verifying research assistant or distinguish a candidate's ML work convincingly.

The central product risk is a quiet change in the promise: “ask a scientific question and inspect its answer” becomes “search eight snippets and watch them disappear when a source is removed.” That smaller product is useful scaffolding. Its honest limitations should not become a reason to stop before the difficult work that creates value.

No P0 incident was established in this review. Fabricated benchmark results, exposed secrets, or false claims of human labels/public access would be P0 release incidents if introduced. They are not observed findings here.

Priority meanings: P1 blocks the stated release stage; P2 materially weakens credibility or reliability and needs a scheduled remedy; P3 is a useful improvement. A research blocker does not automatically prevent an honestly described engineering preview.

## Findings and required remedies

### R01 — P1, CV-ready: the useful product is underdefined beyond a tiny search demonstration

**Evidence:** plan §§1, 5, 6, 8–9, 33; dataset card; eight actual passages. The corpus spans adaptation, quantization, attention, context position, citations, and RAG. That is broad topic coverage with almost no evidence depth. Most normal follow-up questions require content the index does not contain. A recruiter testing their own question is likely to encounter an evidence gap or a loosely related quotation.

**Counterexample:** “What exact hardware gives SmoothQuant 1.56x speedup?” cannot be answered by the displayed maximum-speedup abstract sentence. A qualification in an original curator note does not supply the missing primary evidence.

**Remedy:** make R0 a bounded excerpt-search/evidence-removal preview. Before CV-ready promotion, choose one coherent domain with enough licensed context to answer bounded questions about methods, settings, and limitations. Low-bit inference tradeoffs is a plausible narrower choice; it is not a proven best domain. Add independent evidence, disagreements, and non-answerable details rather than collecting paper-count badges. Define successful question types and show unsupported ones before the visitor submits.

**Exit:** a human-reviewed inventory demonstrates at least one genuinely useful question family beyond the three development examples, and a fresh visitor can get a useful result using their own in-scope wording. Corpus size alone is not the gate.

### R02 — P1, CV-ready positioning: the related-work search misses the closest intervention precedents

ALCE already evaluates cited generation, ARES separates RAG evaluation dimensions, RAGChecker diagnoses at claim level, and SciFact has scientific claim/evidence tasks and a public demonstration. These precedents are already acknowledged. More directly, [CUE-R](https://arxiv.org/abs/2604.05467), submitted April 2026, studies individual evidence interventions including removal, replacement, duplication, and interacting supports. [Pair-ID](https://arxiv.org/abs/2608.08944), submitted August 2026, crosses support addition with nonsupport deletion under controlled conditions. Their abstracts establish substantial overlap with “stress the evidence,” without requiring acceptance of their empirical claims.

**Implication:** neither source removal nor an evidence-sensitivity experiment can be presented as Aurora's new research idea. “Public and accessible” is a deployment property, not proof of scientific originality; SciFact's official repository already links a [verification demo](https://github.com/allenai/scifact).

**Remedy:** add these intervention papers and an explicit contribution matrix to related work. Define verifiable distinctiveness as a specific released dataset/task, inspectable implementation, controlled experiment, or demonstrated interaction benefit. Use “implemented and evaluated” rather than “invented” or “first.” A small replication with a clear extension can be credible; relabeling familiar ideas cannot establish novelty.

**Exit:** every proposed originality sentence has an artifact and comparison behind it. No claim that an incomplete prior-art search proves uniqueness.

### R03 — P1, preview semantics: retrieval overlap is being assigned an answer-like status

**Reproduced on the review snapshot:** the following engine calls returned `status: answer`:

| Question | Selected claim passages | Missing information |
| --- | --- | --- |
| What exact hardware gives SmoothQuant 1.56x speedup? | `passage-smoothquant-1` | No hardware identification in the excerpt |
| What is quantization accuracy on medical diagnosis? | `passage-smoothquant-1`, `passage-gptq-1` | No medical task, dataset, population, or diagnosis outcome |

The current heuristic needs only one excerpt token plus enough combined title/excerpt overlap. It cannot establish that requested details are present. “What is FlashAttention accuracy?” and “How does LoRA affect safety?” returned insufficient evidence in this test; they should not be reported as observed failures.

**Remedy:** use a retrieval status such as `evidence_found`, describe the output as related indexed excerpts, and state that the requested detail may be absent. Changing the enum alone does not improve answerability; retain these cases as product failure examples and later evaluate an actual answerability decision. A misleading result cannot be repaired entirely by a generic disclaimer at the bottom.

**Exit:** engine, UI, exports, tests, and documentation agree that retrieval is not answering. No “answer verified” or semantic certainty follows from lexical overlap.

### R04 — P1, CV-ready: source-removal utility is largely tautological in the current extractive system

Removing a source necessarily removes its copied excerpt. A change in the resulting brief is therefore expected by construction. Jaccard change proves that the retrieval set changed, not that a research answer became more accurate or that the UI diagnoses a meaningful failure. A source can be relevant yet unnecessary; two sources can be individually redundant but jointly necessary. A lower overlap can be either beneficial or harmful.

**Remedy:** build a reviewed challenge inventory with at least these distinct cases: unique necessary evidence; genuinely independent sufficient evidence; irrelevant but lexically attractive evidence; interacting multi-source evidence; and evidence with mismatched conditions. Use one declared task outcome per case. Test a removed-critical source, a matched irrelevant-source removal, and a no-removal control. In a generated system, keep the reader/configuration fixed and account for stochastic variability. In the extractive system, evaluate whether the surviving evidence actually satisfies the requested information need.

Separate two interventions: removal from the searchable library with reretrieval, and removal from a fixed retrieved context. They answer different questions. The current design implements the former. Do not claim the latter or causal model influence.

**Exit:** an independently reviewed example shows what good and bad sensitivity mean, and a small predeclared study reports outcomes beyond “the removed quotation disappeared.”

### R05 — P1, CV-ready ML: the proposed ranker risks being cosmetic

Eight passages provide a very small candidate universe. At k=5, a random selection of five among eight gives expected passage recall 5/8 for any fixed nonempty relevant subset. That does not invalidate an evaluation, but it makes easy top-k demonstrations weak evidence of useful learning. Most proposed features encode lexical overlap already available to BM25. More rows from paraphrasing the same few questions do not create equivalent independent evidence.

**Remedy:** establish a defensible question inventory and hard same-domain alternatives before training. Evaluate BM25 against the learned intervention with a primary metric fixed in advance. Include an inexpensive strong nonlearned control such as validation-tuned field weighting. Distinguish candidate-retrieval failure from reranking failure. Add an optional embedding control only if its download/runtime costs and license fit; a CPU constraint does not itself demonstrate superiority of a linear ranker.

**Exit:** real reviewed labels, frozen protocol, comparison against useful controls, per-family outcomes, and honest negative findings. Training a model is necessary for a training claim; showing that it changes rankings is insufficient for an improvement claim.

### R06 — P1, CV-ready inference: 80–120 question families do not automatically establish statistical power

The plan's annotation targets are effort estimates, not a power calculation. Twenty test families can produce a highly unstable average, especially when categories, multiple metrics, thresholds, models, and ablations are explored. Family bootstrap cannot remove convenience sampling, post-hoc selection, or dependency among questions about the same evidence.

**Remedy:** predeclare the deployment population, family definition, primary endpoint, practical effect of interest, and analysis unit. Use a pilot to estimate variability before selecting the final study size. Report paired per-family deltas and intervals; show leave-one-family sensitivity if results depend on very few cases. Group by claim/evidence scenario as well as lexical paraphrase where needed. Do not demand a positive or statistically significant result to ship a transparent experimental portfolio.

**Exit:** a frozen experiment protocol with actual counts and scope. Small studies remain exploratory. An interval around a convenience sample does not warrant broad RAG-quality claims.

### R07 — P1, CV-ready: annotation independence and selection bias remain unresolved

The data agent honestly records AI curation and no human gold. That is correct provenance. The planned author may nevertheless choose passages, write questions after reading them, assign tags, label relevance, tune the ranker, and judge the final result. A `reviewed: true` boolean is a declaration, not evidence that these biases were controlled.

**Remedy:** separate question authoring, passage selection, relevance grading, support grading, and adjudication records. Have questions proposed before inspecting system ranks. Include at least a declared independently reviewed subset, with actual disagreement examples and adjudication. Preserve raw proposed labels and final human labels distinctly. If independent review is unavailable, say so and restrict claims. A human can use AI assistance without turning AI proposals into independent human judgments.

**Exit:** auditable annotation ledger, rubric, timestamps, actual reviewer roles, and explicit limitations. No fabricated annotator identities or automatic promotion of AI labels.

### R08 — P1, CV-ready: the metadata ablation does not yet isolate metadata influence

BM25 indexes text, title, and curator tags. The ranker includes BM25 as a feature, plus title/tag overlap. Dropping only `tag_coverage` or the explicit metadata features leaves metadata inside BM25 scores and potentially inside candidate generation. That cannot support “works without curator metadata.” Titles can legitimately improve retrieval; curator tags are also a convenient path for answer/topic leakage.

**Remedy:** define separate text-only, text+title, and text+title+tags candidate/score pipelines. Recompute BM25 and features consistently for the intended comparison. Keep curator notes out of source evidence ranking unless separately disclosed and ablated. Measure discovery and ranking separately; distinguish an operational all-fields system from a diagnostic text-only experiment. Do not treat the mere reuse of public corpus text across question splits as leakage; the primary claim is fixed-library performance.

**Exit:** an ablation config that actually removes the hypothesized information path, with code/config hashes. Add source-family-held-out evaluation only for a separate unseen-paper claim.

### R09 — P1, CV-ready metrics: retrieval, direct answerability, and safe refusal are mixed too easily

The evaluator treats any relevance grade greater than zero as relevant for recall/MRR. Grade 1 may mean background/context, which can inflate apparent success on questions requiring a specific detail. For queries with no relevant judgments it returns zero nDCG, recall, and MRR. Those zeros should not be interpreted as failure of a system that correctly refuses to answer. Unjudged passages currently count as zero gain; an incompletely pooled assessment can favor the method that helped select the labels.

**Remedy:** report retrieval metrics on answerable questions with defined relevance criteria, and a direct-relevance sensitivity analysis using grade 2. Report unanswerable-question behavior separately as coverage/risk or false-evidence presentation. Use exhaustive judgments for eight passages; for expansion, pool multiple methods and report unjudged coverage. Do not frame annotated-pool recall as complete-corpus recall. Evaluate abstention on actual decisions if claiming it; current evaluator explicitly does not.

**Exit:** stratified metrics with explicit denominators, missing-label treatment, and no unanswerable zeros silently mixed into a headline retrieval score.

### R10 — P1, public corpus promotion: quotation budget and content rights are different checks

Five sources have unknown third-party reuse rights according to the dataset card. The 25-word source budget is an implementation-session constraint, not a general license grant or proof of legal permission. It also creates sentence fragments that often omit the conditions needed to answer research questions. A checksum of a fragment proves byte stability, not source authenticity, factual support, or permitted redistribution.

**Remedy:** before promotion, record an actual content-use basis for every displayed excerpt or replace it with an appropriately permitted source/link-only metadata entry. For the useful expanded corpus, prefer works whose relevant versions have verified reuse permissions, preserve attribution, and record edits/normalization. Do not silently carry the 25-word cap forward as a universal product requirement; expansion must use legitimately available text under applicable constraints. This review does not conclude that the existing quotations are unlawful.

**Exit:** corpus release ledger with pinned content versions, source locations, permissions/use decisions, and complete enough context. Code licensing must not purport to relicense third-party quotations.

### R11 — P2 preview / P1 semantic claims: quote integrity is weaker than evidence integrity

The corpus uses contiguous abstract fragments and separately labeled curator notes. This is a good first guardrail. It does not guarantee that a fragment bears on the claim or retains its original qualifications. “Negligible accuracy degradation” without task/model/metric context is especially easy to overgeneralize. A hashed quote can faithfully preserve a misleading selection.

**Remedy:** include pinned location/version, fragment indicator, surrounding-context access, extraction/normalization rules, and qualification fields where available. Distinguish source-reported numbers from Aurora measurements in the main interaction. Audit rendering of TeX-like source text and avoid silently changing exact quotations. Review contradiction/qualification labels against complete source context.

**Exit:** the reader can inspect enough source context to understand the scope, and the product does not promote a curator's prose to primary evidence.

### R12 — P2 preview contract / P1 research reuse: curated challenge provenance must survive every output path

The initial contract describes reviewed challenge relations but does not require the AI/human review record inside `curated_relation`. In the inspected frontend, the UI already derives an AI-CURATED label from the corpus and JSON receipts record `independent_human_review`; this resolves the immediate display problem substantially. The engine result alone initially discarded that provenance. A downstream renderer could therefore turn agent-authored development annotations into apparent gold.

**Remedy:** preserve review status/source in the challenge/result contract and exports. Permit stance only for an explicit unchanged case ID, as currently designed. Keep arbitrary questions and edited sample questions free of automatic curated stance. Ensure challenge descriptions and sample claims are visible enough that “challenges” is not mistaken for a verdict on a different proposition.

**Exit:** direct engine results, rendered cards, JSON, and Markdown agree about agent curation and lack of independent adjudication. Parent has assigned this contract remedy; verify the final diff.

### R13 — P1 public/CV release: a hosting candidate is not yet a public website

The plan correctly distinguishes local, private preview, and public access. The remaining risk is schedule optimism: native Sites availability, audience, account limits, and public anonymous access are not established by a static architecture. A free static baseline avoids inference billing; it does not prove a host's availability, limits, or persistence.

**Remedy:** verify the native hosting path early with an actual deployment and an unauthenticated check. If access is owner-only, record that precisely and use a portable static-host fallback rather than redesigning the app around a private artifact. No custom domain or paid resource is needed to validate the public interaction. Keep actual account limits and rollback instructions as an operational record.

**Exit:** an HTTPS URL that works without an account/API key in a fresh anonymous session, loads required assets, completes ask/exclude/restore/export, and works when the author's laptop is off. “Uploaded” or HTTP 200 alone does not satisfy this.

### R14 — P2 preview reliability: receipts and research artifacts need executable reproduction

Hashes identify inputs but do not by themselves recreate a run. The result contract does not fully version ranking/gate constants, and the frontend snapshot hardcodes `model_sha256: null` and initializes without loading a model. That is honest for the absent-model preview; it must change before learned-mode publication. A receipt that shows a sensitivity summary but omits the original result cannot independently reproduce the comparison unless its baseline configuration is specified.

**Remedy:** record engine/build identity, tokenizer/field/gate versions, top-k, corpus/model hashes, and the exact exclusion configuration. Define whether receipts contain active-only runs or full paired runs. Preserve excluded IDs in the explicit exclusion/provenance fields; “no excluded source in the evidence” should not forbid naming the intervention itself. Add an offline replay command that checks deterministic result fields, ignoring timing/timestamps.

**Exit:** a downloaded receipt reproduces passage IDs, status, and comparison from a named release. No integrity claim based solely on the presence of a hash.

### R15 — P2 preview security/privacy: static architecture reduces risk but claims still need checking

The design avoids user uploads, server execution, inference keys, and provider query transmission. This is appropriate. Verify actual behavior: query text must not enter navigation URLs, remote requests, analytics, default persistence, or exported filenames. Normal source navigation may send browser referrer information. A claim that no data ever leaves the device would overreach; local query processing is the narrower accurate claim.

**Remedy:** inspect actual network requests and browser storage on the built site; safely render untrusted text; validate outbound URL schemes/domains; use appropriate link/referrer protections; add host-supported content/security headers where practical. Runtime schema validation and build-time corpus validation have different trust boundaries. Tests should cover markup-like input and stale/malformed assets. Do not equate a substring credential scan with a security audit.

**Exit:** documented static data flow and checked failure behavior. Optional backend remains separately gated by quotas, cost, logging, and abuse controls rather than hidden in this preview.

### R16 — P2 project execution: the backlog is comprehensive but not sufficiently resourced or ordered

The plan lists a polished website, provenance tooling, ingestion, annotations, ML, scientific evaluation, accessibility, deployment, documentation, and learning. There is no realistic allocation for human source review and judgment collection. Those are likely the dominant dependencies after code scaffolding. R1/R2/R4 ordering also makes “CV-ready” feel reachable by completing UI checkboxes while the evidence work remains open.

**Remedy:** maintain separate engineering and research critical paths, with an actual owner and input dependency for each gate. Time-box the preview, then stop adding optional UI features until licensed context and useful questions exist. Use an explicit cut list: no arbitrary uploads, no general web search, no multiagent reasoning theater, no decorative PyTorch dependency, no automatic semantic verifier, no generative provider until one coherent product experiment works. Estimates should be updated from pilot annotation throughput rather than guessed completion promises.

**Exit:** prioritized next work tied to artifacts and real human availability. Three implementation agents finishing does not close the project.

### R17 — P2 CV credibility: the author's contribution must be explainable beyond agent output

An impressive website can still fail an interview if the author cannot explain field weighting, incomplete relevance pools, source removal, feature leakage, and model failure cases. Agent-written code and documentation are assistance, not evidence that the author has performed the experiments or understands the tradeoffs.

**Remedy:** include a short authorship/contribution record and an interview walkthrough driven by actual runs. The user should review data, reproduce one experiment, explain a failed query, and justify one rejected design alternative. Avoid inflated CV verbs such as “developed a novel verification algorithm” when the implemented work is a lexical evidence explorer.

**Exit:** a truthful case study with specific implemented decisions, actual measured findings, and limitations the author can discuss without relying on a generated script.

## Minimal coherent scope that can become impressive

The smallest defensible version is **a public evidence-sensitivity workbench for one bounded research topic**, not an unrestricted literature assistant. Keep the present static app as the operational shell. Add these substantive elements in order:

1. A rights-reviewed corpus with sufficient primary context, independent evidence, and real qualification differences. Prefer depth within one topic over a wider paper count.
2. A human-reviewed scenario inventory that distinguishes essential evidence, redundant evidence, irrelevant distractors, and mismatched settings. Public demos and held-out scenarios are distinct.
3. One useful CPU experiment: a genuinely trained relevance intervention versus tuned lexical controls, or a predeclared abstention intervention if pilot evidence shows that is the real bottleneck. Do not combine all changes and attribute the outcome to one model.
4. A first-minute interaction where a visitor can ask, inspect the source, remove evidence, understand the change, and download a reproducible receipt. “What changed and why does that matter?” must be visible without reading a methods document.
5. A measured report and failure gallery that preserve negative findings. Novelty is the specific released artifact and evidence, bounded by the closest prior work.

An optional generated synthesis can improve usability later. It must not be used to conceal insufficient source context or replace annotation. A free/public experience does not require free unlimited LLM inference. Under CPU-only constraints, an honest strong extractive product is coherent only if it solves a sufficiently useful bounded task.

## Assumptions requiring a user decision or real input

These are product/research decisions, not reasons to stop reversible engineering work now:

- **Positioning:** does the user accept an extractive evidence workbench as the first public release, with generative research-assistant behavior deferred? The previously approved pivot promised an evidence-grounded assistant; make the stage distinction explicit.
- **Domain:** choose a narrow topic the user wants to learn and defend in an interview. Efficient-model tradeoffs is a reasonable working default, not a settled optimal choice.
- **Human review:** how much actual author annotation is available, and can a second reviewer inspect a subset? No agent can manufacture independent human gold.
- **Release standard:** an honest early URL can be shared immediately after engineering gates, but CV-ready ML claims wait for measured evidence. The user may prefer a product-engineering portfolio over a research-heavy claim; that changes the required experiment, not factual reporting.
- **Future generation budget:** remain no-paid-service by default. If live generative synthesis becomes required, provider/model latency, license, quota, and spend are a separate explicit decision.

## Release gates

### Engineering preview gate

- Built site passes actual ask/source/exclude/restore/export interactions and keyboard/mobile checks.
- Retrieval statuses and copy do not claim semantic answering or verification.
- AI-curated development labels are visibly identified and do not attach to edited arbitrary questions.
- No excluded passage/claim leaks into active evidence or synthesis; exclusions are still named in provenance.
- Exact excerpts, original notes, rights records, and source-paper findings are visibly distinct.
- Learned mode absent/unavailable; results unmeasured, rather than simulated performance.
- Corpus-use decisions are recorded for public content; source integrity checks pass.
- Build excludes secrets, private gold, legacy artifacts, and local paths. Actual network/storage behavior matches the privacy copy.
- Public/private deployment state is independently checked and reported accurately.

### Research/CV-ready gate

- Useful full-context corpus and reviewed in-scope question inventory replace reliance on eight fragments.
- Training labels, reviewer provenance, split protocol, and independent-review limits are real and auditable.
- Close intervention prior work is credited; contribution claims are artifact-specific.
- One predeclared CPU experiment has useful controls, per-family predictions, uncertainty, hard negatives, and negative outcomes.
- Metadata ablation actually removes metadata paths; direct relevance and unanswerable questions have appropriate separate metrics.
- Source-removal study distinguishes critical, independent, irrelevant, and interacting evidence rather than reporting mechanical quote deletion as a discovery.
- Downloaded receipts can reproduce a named build. Model availability and learned inference are verified when claimed.
- A fresh anonymous visitor completes the useful workflow at the CV URL; a small external usability check documents whether the intended distinction is understood. A suggested practical target is four of five fresh testers completing ask/inspect/remove and explaining the change; that is a usability acceptance choice, not a general research result.
- Case study and CV text match observed sample sizes, measured outcomes, and actual author contributions.

## Evidence and review limitations

Local evidence inspected: plan/contracts; dataset/model/related-work cards; actual corpus and its development challenges; engine filtering/gate/ranking/model validation; frontend relation rendering/exports; Python judgment validation/evaluation; annotation protocol. Engine counterexamples were run directly with the bundled Node runtime against the actual corpus. This was an independent plan and logic review, not a completed browser accessibility audit, legal opinion, remote source-by-source revalidation, or full code security review. Concurrent changes require final integration verification by the parent.

Primary external references checked for this review:

- [ALCE](https://arxiv.org/abs/2305.14627): cited generation and citation evaluation precedents.
- [ARES](https://arxiv.org/abs/2311.09476): automated RAG evaluation precedent; Aurora does not reproduce its methodology merely by separating metric names.
- [RAGChecker official repository](https://github.com/amazon-science/RAGChecker): fine-grained claim-level diagnostic precedent.
- [SciFact official repository](https://github.com/allenai/scifact): scientific claim/evidence task and existing public demonstration precedent.
- [CUE-R](https://arxiv.org/abs/2604.05467): evidence intervention and interacting-support overlap.
- [Pair-ID](https://arxiv.org/abs/2608.08944): paired support/nonsupport interventions and controlled audit overlap.
- [Evaluation of Attribution Bias](https://arxiv.org/abs/2410.12380): source metadata can affect attribution; this is contextual precedent, not evidence that Aurora has that exact failure mechanism.

**Review disposition:** changes requested. Engineering progress is justified. Calling the current preview the finished impressive ML portfolio project is not.
