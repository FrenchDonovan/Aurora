# Independent Aurora review

Date: 20 October 2026. Baseline reviewed: `55b97e6e239e75ee9ee9b7d54fe1091e45b21929`. Canonical source: `C:\Users\donov\Downloads\Aurora`. Public site: https://aurora-evidence-stress-lab.starryshark33.chatgpt.site/ . This baseline section is frozen; subsequent reviews must be appended with their own revision and evidence.

## Verdict

**Flagship ML portfolio readiness: 6.1/10. Engineering-prototype quality: approximately 8/10. Not yet an 8/10 flagship ML project.**

The low flagship score is primarily insufficient demonstrated task utility and empirical ML substance, not discovered dishonesty. I did not find a material false empirical/model-training/novelty claim in the current public interface or README. In fact, the explicit unavailable supervised ranker, unmeasured research panel, and same-environment lexical RL disclosures are strengths. Accurate caveats do not supply the missing study, useful evidence coverage, or learned-model result.

This is a functioning and carefully engineered small demonstration. A visitor can retrieve exact excerpts, inspect provenance, exclude a paper, rerun, train real Q-learning, and export its Q-table. It currently gives a recruiter much more software-engineering evidence than applied ML research evidence. A cosmetic rewrite or more ambitious labels cannot close that gap.

## Fixed rubric, declared before scoring

Each criterion is scored 0–10; total is the weighted mean. The same weights and standard will apply to remediation. An 8 is a strong, defensible, bounded portfolio project rather than a research breakthrough. It requires a useful working visitor task; substantive implemented learning with an appropriate real experiment; credible claims, baselines, failure analysis, and reproducibility; and usable public flows. It does not require beating every baseline, a GPU, a new algorithm, a production-scale service, or fabricated independent human review. A narrow negative-result study can qualify if the implementation and analysis are strong. False material training/evaluation/novelty claims are critical blockers and cap the overall result below 8 until corrected.

| Criterion | Weight | Baseline | Reason |
|---|---:|---:|---|
| Usefulness and task fit | 15% | 5.5 | Real source-removal task works, but eight tiny excerpts cannot address most natural research questions. |
| AI/ML/RL technical substance | 20% | 5.0 | Correct BM25, actual Q-learning, thoughtful offline logistic pipeline; no real supervised model, and RL is a tiny query-local optimizer. |
| Scientific and claim accuracy | 15% | 9.0 | Clear boundaries between relevance, truth, curation, training, and evaluation; no material false public claim found. |
| Experimental evidence and evaluation | 15% | 2.0 | Research artifact remains `not_run`; unit fixtures and a single-environment RL curve do not evaluate the intended evidence task. |
| Reproducibility and software quality | 15% | 8.0 | Dependency-light runtime, deterministic receipts, parity checks, bounded data, substantial tests; browser regressions lack executable coverage. |
| UX, accessibility, performance | 10% | 7.5 | Distinctive, responsive, functioning interface; dense small text, confusing weak-match evidence, and route history shortcomings. |
| Originality and portfolio differentiation | 5% | 6.0 | Inspectable ablations and receipts are a useful product combination; no original empirical observation or demonstrated advantage yet. |
| Presentation and interview defensibility | 5% | 7.0 | Transparent methods and tangible interactions; too much unfinished planned work to support flagship positioning. |
| **Weighted total** | **100%** | **6.075 → 6.1** | **Insufficient flagship evidence, not a finding of dishonesty.** |

The separate prototype assessment is explanatory and cannot substitute for the requested flagship score.

## What I independently verified

