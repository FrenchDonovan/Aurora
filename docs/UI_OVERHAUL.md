# Aurora UI overhaul — 20 October 2026

## Design direction

Aurora now uses the visual language of an editorial research instrument: bone-white stock, carbon ink, vermilion operations, large condensed display headings, a narrow edition rail, numbered navigation, and ruled records rather than a grid of interchangeable cards. The typography is local system fonts; the interface makes no font, image, analytics or CDN requests.

The working experiment stays central. The opening frame places the question, primary action and a runnable development example within a 1280 × 720 laptop viewport. Retrieval availability and keyboard instructions sit in a labeled disclosure. The empty state exposes actual corpus papers as source-inspection buttons instead of using an ornamental illustration. Results retain their exact excerpts, citation controls, source exclusions, paired reruns and receipts.

The RL arena has an explicit untrained state, an explanatory state-to-policy diagram, and matched display states for changed settings, training, cancellation, errors and completed results. Live chart lines use both color and line style: solid vermilion for greedy-policy return and dashed gray for exploratory training return. The underlying Q-learning implementation and receipts are unchanged.

The source library is a numbered index with searchable records. Methods are organized as numbered technical chapters, with a retrieval pipeline, the temporal-difference equation, visible research status, and a reproducibility section. Relevance, scientific truth, curation, adjudication, proxy reward and held-out performance remain distinct.

## Scoped files

- `web/index.html`: navigation, layouts, content hierarchy, disclosure, source field, methods chapters, RL initial state, release keys.
- `web/styles.css`: complete responsive visual system; control focus, citation-target focus and reduced-motion support retained.
- `web/app.js`: render corpus-derived source-inspection buttons; bump app/receipt version and changed RL module URL.
- `web/ui/rl-arena.js`: coordinate initial/result/error display states; update chart colors and dash style.
- `docs/UI_OVERHAUL.md`: this handoff note.

No engine, RL algorithm, corpus, evaluation artifact, training code, build script, or dependency changes. The release key is `aurora-r0-studio1`; both entry points and the changed RL UI dependency use it to avoid stale cached assets.

## Verification

- Static build succeeded: 10 web assets, 159,922 source bytes at this revision.
- 39 JavaScript tests passed.
- 15 Python research tests passed.
- JavaScript syntax checks passed for both changed modules.
- Parent desktop browser QA confirmed no horizontal overflow at 1280 × 720; Investigate at y=514–562, first sample at y=649–706, source tickets begin at y=586.
- Parent browser QA exercised retrieval, paper exclusion and rerun, copying current exclusions into RL, 500-episode Q-learning and RL receipt download.
- Parent mobile browser QA passed at 390 × 844: Investigate at y=579–622; all four views reflow without horizontal overflow; source filtering and the provenance modal work; the methods equation fits; 500-episode RL training, trajectory, chart and receipt control fit (chart width 338 px). The viewport override was reset.
- Final integration/deployment are owned by the parent. No publication or GitHub push was performed by the design agent.

## Integration

Copy the four scoped web files and this note from the staging directory into the authoritative checkout. Preserve the hosting manifest, Git remotes and all engine/data/research files. Run normal checks and rebuild `dist` before deployment; generated `dist` is not a source change.

Staging: `C:\Users\donov\Documents\Codex\2026-10-16\i-x20\work\aurora-ui-overhaul`.

The local preview is `http://127.0.0.1:4182`, served from staging `dist` by retained session 94800. Parent should stop this owned session after integration QA. The system font stack intentionally depends on local availability; Impact rendered correctly in desktop QA, with Arial Narrow / sans-serif fallbacks elsewhere.
