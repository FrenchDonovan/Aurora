> Updated 20 October 2026: a separate real-data QASPER pilot is now released. See [the study documentation](QASPER_STUDY.md) and root README for current model/results. The original eight-excerpt seed collection remains untrained/unmeasured. The dated material below describes that original collection and pipeline; it does not negate or validate the separate study.

# Aurora relevance model card

Status on 2026-10-16: **no trained production model**. No weights are shipped in `web/data/model.json`. No training, validation, held-out retrieval evaluation or calibrated abstention result is claimed. The public research artifact is explicitly `not_run`.

The operational baseline is a deterministic lexical retrieval algorithm, not an LLM and not a semantic support classifier. Browser extractive briefs reuse indexed source wording and separately label curator context. A retrieval score is not confidence, factuality, entailment, or probability of truth. Technical title/tag matches may retrieve an item whose tiny indexed excerpt cannot answer the question.

The planned learned component is a CPU-trained linear relevance ranker, with a fixed feature specification and identical Python/JavaScript transforms documented by the implementation owner in `research/README.md`. Proposed features and algorithms are plans until that code and a real training manifest exist. No manual weights or synthetic test weights may be displayed as a trained public model. Synthetic fixtures validate software only and remain outside the web bundle.

Promotion requires source-derived relevance judgments with human review provenance, question-family separation across training/validation/test, a frozen tuning procedure, a legitimate training artifact with dataset/code/feature hashes, browser/Python parity, and an observed comparison with the same candidate generator and answer policy. A small convenience study is labeled pilot even when it produces favorable results. Train loss is not a retrieval-quality result. Negative outcomes must remain visible.

Intended future use: rerank brief passages for questions over the declared fixed corpus. Unsupported uses: scientific truth verification, arbitrary-domain research, clinical/legal decisions, complete literature review, and conclusions about unseen source transfer without a separate evaluation. Curated challenge relations are task-specific development annotations and cannot substitute for model predictions.

No model license is asserted because no model artifact exists. Future model permissions depend on the actual training data, implementation and artifacts; source-paper licenses are not model performance evidence. Runtime provider cost is absent in the baseline because there are no model API calls. Hosting and later optional generation have separate operational requirements.
