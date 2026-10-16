# Aurora CPU research pipeline

This is working experimental infrastructure, **not a completed relevance study**. The public app runs deterministic BM25 over real short source excerpts. There is no trained production model and no held-out performance claim. The only included model coefficients live in a conspicuously synthetic unit-test parity fixture; the browser refuses to load them.

## What the runtime really does

`createEngine(corpus, {model:null})` validates and copies the corpus, freezes full-corpus index statistics, and exposes synchronous `ask(...)` and method availability. `ask` scores new questions rather than looking up stored answers. Before scoring it removes excluded paper candidates. The full-corpus IDF/average lengths remain fixed across removal experiments so exclusions do not silently change scoring configuration. A removed source's words still informed original index statistics; no source text, claim, relation or snippet from that source is returned. A full re-index-on-removal experiment would be a separate intervention.

BM25 is the sum of independently normalized field scores for excerpt text (boost 1), title (0.35) and curator topic tags (0.15), with `k1=1.2`, `b=0.75`, positive IDF `log(1+(N-df+0.5)/(df+0.5))`. Every passage is an index document. Query terms are unique for scoring. Zero-score passages are not candidates in either method. `top_k` is 1–20, default 5. Equal scores sort ascending by passage ID; IDs should remain ASCII to preserve ordering across runtime Unicode collation conventions. Curator notes and challenge relation rationales are never indexed. Tags are metadata and are explicitly identifiable for later ablation.

The `heuristic_v1` gate allows an excerpt into the brief only if (a) at least one unique query token occurs in its source text, (b) at least `min(2, unique query token count)` occur across title plus excerpt, and (c) at least 35% of unique query tokens occur in that union. No tags or notes participate in this gate. Titles supply method context when a short quotation omits it, but title-only matches cannot create a brief. These are fixed operational heuristics, **not calibrated answerability, semantic support or truth tests**. A related excerpt may fail to answer a precise question; paraphrases can be missed. The brief only reproduces selected qualifying exact excerpts with passage citations. It does not conclude that a proposition is true.

Empty, all-stopword, all-zero, all-excluded and weak-match cases return an explicitly corpus-limited `insufficient_evidence` response with no claims. Passing the heuristic yields status `evidence_found`, which explicitly means relevant excerpts were found and **does not mean the question was answered**. A false-specificity query such as asking an attention algorithm's accuracy can return a relevant algorithm excerpt without containing any accuracy result. Invalid/unknown IDs and unavailable methods throw explanatory errors. A curated relation is returned only with its explicit challenge ID and the unchanged NFKC/whitespace/case-normalized question. Editing the question clears all such relations. Relation receipts carry their review provenance; missing independent-human adjudication is explicitly `independent_human_review:false`.

Receipts include SHA-256 of canonical corpus JSON (recursively sorted object keys, preserved array order, UTF-8 Unicode, no whitespace), exact source text hashes, corpus version, model ID, feature version, exclusions and settings. Timing is diagnostic and excluded from deterministic comparisons. The JavaScript SHA-256 implementation is checked against Node's cryptographic implementation and Python signatures. These checks detect changes; they do not establish that a quotation was correctly sourced.

## Frozen features and Python/browser parity

Version: `aurora-lexical-v1`. Tokenization: Unicode NFKC, lowercase, maximal sequences of Unicode letter/number characters, then remove the exact stopword set in `features.py` and `engine.js`. Negation terms such as `not`, `no` and `never` are deliberately retained. There is no stemming or unreported alias expansion. The fixture includes full-width digits, accents, punctuation, zero-match and stopword-only questions; this covers common Unicode paths rather than every Unicode-version difference between Python and browsers.

Feature order and transforms:

