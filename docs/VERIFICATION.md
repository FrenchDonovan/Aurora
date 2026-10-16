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