- Read README, contracts, dataset/model cards, annotation protocol, related work, RL MDP documentation, research training/evaluation/data validation code, runtime engine/RL code, UI code/styles, build/test scripts, and representative tests. Historical plan review was background, not the source of this score.
- Independently opened all four public views: lab, sources, methods, and RL. Tested a development sample, source exclusion and rerun, an out-of-scope question, a source-provenance dialog, Q-learning training, and actual receipt download.
- The long-context example selected Lost in the Middle plus FlashAttention. Removing Lost in the Middle changed the status to insufficient evidence; the active brief stopped quoting it. The remaining FlashAttention result was a weak lexical candidate.
- An out-of-domain medical question returned insufficient evidence, with no invented medical answer, but still displayed Lost in the Middle as selected evidence because of generic word overlap.
- Default RL training completed 3,000 episodes, 7,536 TD updates, and 266 visited state-action pairs. Learned policy selected SmoothQuant then STOP: return 2.850, equal to greedy and exact optimum. The UI explicitly acknowledged the tie and lack of established RL advantage.
- Downloaded `aurora-rl-seed-17 (2).json` and independently reran the same configuration with the shared CLI-level learner. The complete receipt JSON matched exactly, including Q-values, checkpoints and baseline output.
- All **39 JavaScript tests passed** in this review. A restricted canonical Python run passed its first six cases, then stalled at a tempfile-dependent case under Downloads write restrictions; it was interrupted. I have not independently confirmed the historical full 15-case Python pass. This is a verification limitation, not evidence of a Python algorithm failure. The parent should run all Python tests from writable staging and retain output.
- Inspected the mobile lab at 390 × 844 and desktop RL rendering. Mobile layout reflowed and the primary investigation action was visible. The temporary viewport override was reset. No formal WCAG certification, screen-reader audit, load benchmark, or multi-browser certification is claimed.
- Spot-checked three primary abstracts: [Lost in the Middle v3](https://arxiv.org/abs/2307.03172v3), [SmoothQuant v7](https://arxiv.org/abs/2211.10438v7), and [ALCE v2](https://arxiv.org/abs/2305.14627v2). Their bounded excerpt/finding framing is consistent with the sources. This was not a full-paper scientific replication or comprehensive rights audit.
- Inspected the prior CV insertion source at `work/cv/add_aurora.py`. The entry is marked in development and describes implemented infrastructure, but some wording can be read as completed empirical evaluation. I did not independently rerender the delivered PDF in this review.

No canonical, hosted, or UI source files were edited by the reviewer. The browser created a downloaded test receipt. Only this report is a reviewer-authored project artifact.

## Findings and concrete acceptance checks

### R1 — High: no measured evidence for the intended ML task

Evidence: `web/data/evaluation.json:3–5` is `status: not_run`; `web/data/runtime.json` declares no model; `research/README.md:1–3` explicitly says no completed relevance study. `data/judgments/ANNOTATION_PROTOCOL.md` contains a protocol, not collected labels. Methods shows “Not measured yet.”

Why it matters: evaluating code paths on synthetic fixtures is useful engineering but cannot establish whether Aurora selects useful evidence for unseen questions. This is the largest score deficit.

Acceptance: run and publish an appropriately scoped real evidence-retrieval/selection experiment. Record corpus/data provenance, predeclared splits and selection rules, candidate pool, train/validation/test boundaries, fixed hyperparameter selection, model/code/data hashes, actual per-query predictions, strong comparable baselines, uncertainty at the independent grouping unit, and representative failures. Existing public benchmark human labels can be appropriate; do not call reused benchmark annotations new Aurora human annotation. A small pilot must remain a pilot. Negative results must remain visible. An external-corpus result must identify its own task and must not be presented as validation of the eight-excerpt live collection.

Independent human/external evidence dependency: somebody must supply real task labels, either an appropriate existing dataset or genuine human annotation. An agent cannot satisfy this by changing `reviewed` flags or creating plausible numbers.

### R2 — High: the public research task is too thin to sustain natural interaction

Evidence: `web/data/corpus.json` has eight papers and one brief fragment each; `docs/DATASET_CARD.md:7–9` acknowledges inadequate coverage. On the long-context sample, FlashAttention is shown alongside the relevant finding; on an unrelated medical question a generic `use` match surfaces Lost in the Middle. `web/lib/engine.js:158–175` selects any positive BM25 candidate for the evidence list, while only the stricter `meaningful` subset creates the brief.

Why it matters: the primary visitor sees “Selected evidence” even when a result did not pass the brief gate. Most precise questions cannot be answered from the available fragments. A disclaimer reduces misinterpretation but does not make the tool useful.

Acceptance: give visitors a bounded, coherent, sufficiently contextualized evidence task with explicit collection boundaries and multiple meaningful non-demo questions. Expand only with appropriate redistribution rights and attribution. Separate “used in brief” from weak retrieval candidates and explain each selection's lexical basis. Never invent semantic usefulness from relevance. Verify paraphrase, false-specificity, empty, out-of-domain and paper-removal cases. If the new benchmark and live search differ, make that distinction explicit and offer an interactive replay of the measured task/model.

Autonomous work possible: UI distinction, context presentation, corpus import of legitimate licensed data, representative deterministic behavior checks. New human relevance adjudication cannot be manufactured autonomously.

### R3 — High: RL is real but currently only a small educational optimization sandbox

Evidence: `web/lib/rl.js:13–44` defines deterministic utility from known token overlap; `:73–76` exhaustively enumerates every feasible subset; `:88–131` implements actual Q-learning. There are eight candidate excerpts, and the default learned policy ties greedy/exact after selecting one excerpt. `docs/RL_ARENA.md:61–63` correctly disclaims transfer and answer-quality benefits.

Why it matters: tabular temporal-difference learning is legitimate RL. However, learning a deterministic proxy for one question while an inexpensive exact oracle exists does not by itself demonstrate the need for RL or evidence-selection research quality. Calling it deep RL/RLHF or implying research quality would be false; current code does neither.

Acceptance: keep the educational boundary explicit. Add a reproducible experiment over a predeclared set of real question environments and multiple seeds, reporting regret/gap to oracle, greedy comparisons, learning/sample cost and failure distributions. Probe reward mismatch with independently supplied evidence labels if claiming useful evidence selection. A clear negative result—greedy already suffices, RL is inspectable learning rather than the production selector—is acceptable. Do not require a contrived superiority result. A substantive separately evaluated supervised component can strengthen the project while this remains educational; merely increasing episode counts cannot.

### R4 — Medium: browser behavior has no executable regression layer

Evidence: `scripts/test.mjs:4–6` enumerates Node tests; `.github/workflows/ci.yml:18–21` runs data/unit/research/build checks. Test files exercise engines and model loading, not DOM form submission, view routing, exclusion controls, downloads, cancellation, or responsive interactions. Historical manual QA is documented but not an automated test suite.

Why it matters: most recruiter-visible failures are integration failures that these tests cannot catch. “54 tests passed” should not imply 54 end-to-end user flows.

Acceptance: provide a small meaningful smoke/regression layer or an executable reproducible browser acceptance workflow for current investigation, editing/reset, exclusions/restoration, provenance modal/focus, learned-task replay, RL train/cancel/settings invalidation, all-excluded case, and actual exported receipts. Include narrow viewport checks. Preserve genuine unit-test counts separately. Run the full Python suite in writable staging. Account-level CI availability remains an external limitation if blocked.

### R5 — Medium: small text and weakened result hierarchy reduce comprehension

Evidence: `web/styles.css:17–19,23–27` contains many 7–11 px operational labels, secondary explanations and details. The mobile lab reflows correctly, but key scope/result distinctions and dense RL traces remain noticeably small. `web/app.js:73–86` counts all retrieval candidates as selected excerpts/evidence even when the brief excludes them.

Why it matters: the visual identity is distinctive, but a recruiter should understand the result and constraints without reading dense miniature notes. This is an accessibility/usability concern; no blanket WCAG failure is inferred solely from font size.

Acceptance: keep operational instructions, reward/result explanations and provenance meaning readable at normal zoom; reserve miniature type for decorative metadata. Verify at 390 × 844, 1280 × 720, keyboard-only use and 200% zoom, without horizontal content loss or inaccessible controls. Keep visible focus, reduced-motion handling and chart values available in text. Distinguish candidates from brief-used evidence prominently.

### R6 — Low/medium: browser Back does not traverse primary views

Evidence: `web/app.js:206–216` uses `history.replaceState` on each main-view change. Clicking lab → sources → methods overwrites the same history entry rather than creating view history.

Why it matters: primary navigation behaves differently from ordinary site navigation; Back may leave the site instead of returning to the previous view.

Acceptance: actual user view changes create sensible history entries; initial rendering and history-event handling do not create loops or duplicate entries. Back/Forward restore the correct visible view and navigation state. Prefer real route links where practical. Preserve in-memory investigations across view changes.

### R7 — Medium: CV wording needs scope that survives an interview

Evidence: `work/cv/add_aurora.py:28–29` describes reproducible ML evaluation, bootstrap intervals and training/inference parity, while the only completed training/evaluation fixtures are synthetic. Test count 46 is historical; current JS suite has39 and Python suite15. No RL line is present in that older insertion, despite actual RL now existing.

Why it matters: infrastructure claims are defensible, but a recruiter may infer a completed real model study. “Numerical parity to 1e-12” is checked on declared fixtures, not a universal numerical guarantee. This is ambiguous scope, not a proven false training claim.

Acceptance: align CV with final actual artifacts. Say implemented evaluation infrastructure if no real study; otherwise name the real dataset/task and narrow observed result. Describe tabular Q-learning and the proxy accurately. Qualify parity as fixture-based. Prefer a stable technical outcome over a test count that rapidly becomes stale. Do not claim independent human review where none occurred.

### R8 — Medium: root license does not prominently delimit third-party content

Evidence: root `LICENSE:1–9` is the standard MIT grant for software/documentation. `docs/DATASET_CARD.md` separately explains mixed excerpt rights and five unknown third-party reuse permissions. The source dialogs disclose this accurately.

Why it matters: a repository visitor can reasonably read the root license as applying to the complete distribution. Permission records and quotation budgets are not a blanket redistribution grant or a legal determination.

Acceptance: add a clear root-level license/third-party notice that MIT applies to original code and identified original materials, with external excerpts/datasets retaining their own licenses and attribution. For any substantial corpus expansion, document exact source/version rights, modifications and attribution; do not extrapolate the original 25-word implementation budget into legal permission. No general legal conclusion is made by this review.

### R9 — Medium: no original experimental finding or failure atlas yet

Evidence: README's novelty section appropriately avoids first-ever claims; `docs/RELATED_WORK.md` lists adjacent evidence intervention/evaluation precedents. The site currently presents the mechanism and absent research, not an original empirical observation.

Why it matters: combining BM25, a small Q-table and a polished interface is a competent build but insufficiently distinctive for the user's stated flagship objective.

Acceptance: publish an inspectable, reproducible contribution: for example, an evidence-removal/error atlas on a legitimate real task, matched intervention controls, failure categories tied to actual predictions, and public replay of measured cases. Show at least some unfavorable cases. Do not claim causal attribution, semantic faithfulness or a novel algorithm without the corresponding study. A narrow well-executed investigation is more defensible than broad “AI research assistant” positioning.

## Repair sequence and re-review gate

1. Freeze this baseline and a concrete new task/protocol before examining final outcomes. Acknowledge which current subsystem the experiment does and does not test.
2. Obtain legitimate labeled data and adequate context; preserve license/annotation provenance. Predeclare deterministic selection, paper/question grouping and splits. Human-origin benchmark annotations can satisfy the evidence-source requirement when appropriate; new human judgments cannot be simulated.
3. Train and evaluate the actual CPU model or other substantive learned component. Compare with meaningful same-pool alternatives. Save all predictions, hashes, uncertainty, failure categories and negative results. Add a bounded multi-question/multi-seed RL audit if making stronger RL assertions.
4. Integrate the measured task/model/results into the public interaction, including reproducible case replay, exclusions, and accurate labels. Correct candidate-versus-brief hierarchy, route history, readable text and root third-party notices. Update README/cards/CV only to actual completed work.
5. Run engineering suites and meaningful browser acceptance checks. Parent verifies public deployment matches the remediation revision; independent reviewer reruns actual flows and checks result provenance using this fixed rubric.

**A report, larger plan, new disclaimer or promised future model is not remediation evidence.** The next review may still score below8. The score will rise only when the actual task, implementation, empirical evidence and public experience warrant it. The rubric does not make success conditional on a favorable ML result, and the reviewer will not inflate the mark to stop the loop.

---

## Independent reassessment — deployed version 6

**Final weighted assessment: 8.2/10 for the bounded ML portfolio project now implemented.** The original 6.1/10 baseline above remains unchanged. The same eight criteria, weights, material-false-claim blocker, and definition of an 8 were retained. This assessment is of an inspectable applied ML experiment and failure-analysis tool, not a state-of-the-art model, general research assistant, novel RL algorithm, or production semantic verifier.

Reviewed hosting source revision: `2151e291996f3f4a72e190dcd0ac30169d5a709f`. Public version 6: `appgprj_6ad17c96b90481919c79fdfc7020d731~appgver_08aebc9463c48191b0a573ef559eccfa`, deployed 20 October 2026 at 21:51 Berlin time. Live: https://aurora-evidence-stress-lab.starryshark33.chatgpt.site/#study . The source reviewed was `work/aurora-build`; canonical/GitHub synchronization was still pending at the moment of this review and is a separate delivery action, not assumed completed here.

| Unchanged criterion | Weight | Baseline | Reassessment | Basis for changed score |
|---|---:|---:|---:|---|
| Usefulness and task fit | 15% | 5.5 | 8.0 | Coherent known-paper retrieval, contextual paragraphs, custom questions, actual learned/BM25 replay, reference/control interventions and complete failure cases. |
| AI/ML/RL technical substance | 20% | 5.0 | 8.0 | Real CPU training on 7,814 question-paragraph pairs; frozen eight-feature logistic model; real query-local Q-learning plus 100-run real-question audit. |
| Scientific and claim accuracy | 15% | 9.0 | 9.0 | Negative outcome is prominent; paper-disjoint labels versus transductive IDF, partial human references versus assumed negatives, and proxy versus evidence utility remain explicit. |
| Experimental evidence and evaluation | 15% | 2.0 | 8.0 | Actual 100-question/31-paper test pilot, fixed protocol, same-pool BM25/coverage controls, per-query predictions, paper-macro metrics, paired paper-bootstrap intervals and removal atlas. |
| Reproducibility and software quality | 15% | 8.0 | 8.5 | Independently reproduced model/references/metrics/RL runs; exact artifact fingerprints; 44 JavaScript + 15 Python tests; executable browser workflow; two review-found defects corrected. |
| UX, accessibility, performance | 10% | 7.5 | 8.0 | Readable study interface, distinct weak candidates, real route history and stale-run controls; parent-observed public responsive/interaction workflow. Verification limits below still apply. |
| Originality and portfolio differentiation | 5% | 6.0 | 7.5 | A public, inspectable negative-result/removal atlas and demonstrated proxy-reward mismatch distinguish the implementation; the algorithms and dataset are established prior work. |
| Presentation and interview defensibility | 5% | 7.0 | 8.5 | Concrete training/evaluation/RL artifacts replace plans; results and CV are accurately scoped, including the failed learner. |
| **Weighted total** | **100%** | **6.075** | **8.225 → 8.2** | **Meets the requested overall 8 threshold. No material false-claim blocker found.** |

The score increased because new empirical work and an integrated measured task exist, not because the original educational sandbox was relabeled. A negative learned-model result is not itself a defect that must be concealed or tuned away: the stronger baseline stays default and the failure is reproducible. Individual criterion scores need not all be 8 for the fixed weighted overall score to exceed 8; originality remains below 8 and is not presented as research novelty.

### Independent evidence obtained in this reassessment

1. Read the frozen protocol, importer, training/evaluation implementation, training pairs, freeze record, dataset/model/report/prediction/RL artifacts, new study UI, updated engine, browser acceptance workflow, README, rights notices and revised CV wording. The primary [Ai2 QASPER dataset card at the pinned revision](https://huggingface.co/datasets/allenai/qasper/blob/fdc9d8214fbab5dd782958601db4d678e6934a54/README.md) supports the declared human-practitioner annotation origin and CC BY 4.0 dataset license. Dataset-extracted paragraph text is correctly distinguished from independently verified current-PDF quotations and original-paper rights.
2. Independently rebuilt hash-based 64/16/32 paper selection and question/reference eligibility from the original QASPER raw files. The 163 train / 46 validation / 100 test eligible question counts and all 146 released validation/test reference sets agree with the shipped artifacts. This check did not simply trust the shipped `reference_ids`.
3. Independently recalculated every released query's nDCG@5, reciprocal rank and reference recall from those reconstructed references and saved rankings. Independently aggregated test metrics by question-within-paper, then equally across papers. They match the reported BM25 approximately 0.306/0.339/0.407, coverage 0.314/0.364/0.391, and logistic 0.072/0.092/0.107. Inspected the paired paper-bootstrap implementation and reported population/uncertainty boundaries; no official QASPER answer-F1 or truth-quality equivalence is asserted.
4. Checked reference/control removal identifiers for exclusions and matched counts against reconstructed references. Reference-removal recall being zero by construction is expressly acknowledged; selection sensitivity is the inspectable diagnostic. Remaining paragraphs can still answer under partial annotation.
5. Refit the complete frozen logistic model from released training rows using the declared settings. Weights, bias, model identity, provenance and canonical model SHA-256 **`a53f2f5355fd977cda07d8c74fc0f9ca58594ae32f5c60464d0ea593ef337163`** match exactly. Train labels alone supply coefficient updates; validation is descriptive, not a post-hoc model-selection mechanism in this released run.
6. Independently replayed all 100 Q-learning runs from the 20 declared real question environments and five seeds. Candidate/environment identities, selected policies, returns, TD-update counts, visited state-action counts and oracle regrets match the records. Mean reference recall is 0.170; all 100 runs reach their own lexical proxy optimum. These are repeated query-local optimization experiments, not 100 independent human tasks or policy-transfer evidence.
7. Independently ran the final **44 JavaScript tests**, including actual training-file-byte integrity, all 146 released-query Python/browser top-eight rank/score parity checks, and scope/intervention checks. All passed. Independently ran all **15 Python tests** in writable staging; all passed, resolving the baseline's local tempfile verification limit.
8. Independently verified the public deployed site through unauthenticated HTTP. `app.js`, `styles.css`, `ui/study.js`, `lib/engine.js`, and all five public study JSON assets are byte-for-byte identical to the reviewed local source. The JSON parses as actual study data rather than the static host's HTML fallback. The new Study HTML is present. Line comparison shows the HTML source difference is the host/CDN script injected before `</body>`, not a different Aurora interface. No authenticated browser session was used for these HTTP checks.
9. Inspected the revised rendered CV project crop and its wording source. It now describes actual QASPER CPU training, negative evaluation, tabular Q-learning and measured parity inputs, without the old stale test-count/universal-parity implication.

### Two additional defects found and fixed during re-review

**Training-byte provenance:** `qasper_study.train` originally hashed UTF-8 LF serialization but Windows `Path.write_text` emitted CRLF. The on-disk training JSONL hash was consequently different from its declared freeze hash. The implementation now writes exact UTF-8 LF bytes; the released file's actual SHA-256 is **`b6b024764a0250b2dafefed9beb8941458c2c9818eed6520fc14b042d0c5680c`**, matching the original freeze. I checked that equality and zero CRLF sequences. A new regression assertion covers actual file bytes. The correction is disclosed in `docs/QASPER_STUDY.md`; it changed neither model weights, model identity, predictions nor outcomes. It was a reproducibility bug, not evidence of fabricated training.

**Stale study actions:** selecting another paper/example originally cleared displayed paragraphs but retained the previous active reference set and enabled intervention buttons. `selectExample` now clears active/result state and disables reference/control/export until a successful new run; question edits also invalidate stale actions. I inspected the corrected source and verified that exact corrected UI module is deployed. The parent's final browser workflow explicitly checks invalidation and re-enabling.

Engine receipt language was also corrected to describe QASPER dataset extraction, partial human-selected references, assumed negatives, transductive IDF and the unfavorable learned result. It no longer silently describes the full study collection as the original tiny abstract collection. The root license is explicitly scoped to original code and links third-party notices.

### Public UI evidence and verification limitation

The reviewer independently operated the original public four views during the baseline review. After resuming for this reassessment, the reviewer's CUA session reported no available browsers; creating a new IAB tab also failed. **I therefore did not independently operate the newly deployed Study UI.** I did independently review its source, the screenshot `outputs/Aurora-Review/live-study.png`, the deployed assets/data, the algorithmic reproduction and the test suites.

The parent reports executing **all 32 checks in `scripts/browser-acceptance.mjs` against the actual public version 6**, after initial dataset loading: learned replay; example invalidation/re-enable; reference/control removal and restoration; three actual receipt downloads; seed custom/edit/reset/provenance/focus/exclusion flows; RL cancellation/training/settings invalidation/all-excluded STOP; Back/Forward; and no page overflow with reachable study action at 390×844, 1280×720 and 640×360. Those are **parent-observed public browser results**, not reviewer-operated checks. The executable workflow was read independently and its claims are appropriately separated from the 59 unit/integration tests. The screenshot visibly supports the prominent negative-result presentation, readable metrics and new Study route.

This evidence is sufficient for the bounded 8.2 project assessment, with that UI independence limitation stated. It is not a multi-browser, assistive-technology, WCAG, load/performance or security certification. A 640×360 CSS viewport is a useful reflow approximation, not an independently exercised browser zoom implementation.

### Resolution and remaining boundaries

R1 and R2 are materially addressed by a real trained/evaluated task integrated as the default Study view; the seed collection remains honestly unmeasured. R3 is addressed by a multi-question/multi-seed RL audit and explicit reward mismatch, without inventing a reason that RL must outperform an inexpensive oracle. R4 is addressed by the executable UI workflow and successful complete engineering suites, subject to parent-versus-reviewer UI evidence above. R5–R8 are addressed by readable study controls, candidate labels, route history, invalidation, updated CV, receipt scope and explicit third-party notices. R9 is addressed by an inspectable empirical failure/removal atlas; its differentiation is a software/experimental contribution, not an algorithmic novelty claim.

Important limits remain and constrain the score: a small deterministic convenience subset; partial human annotations and assumed negatives; exact paragraph overlap and possible semantic/topic overlap; transductive unlabeled IDF; a poor pointwise logistic ranker with hypothesized rather than experimentally isolated failure causes; a query-local deterministic RL proxy with an inexpensive exact oracle; approximately 5.9 MB uncompressed public assets; and Chromium/IAB-oriented browser evidence. The protocol hash and freeze were recorded locally before reported test inspection, but were not committed or independently externally preregistered before inspection; the report correctly discloses that and this review cannot retroactively prove chronology. Released test labels now form a development resource, so a new confirmatory improvement claim requires fresh untouched data.

**No further must-fix finding currently blocks the 8/10 overall threshold for this revision.** The project earns its mark as transparent, reproducible applied ML software that makes failure inspectable. Claims of state-of-the-art performance, deep RL/RLHF, scientific verification, independent new human adjudication, transfer, or algorithmic firstness would exceed the evidence and invalidate this approval.
