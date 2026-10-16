"""Validated query-family-disjoint judgments, distinct from public challenge labels."""
import hashlib
import json
from pathlib import Path
from .features import normalize_question


def load_judgments(path, index, allow_synthetic=False):
    raw = Path(path).read_bytes()
    records = []
    for line_number, line in enumerate(raw.decode("utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on judgment line {line_number}") from exc
    return validate_judgments(records, index, allow_synthetic), hashlib.sha256(raw).hexdigest()


def validate_judgments(records, index, allow_synthetic=False):
    """Also used by programmatic training so a caller cannot bypass split checks."""
    rows = []
    families, questions, query_ids, pairs = {}, {}, {}, set()
    challenge_questions = {normalize_question(case["question"]) for case in index.corpus.get("challenges", [])}
    for line_number, row in enumerate(records, 1):
        if not isinstance(row, dict):
            raise ValueError(f"Judgment line {line_number} must be an object")
        for field in ["query_id", "question", "question_family", "passage_id", "annotator"]:
            if not isinstance(row.get(field), str) or not row[field].strip():
                raise ValueError(f"Missing {field} on judgment line {line_number}")
        if row.get("split") not in {"train", "validation", "test"}:
            raise ValueError("Invalid split; expected train, validation or test")
        if type(row.get("relevance")) is not int or row["relevance"] not in {0, 1, 2}:
            raise ValueError("Relevance must be an integer 0, 1 or 2")
        if type(row.get("synthetic")) is not bool:
            raise ValueError("Synthetic provenance must be explicit true/false")
        if row["synthetic"] and not allow_synthetic:
            raise ValueError("Synthetic judgments require --allow-synthetic and cannot produce a deployable model")
        if not row["synthetic"] and (row.get("reviewed") is not True or not isinstance(row.get("label_provenance"), str) or not row["label_provenance"].strip()):
            raise ValueError("Real labels require reviewed:true and nonempty label_provenance; no automatic human-review claim")
        if row["passage_id"] not in index.docs:
            raise ValueError(f"Unknown passage ID {row['passage_id']}")
        family, split = row["question_family"], row["split"]
        if family in families and families[family] != split:
            raise ValueError(f"Question-family leakage: {family}")
        families[family] = split
        normalized = normalize_question(row["question"])
        if normalized in questions and questions[normalized] != (family, split):
            raise ValueError("Duplicate normalized question assigned to different families/splits")
        questions[normalized] = (family, split)
        identity = (normalized, family, split)
        if row["query_id"] in query_ids and query_ids[row["query_id"]] != identity:
            raise ValueError("Query ID has conflicting question/family/split")
        query_ids[row["query_id"]] = identity
        pair = (row["query_id"], row["passage_id"])
        if pair in pairs:
            raise ValueError("Duplicate query/passage judgment; adjudicate disagreements before training")
        pairs.add(pair)
        if split == "test" and normalized in challenge_questions:
            raise ValueError("Public development challenges cannot be confirmatory test questions")
        rows.append(row)
    if not rows:
        raise ValueError("No judgment rows")
    return rows