| Feature | Exact transform |
|---|---|
| `log1p_bm25` | `log(1 + summed field BM25)` |
| `passage_coverage` | Unique query tokens in excerpt / unique query tokens |
| `title_coverage` | Unique query tokens in title / unique query tokens |
| `bigram_coverage` | Unique adjacent query-token bigrams in adjacent excerpt-token bigrams / unique query-token bigrams; stopwords removed first |
| `token_jaccard` | Size of unique query/excerpt intersection / size of union |
| `length_saturation` | Unique excerpt-token count / (unique excerpt-token count + 40) |
| `numeric_coverage` | Query tokens containing a Unicode number and occurring in excerpt / unique query tokens containing a number |
| `tag_coverage` | Unique query tokens in joined paper topics / unique query tokens |

Every empty denominator returns zero. These are the final transforms. Artifact transforms are exactly `{"kind":"identity","feature_version":"aurora-lexical-v1"}`; no learned mean/scale or per-query normalization exists. Ranker predicts sigmoid(`bias + dot(weights, features)`). A sigmoid-shaped score is still relevance, never confidence in scientific truth. Candidate generation is identical for BM25 and reranking; a trained model cannot rescue a passage with zero baseline score. Candidate recall is reported to expose that ceiling.

## Judgment format and safeguards

One JSONL record per question/passage pair:

```json
{"query_id":"q-001","question":"An actual reviewed question","question_family":"family-001","passage_id":"existing-passage-id","relevance":2,"split":"train","annotator":"reviewer-pseudonym","synthetic":false,"reviewed":true,"label_provenance":"Rubric v1; reviewed 2026-10-16; curator record reference"}
```

The above is a **schema illustration, not collected data**. `relevance` is integer 0/1/2 (irrelevant/contextual/directly relevant). Logistic training uses the binary target `relevance > 0`; evaluation preserves graded relevance for nDCG. Relevance is independent of support/contradiction. For non-synthetic rows the loader requires `reviewed:true` plus nonempty `label_provenance`; this is an auditable declaration, not automatic proof of human review. Do not relabel agent-created or automatic judgments as independently human-adjudicated.

Use `split` train/validation/test. All paraphrases in a question family must share one partition. The loader rejects cross-partition family overlap, identical normalized questions disguised under different families, conflicting query IDs, duplicate query/passage labels (adjudicate disagreements first), unknown passages, missing annotators and malformed grades. Public development challenge questions cannot be test questions. Semantic near-duplicate families still require curator review; the tool cannot recognize all paraphrases. Same-corpus evaluation is not source-family-held-out transfer. No such claim is made.

Both positive and negative train labels plus validation data are required. Training reads **train labels only**, with validation counted for provenance; the evaluator reports development metrics separately. The trainer does not optimize a threshold, inspect test labels for coefficients, or automatically pick a favorable epoch. Hyperparameters are explicit. Model weights begin at zero and receive deterministic regularized full-batch gradient updates. There is no dependency on NumPy, PyTorch, APIs, GPU or internet. The optional PyTorch study remains future work.

## Commands

Run from the repository root using Python 3.10+ (stdlib only):

```powershell
python -m unittest discover -s tests -p 'test_research.py' -v
python -m research.generate_test_parity
node --test tests/engine.test.mjs
```

Once **real reviewed data actually exists**, a pilot can be trained and validated:

```powershell
python -m research.train_ranker --corpus web/data/corpus.json --judgments data/judgments/reviewed.jsonl --output artifacts/relevance-pilot.json --epochs 400 --seed 17
python -m research.evaluate --corpus web/data/corpus.json --judgments data/judgments/reviewed.jsonl --model artifacts/relevance-pilot.json --split validation --output artifacts/validation-pilot.json
```

Those example commands intentionally reference a **not-yet-existing reviewed dataset**. Do not create a file merely to make the commands succeed. Inspect real source/judgment provenance, prediction failures and Python/browser parity before promoting any artifact to `web/data/model.json`. Runtime checks require the exact corpus signature and feature specification plus reviewed training provenance, non-synthetic/pilot flags. Model identity is a deterministic hash of actual weights, optimizer and provenance. A changed corpus requires retraining/revalidation; version strings alone cannot bypass hash checks.

