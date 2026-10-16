"""Regenerate SYNTHETIC test fixture only; never a trained production model."""
import json
from pathlib import Path
from .dataset import load_judgments
from .features import CorpusIndex, corpus_hash, predict
from .train_ranker import fit


def main():
    root = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
    corpus = json.loads((root / "synthetic-corpus.json").read_text(encoding="utf-8"))
    index = CorpusIndex(corpus)
    rows, dataset_hash = load_judgments(root / "synthetic-judgments.jsonl", index, allow_synthetic=True)
    model = fit(index, rows, dataset_hash, epochs=100)
    questions = ["4 bit weights accuracy degradation", "Exact attention memory reads tiling", "École ８ bit precision café", "quantization experiments", "volcano geology", "the and is"]
    queries = []
    for question in questions:
        queries.append({"question": question, "bm25_order": [row["passage_id"] for row in index.rank(question)], "rows": [{"passage_id": pid, "bm25": index.bm25(question, pid), "features": index.features(question, pid), "learned_score": predict(model, index.features(question, pid))} for pid in index.docs]})
    fixture = {"synthetic": True, "notice": "Synthetic unit/parity fixture only, not scientific evidence or a deployable model.", "generated_by": "python -m research.generate_test_parity", "corpus_sha256": corpus_hash(corpus), "model": model, "queries": queries}
    (root / "synthetic-parity.json").write_text(json.dumps(fixture, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Generated tests/fixtures/synthetic-parity.json (SYNTHETIC TEST ONLY)")


if __name__ == "__main__": main()
