# Release gates

## Engineering preview

- [ ] Verified source corpus and attribution; no invented or overquoted source text.
- [ ] Baseline accepts a new query and returns an extractive brief with traceable sources.
- [ ] Question editing clears curator challenge association.
- [ ] Every exclusion reruns ranking and brief construction; excluded evidence never persists in exports.
- [ ] Comparison uses unchanged question/method/corpus/top-k; stale comparisons are cleared.
- [ ] Unavailable learned mode says unavailable; no pretend training artifact.
- [ ] Evaluation says not measured unless actual results are available with provenance.
- [ ] Corpus validation, JavaScript tests, Python research tests and build pass.
- [ ] Actual built app tested through form, source controls, exclusions/reset and receipt export.
- [ ] Mobile layout, keyboard flow and reduced-motion behavior checked.
- [ ] Plan-review blockers resolved or explicitly retained as release blockers.
- [ ] Source/build do not expose legacy data, held-out gold, local paths or credentials.
- [ ] Deployment status and current audience recorded accurately.

## CV-ready public release

- [ ] Public link works in an unauthenticated browser; no account/key required.
- [ ] Real, independently reviewed dataset judgments exist at a meaningful scale.
- [ ] Frozen held-out experiment, actual model provenance and comparisons published.
- [ ] Public metrics include sample sizes, uncertainty, split design and negative outcomes.
- [ ] Dataset card, model card, related-work comparison and failure gallery complete.
- [ ] Real latency and operational limits measured on named hardware/browser.
- [ ] The author can explain every claimed component and result.

The engineering preview and a CV-ready research result are separate milestones. Do not tick a research box because a demo or unit test passed.
