# Independent-review remediation, 20 October 2026

Baseline: independent flagship score **6.1/10** on GitHub revision `55b97e6e239e75ee9ee9b7d54fe1091e45b21929`. The reviewer found insufficient empirical substance, no material false public claim. The fixed weighted rubric is retained for reassessment. This is the implementer's change/verification record, not a substitute independent score.

| Finding | Concrete remediation |
|---|---|
| R1 empirical evidence | Frozen QASPER pilot, real human benchmark references, actual trained CPU model, separate train/dev/test labels, hashes, per-query predictions, same-pool BM25/coverage controls and paper-bootstrap intervals. Negative results preserved. |
| R2 thin task / weak candidates | New default Study view: 112 contextual papers, 5,329 paragraphs, known-paper questions, live learned/BM25 replay and paragraph interventions. Seed demo remains separate. Brief-used and weak candidates, lexical match terms and scope are explicit. |
| R3 RL substance | Predeclared 20 real-query × five-seed audit against greedy/random/exact, TD/sample counts, regret and partial-human-reference reward mismatch. No transfer claim. |
| R4 browser regressions | Executable `scripts/browser-acceptance.mjs` for a supplied Codex CUA Tab/Browser. 32 observed checks, including stale-reference invalidation and re-enable, separate from 44 JavaScript and 15 Python unit/integration tests. |
| R5 readability | Operational text floor 12–13px, contextual paragraphs, readable study tables and responsive stacking. Layout checks at 390×844, 1280×720 and 640×360 (a 200%-zoom-equivalent CSS viewport). No blanket accessibility certification. |
| R6 navigation | User navigation pushes route history; Back/Forward restores views without discarding memory-state investigations. |
| R7 CV | Updated German entry names real CPU training and tabular Q-learning, pilot evaluation and negative model finding. Removes old test-count/general parity claim. Public wording in `docs/CV_ENTRY.md`; personal PDF remains outside repository. |
| R8 third-party rights | Root MIT explicitly scoped to original code; THIRD_PARTY_NOTICES credits QASPER CC BY 4.0, original-paper distinction, extraction changes and seed-excerpt rights. |
| R9 differentiation | Complete per-query removal/control atlas, worst-loss/gain/zero-recall replay, original empirical negative result and proxy-vs-reference RL mismatch. No new-algorithm/causal/semantic-verification claim. |

## Observed checks

- `node scripts/test.mjs`: **44/44 passed**. New real-data tests check every released validation/test query's top-eight IDs and scores for BM25 and the learned model against offline Python (absolute tolerance 1e-12), scoped exclusions and artifact integrity. This is measured parity on these inputs, not universal equivalence.
- `python -m unittest discover -s tests -p "test_*.py" -v`: **15/15 passed** from writable hosting staging with local TEMP/TMP. This resolves the review's Downloads tempfile limitation.
- `node scripts/build.mjs`: passed, static output includes separately licensed public study artifacts. Approximately 5.93 MB total uncompressed. Study corpus is loaded upon Study navigation, not by the seed/RL views.
- Executed CUA acceptance workflow in the actual preview browser: **32 checks passed**. Learned replay; reference/control removal and exact restoration; actual study/investigation/RL downloads; custom query/edit/reset; provenance open/close/focus restoration; paper exclusion/restoration; RL cancel/complete/invalidate/all-excluded STOP; Back/Forward; reachable primary controls and no horizontal page overflow at three viewport sizes.

The CUA workflow is imported with `await import('file:///ABSOLUTE_PATH/scripts/browser-acceptance.mjs')`, then `await module.acceptAurora(tab,browser)` with documented CUA handles. It uses public DOM controls and read-only DOM assertions, without hidden application state or browser-driver substitution. Browser checks are not automatically run by Node's unit-test command. CI currently cannot run because the GitHub account's Actions billing lock is external to the repository; no successful remote CI run is claimed.

## Boundaries that remain

The subset is small; annotations partial; unlabeled test text informs IDF; exact text duplicates and possible semantic/topic overlap remain. The learner performs poorly. No causal mechanism of that failure is experimentally isolated. The test labels are now public, so future confirmatory work needs new untouched data. RL is per-question tabular learning in a known deterministic proxy, with an inexpensive oracle, not a production advantage or transfer result. The original seed corpus remains unmeasured. Browser checks are Chromium/IAB spot checks, not multi-browser, screen-reader or WCAG certification. Local runtime timings are descriptive, not controlled performance results.

