"""Deterministic dependency-free CPU logistic relevance pilot. No bundled model."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
from .dataset import load_judgments, validate_judgments
from .features import CorpusIndex, FEATURE_NAMES, FEATURE_VERSION, canonical_json, corpus_hash, predict


def fit(index, rows, dataset_sha256, *, seed=17, epochs=400, learning_rate=0.1, l2=0.01):
    rows = validate_judgments(rows, index, allow_synthetic=True)
    if type(seed) is not int or type(epochs) is not int or epochs < 1 or not math.isfinite(learning_rate) or learning_rate <= 0 or not math.isfinite(l2) or l2 < 0:
        raise ValueError("Invalid optimizer configuration")
    train = [row for row in rows if row["split"] == "train"]
    validation = [row for row in rows if row["split"] == "validation"]
    if not train or not validation:
        raise ValueError("Training requires distinct train and validation question families")
    labels = [int(row["relevance"] > 0) for row in train]
    if set(labels) != {0, 1}:
        raise ValueError("Training needs both relevant and irrelevant judgments")
    examples = [(index.features(row["question"], row["passage_id"]), label) for row, label in zip(train, labels)]
    model = {"weights": [0.0] * len(FEATURE_NAMES), "bias": 0.0}
    loss_history = []
    rng = random.Random(seed)
    order = list(range(len(examples)))
    for epoch in range(epochs):
        rng.shuffle(order)
        gradient, bias_gradient = [0.0] * len(FEATURE_NAMES), 0.0
        for position in order:
            features, label = examples[position]
            residual = predict(model, features) - label
            bias_gradient += residual
            for i, value in enumerate(features):
                gradient[i] += residual * value
        for i in range(len(FEATURE_NAMES)):
            model["weights"][i] -= learning_rate * (gradient[i] / len(examples) + l2 * model["weights"][i])
        model["bias"] -= learning_rate * bias_gradient / len(examples)
        if epoch == 0 or epoch == epochs - 1:
            loss_history.append({"epoch": epoch + 1, "training_log_loss": sum(-(label * math.log(max(1e-15, predict(model, features))) + (1-label) * math.log(max(1e-15, 1-predict(model, features)))) for features, label in examples) / len(examples)})
    synthetic = any(row["synthetic"] for row in rows)
    provenance = {"dataset_sha256": dataset_sha256, "corpus_sha256": corpus_hash(index.corpus), "corpus_version": index.corpus["corpus_version"], "train_rows": len(train), "validation_rows": len(validation), "reviewed_train_rows": sum(row.get("reviewed") is True and not row["synthetic"] for row in train), "annotators": sorted({row["annotator"] for row in train}), "label_provenance": sorted({row.get("label_provenance", "synthetic unit fixture") for row in train}), "leakage_checked": True, "split_protocol": "question_family_disjoint_fixed_corpus", "train_question_families": sorted({row["question_family"] for row in train}), "validation_question_families": sorted({row["question_family"] for row in validation}), "target": "relevance>0; probability-like score is not truth confidence"}
    artifact = {"schema_version": 1, "algorithm": "linear_logistic_v1", "feature_version": FEATURE_VERSION, "feature_names": FEATURE_NAMES, **model, "transforms": {"kind": "identity", "feature_version": FEATURE_VERSION}, "training_provenance": provenance, "seed": seed, "pilot": True, "synthetic": synthetic, "optimizer": {"epochs": epochs, "learning_rate": learning_rate, "l2": l2, "initialization": "zeros", "update": "full-batch-gradient-descent"}, "training_diagnostics": loss_history}
    artifact["model_id"] = ("synthetic-test-" if synthetic else "pilot-") + hashlib.sha256(canonical_json(artifact).encode()).hexdigest()[:16]
    return artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", required=True); parser.add_argument("--judgments", required=True); parser.add_argument("--output", required=True)
    parser.add_argument("--seed", type=int, default=17); parser.add_argument("--epochs", type=int, default=400)
    parser.add_argument("--learning-rate", type=float, default=0.1); parser.add_argument("--l2", type=float, default=0.01)
    parser.add_argument("--allow-synthetic", action="store_true")
    args = parser.parse_args()
    index = CorpusIndex(json.loads(Path(args.corpus).read_text(encoding="utf-8-sig")))
    rows, dataset_hash = load_judgments(args.judgments, index, args.allow_synthetic)
    artifact = fit(index, rows, dataset_hash, seed=args.seed, epochs=args.epochs, learning_rate=args.learning_rate, l2=args.l2)
    output = Path(args.output).resolve()
    fixture_root = (Path(__file__).resolve().parents[1] / "tests" / "fixtures").resolve()
    if artifact["synthetic"] and fixture_root not in output.parents:
        raise ValueError("Synthetic model artifacts must stay under tests/fixtures; never web/data or performance reports")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"model_id": artifact["model_id"], "synthetic": artifact["synthetic"], "pilot": True, "train_rows": artifact["training_provenance"]["train_rows"], "output": str(output)}))


if __name__ == "__main__":
    main()
