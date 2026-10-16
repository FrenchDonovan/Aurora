# Aurora — Evidence Stress Lab

**Ask a research question. Inspect the evidence. Stress-test the answer.**

**[Try the live demo](https://aurora-evidence-stress-lab.starryshark33.chatgpt.site/)** — public engineering preview; no account, installation, or API key required.

Aurora is a public, interactive research evidence lab in its initial engineering-preview stage. Visitors can ask new questions over a bounded collection of actual paper excerpts, inspect sources, remove papers, and rerun the investigation. The implementation deliberately distinguishes relevance from scientific support and truth.

## Current implementation wave

Three implementation agents completed the first public-interface, retrieval/CPU research-tooling, and verified-corpus workstreams. A fourth independent reviewer produced 17 findings; the plan and implementation were revised accordingly. Read [the implementation plan](IMPLEMENTATION_PLAN.md), [independent review](docs/PLAN_REVIEW.md), and [integration contract](docs/CONTRACTS.md) for the scope and open release gates.

The dependable first mode is an **extractive evidence brief** running locally in the visitor's browser. It does not require a paid model API, installed model, account or GPU. It uses a curated excerpt collection rather than full-paper indexing or a complete literature search. A learned mode remains unavailable until a legitimate, compatible trained artifact exists. The engineering preview is publicly deployed at the demo link above. No held-out improvement is claimed.

## Local development

Node.js 20+ is enough for the website. No npm dependencies are required.

```sh
node scripts/validate-corpus.mjs
node scripts/test.mjs
node scripts/build.mjs
node scripts/serve.mjs
```

Open the printed loopback URL. On this Windows computer, `./aurora.ps1 start` locates the bundled Node runtime and builds/serves the app. `./aurora.ps1 test` runs JavaScript checks. Offline research tools use Python 3.11+; see `research/README.md` as that workstream lands.

## What is distinctive

The central interaction is a real rerun after evidence exclusion, accompanied by inspectable source provenance and an exportable result receipt. Existing research already studies citations, scientific claims and RAG evaluation. Aurora's originality must be demonstrated through its implementation, curated challenges, experiments and observed results; no first-ever algorithm claim is made.

Exact source excerpts are labeled separately from original curator notes. Scores measure relevance. Curator-reviewed claim relations apply only to unchanged development challenges. Open questions do not receive automatic support/contradiction judgments.

## Project status and evidence

Use `docs/VERIFICATION.md` and `docs/PLAN_REVIEW.md` when present for observed checks and unresolved issues. A results artifact with `status: not_run` means no research study has been completed. Synthetic fixtures test software behavior and do not establish real-world model quality.

The previous coding-agent project is preserved under `legacy/coding-agent/` during migration. Its demonstrations and metrics are excluded from this website and its results.
