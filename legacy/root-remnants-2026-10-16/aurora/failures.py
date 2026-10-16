"""CPU-only supervised baseline with explicit task/repository split checks."""
from __future__ import annotations

from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re

from aurora.trace import write_json

LABELS = ("retrieval", "edit", "test_failure", "environment", "timeout", "budget", "protocol")
HINTS = {
    "retrieval": "Search for the failing symbol and inspect its callers before editing.",
    "edit": "Read the current file; use a unique, exact replacement preimage.",
    "test_failure": "Read the assertion and traceback, inspect edge cases, then rerun tests.",
    "environment": "Inspect missing dependencies or import paths; do not change code to hide setup errors.",
    "timeout": "Inspect the smallest relevant test and avoid repeating the same expensive run.",
    "budget": "Use the remaining steps for the most relevant source file and verification.",
    "protocol": "Return one valid JSON object using only the documented tool names and arguments.",
}


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z_][a-z_0-9]{1,39}", text.lower())[:12000]


def observable_event(event: dict) -> str | None:
    if event["kind"] == "tool_result":
        return json.dumps({"tool": event["tool"], "result": event["result"]}, sort_keys=True)
    if event["kind"] in {"action_error", "provider_error"}:
        return json.dumps(event.get("result", event.get("error")), sort_keys=True)
    return None


def failed_event(event: dict) -> bool:
    if event["kind"] in {"action_error", "provider_error"}:
        return True
    if event["kind"] == "tool_result":
        result = event["result"]
        return bool(result.get("error") or result.get("timed_out") or result.get("returncode", 0))
    return False


def failure_text(trace: Path) -> str:
    """Match inference-time features: observations through the first tool failure.

    Independent grader output, issue IDs, labels and post-failure observations are excluded.
    """
    pieces = []
    for line in trace.read_text(encoding="utf-8").splitlines():
        event = json.loads(line)
        if text := observable_event(event):
            pieces.append(text)
        if failed_event(event):
            return "\n".join(pieces)[-24000:]
    raise ValueError("No observable failure: nothing to annotate for this intervention")


def heuristic(text: str) -> str:
    text = text.lower()
    if any(word in text for word in ("timed_out\": true", "timeout", "timed out")):
        return "timeout"
    if any(word in text for word in ("modulenotfounderror", "no module named", "permission denied")):
        return "environment"
    if any(word in text for word in ("preimage", "editable_paths", "not in the task")):
        return "edit"
    if any(word in text for word in ("unknown tool", "jsondecodeerror", "expected tool")):
        return "protocol"
    if any(word in text for word in ("assertionerror", "failed", "traceback")):
        return "test_failure"
    if "limit" in text:
        return "budget"
    return "retrieval"


