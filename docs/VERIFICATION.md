> Current v2 release: a fresh-test CPU LambdaRank study now outperforms both BM25 variants. See [v2 results and reproduction](RANKER_V2_RESULTS.md) for exact scope, pre-test commit, model and data provenance. The material below is the historical v1/seed record; its negative results remain preserved.

> Updated 20 October 2026: a separate real-data QASPER pilot is now released. See [the study documentation](QASPER_STUDY.md) and root README for current model/results. The original eight-excerpt seed collection remains untrained/unmeasured. The dated material below describes that original collection and pipeline; it does not negate or validate the separate study.

# Aurora engineering-preview verification

Date: 2026-10-16, Europe/Berlin. This document records observed engineering checks, not a research-quality or security certification.

## Observed automated results

- Corpus validator: valid, eight papers, eight short exact excerpts, three AI-curated development challenges, 137 quoted words total; every source remains within the session's 25-word quotation budget. Hashes check content integrity, not independent source verification.
- JavaScript suite: 31 tests passed, no failures or skips. Includes corpus provenance/reference validation, source exclusions, edited-challenge isolation, false-specificity limitations, deterministic retrieval, standard SHA-256 comparison, synthetic Python/JavaScript inference parity, optional-model failure behavior and real-corpus integration invariants.
- Python research suite: 15 tests passed. Includes actual synthetic training behavior, held-out label isolation, reviewed-label provenance requirements, question-family leakage guards, direct/contextual relevance separation, unanswerable population exclusion from retrieval averages, family weighting and insufficient-family bootstrap handling.
- Production build: eight web assets, 99,367 source-asset bytes before transport compression at verification. Build excludes the legacy prototype, research fixtures, held-out labels and offline data directories.
- No production trained model or measured research-performance artifact exists. Synthetic parity/training fixtures are software checks only. Public results artifact remains `not_run`.

## Actual browser checks

The built output was served by the local Node server. The first sandbox-local server was unreachable from the in-app browser; running a second loopback server outside the sandbox resolved that environment boundary. No firewall/security settings were changed.

Observed successful flows:

1. Loaded the application and its real eight-paper corpus; learned ranking was visibly unavailable.
2. Ran the unchanged long-context development example and inspected source citations and the source metadata dialog.
3. Removed the context-position paper; the same question reran and changed from evidence found to insufficient evidence, with the remaining passage and overlap comparison visible.
4. Downloaded the active JSON receipt, read the actual downloaded file, and confirmed the excluded paper was absent from active evidence and independent human review was false.
5. Restored sources, submitted a new out-of-domain gardening question, and observed a corpus-limited insufficient-evidence response with zero selected excerpts.
6. Tested a 390×844 mobile viewport; quantization investigation stacked correctly and displayed exact excerpts, provenance and three evidence sources without a required horizontal layout. The temporary viewport override was reset.
7. Opened the methods/results view by keyboard and verified the no-measured-results and unavailable-model explanations.
8. Downloaded the readable Markdown receipt and checked that it records `evidence_found` and review provenance.

Source modal close and input/submit controls were exercised. These checks do not constitute a complete screen-reader audit, WCAG conformance certification, multi-browser test matrix, or independent usability study. Full keyboard/mobile edge cases remain in the release checklist until individually verified.

The first native deployment revealed that its static fallback returns HTML for an absent optional model path. Baseline retrieval stayed usable, but a raw parser message was inappropriate in the interface. Integration now publishes a runtime asset declaration; `model:null` skips that request entirely, and malformed-artifact errors use a plain availability message. A regression test verifies explicit absence never fetches and parser details are not exposed.

## Review findings addressed

The independent reviewer wrote 17 findings. The plan was revised to v1.1, close intervention prior art was credited, `answer` status was replaced with `evidence_found`, curator-review provenance was preserved, and offline retrieval metrics were corrected to separate unanswerable judged pools. Research/CV-ready blockers remain explicit in the plan and review-resolution log.

## Not established

No semantic verification, calibrated answerability, useful trained-model improvement, human-adjudicated benchmark, complete literature coverage, legal opinion on content reuse, guarantee of novelty, or completed public no-login CV release is claimed. Those require the later evidence and access gates. Deployment state is a separate observed native hosting result, not inferred from this local preview.


## RL arena engineering checks — 2026-10-20

- Corpus validation passed. All 39 JavaScript tests and all 15 Python tests passed. Eight new RL tests cover actual TD learning, a synthetic nonmyopic counterexample, reward accounting, exact planning, determinism, source exclusion, invalid settings and empty/irrelevant environments.
- Browser training completed 3,000 seeded episodes from zero, producing an actual Q-table and trajectory. The downloaded JSON receipt was read and matched an independently executed command-line run as complete JSON data (7,536 TD updates, 37 Q-table rows for the default configuration).
- Source removal invalidated the old policy/export before retraining. Removing SmoothQuant changed the active action space from eight to seven excerpts; the new trajectory selected other sources and carried a different environment hash. Selected-source inspection opened the original provenance modal.
- The current main investigation and its exclusion set imported correctly into the arena. The original BM25 sample investigation remained operational. Cancelling an 8,000-episode run discarded the partial policy and restored controls; a fresh run starts from zero.
- The 390×844 responsive layout stacked controls and results into one column without horizontal page overflow. The temporary viewport override was reset.
- Build includes the RL engine and UI module as static assets. The optional supervised ranker remains unavailable and `evaluation.json` remains `not_run`.

These are software checks on a query-local lexical-reward sandbox. They do not establish semantic evidence utility, scientific accuracy, held-out RL improvement or cross-question generalization.

Public deployment verification: an unauthenticated HTTP client received the RL interface and the deployed stylesheet/JavaScript matched the checked build. Browser training on the public URL completed all 3,000 episodes, displayed comparisons, and enabled the receipt export. A returning tab retained the old stylesheet despite the new CSS being available at the origin. Entry-point asset URLs now carry the `aurora-r0-rl1` release key so that returning visitors receive the new layout. Bump this key with a subsequent frontend release; verify both fresh and returning-page behavior.