After freezing configuration and recording the test protocol, test evaluation requires an extra explicit flag:

```powershell
python -m research.evaluate --corpus web/data/corpus.json --judgments data/judgments/reviewed.jsonl --model artifacts/relevance-pilot.json --split test --allow-test --output artifacts/final-test.json
```

This flag does not prevent repeated test peeking. The experiment record and human review must enforce the freeze. Data file SHA must match the model's declared frozen dataset (including all split records). Reports include all per-query predictions plus separate `retrieval_predictions` and `unanswerable_predictions` inventories and counts. Here, judged-answerable means **at least one grade>0 passage exists in the judged pool**, not a calibrated determination that the question has been answered. A question with no judged relevant passage receives `null` retrieval metrics and is excluded from nDCG/MRR/recall averages; its predictions remain fully reported. Missing indexed evidence is not evidence of absence in the wider literature.

Broad `recall_at_k` and `candidate_recall` count grades 1 or 2. `direct_evidence_recall_at_k` and `direct_evidence_candidate_recall` count grade 2 only and are `null` for questions without grade-2 judgments. `metric_populations` explicitly reports each metric's eligible question and family counts. For every metric, average only eligible questions within each family and then equally weight the eligible family means. In a mixed family, no-positive questions remain reported but cannot dilute its eligible retrieval observations. If there are no eligible queries/families, aggregate retrieval metrics are `null`, never zero or a fabricated perfect score. Aggregate judged-result coverage follows the same retrieval population; coverage for excluded no-positive cases remains inspectable per query.

The paired nDCG bootstrap samples only families with eligible paired method observations. Fewer than two eligible families yields `status:insufficient_eligible_families`, no interval and zero bootstrap samples; a one-family point difference may still be shown descriptively. Larger eligible populations receive an explicitly exploratory paired family interval. No-positive-only families never enter that resampling population. Unjudged results contribute zero gain: incomplete pools limit inference and must be reported. These are retrieval metrics, **not evaluated answerability calibration, refusal quality, semantic support or verification metrics**. Small convenience samples only support exploratory pilot statements.

Synthetic CLI behavior checks (never a production experiment):

```powershell
python -m research.train_ranker --corpus tests/fixtures/synthetic-corpus.json --judgments tests/fixtures/synthetic-judgments.jsonl --allow-synthetic --epochs 100 --output tests/fixtures/synthetic-cli-model.json
python -m research.evaluate --corpus tests/fixtures/synthetic-corpus.json --judgments tests/fixtures/synthetic-judgments.jsonl --model tests/fixtures/synthetic-cli-model.json --allow-synthetic --output tests/fixtures/synthetic-cli-report.json
```

The explicit switch is mandatory, outputs must remain inside `tests/fixtures`, the model is marked `synthetic:true`, reports say `synthetic_test_only`, and the browser rejects deployment. These files are not measured public evaluation results. Regenerate `synthetic-parity.json` with the supplied generator when the fixture intentionally changes; otherwise a parity mismatch is a blocker, not a reason to overwrite expectations casually.

## Still required before a CV research claim

- Genuine reviewed query/passage judgments, rubric and adjudication record; a meaningful number of distinct families and difficult negative controls.
- Frozen validation policy, independently reviewed final questions, explicit rights/provenance audits and candidate-pool coverage.
- A real trained pilot with per-query failure analysis; metadata-feature ablation and a credible lexical control.
- Separate evaluated answerability/abstention and source-removal appropriateness, beyond zero-source-leakage engineering tests.
- Measured latency with named hardware/browser/workload and honest confidence intervals/sample limitations.
- A public accessible deployment and actual visitor interaction checks.

The implemented code demonstrates reproducible CPU research infrastructure. It does not establish uniqueness of an algorithm, improved retrieval, scientific claim verification, human annotation quality or a completed benchmark.