class FailureClassifier:
    """Multinomial Naive Bayes with Laplace smoothing, serialized as plain JSON."""
    def __init__(self, state: dict):
        if state.get("algorithm") != "multinomial_nb_v1":
            raise ValueError("Unsupported failure classifier format")
        self.state = state

    @classmethod
    def fit(cls, rows: list[dict]) -> "FailureClassifier":
        if not rows:
            raise ValueError("Training data is empty")
        counts, documents, vocabulary = {}, Counter(), set()
        for row in rows:
            label = row["label"]
            if label not in LABELS:
                raise ValueError(f"Unknown failure label: {label}")
            words = tokenize(row["text"])
            documents[label] += 1
            counts.setdefault(label, Counter()).update(words)
            vocabulary.update(words)
        if len(documents) < 2:
            raise ValueError("Need at least two failure classes to train a useful baseline")
        if not vocabulary:
            raise ValueError("Training text contains no tokens")
        return cls({"algorithm": "multinomial_nb_v1", "documents": dict(documents),
                    "counts": {label: dict(words) for label, words in counts.items()},
                    "vocabulary_size": len(vocabulary), "training_rows": len(rows)})

    def predict(self, text: str) -> str:
        words = Counter(tokenize(text))
        scores = {}
        total_documents = sum(self.state["documents"].values())
        known = set().union(*(entry.keys() for entry in self.state["counts"].values()))
        for label, count in self.state["documents"].items():
            frequencies = self.state["counts"][label]
            denominator = sum(frequencies.values()) + self.state["vocabulary_size"]
            score = math.log(count / total_documents)
            # Unknown words have no class-specific evidence; ignore them.
            score += sum(n * math.log((frequencies.get(word, 0) + 1) / denominator)
                         for word, n in words.items() if word in known)
            scores[label] = score
        return max(sorted(scores), key=scores.get)

    def save(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        write_json(path, self.state)

    @classmethod
    def load(cls, path: Path) -> "FailureClassifier":
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def fingerprint(self) -> str:
        return hashlib.sha256(json.dumps(self.state, sort_keys=True).encode()).hexdigest()


def classification_metrics(truth: list[str], predictions: list[str]) -> dict:
    labels = sorted(set(truth) | set(predictions))
    scores = []
    for label in labels:
        tp = sum(a == label and b == label for a, b in zip(truth, predictions))
        fp = sum(a != label and b == label for a, b in zip(truth, predictions))
        fn = sum(a == label and b != label for a, b in zip(truth, predictions))
        scores.append(2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0)
    return {"accuracy": sum(a == b for a, b in zip(truth, predictions)) / len(truth),
            "macro_f1": sum(scores) / len(scores),
            "confusion_matrix": {label: {prediction: sum(a == label and b == prediction
                                      for a, b in zip(truth, predictions))
                                         for prediction in labels} for label in labels}}


def train_and_evaluate(dataset: Path, model_path: Path) -> dict:
    rows = [json.loads(line) for line in dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    if any(row.get("split") not in {"train", "validation"} for row in rows):
        raise ValueError("Classifier development accepts train/validation only; keep test tasks sealed")
    for row in rows:
        if row.get("label") not in LABELS or not isinstance(row.get("text"), str) or not row["text"].strip():
            raise ValueError("Every row needs a valid manual label and nonempty text")
        if not row.get("task_id") or not row.get("repository_group"):
            raise ValueError("Every row needs task_id and repository_group")
    train = [row for row in rows if row["split"] == "train"]
    validation = [row for row in rows if row["split"] == "validation"]
    if not train or not validation:
        raise ValueError("Provide nonempty training and validation partitions")
    for field in ("task_id", "repository_group"):
        if {row[field] for row in train} & {row[field] for row in validation}:
            raise ValueError(f"Data leakage across partitions: {field}")
    train_hashes = {hashlib.sha256(row["text"].strip().encode()).hexdigest() for row in train}
    if any(hashlib.sha256(row["text"].strip().encode()).hexdigest() in train_hashes for row in validation):
        raise ValueError("Identical text occurs across partitions")
    model = FailureClassifier.fit(train)
    model.state["synthetic"] = any(row.get("synthetic", False) for row in rows)
    model.state["dataset_sha256"] = hashlib.sha256(dataset.read_bytes()).hexdigest()
    model.state["train_task_ids"] = sorted({row["task_id"] for row in train})
    majority = Counter(row["label"] for row in train).most_common(1)[0][0]
    truth = [row["label"] for row in validation]
    result = {"training_rows": len(train), "validation_rows": len(validation),
              "majority": classification_metrics(truth, [majority] * len(validation)),
              "heuristic": classification_metrics(truth, [heuristic(row["text"]) for row in validation]),
              "learned": classification_metrics(truth, [model.predict(row["text"]) for row in validation]),
              "dataset_sha256": model.state["dataset_sha256"],
              "synthetic": any(row.get("synthetic", False) for row in rows)}
    model.save(model_path)
    write_json(model_path.with_suffix(".metrics.json"), result)
    return result
