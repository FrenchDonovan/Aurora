"""Operator-owned tasks. Evaluation configuration never enters model context."""
from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import math
from pathlib import Path, PurePosixPath


def relative_name(value: str) -> str:
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise ValueError("Use a nonempty repository-relative POSIX path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ("..", ".git") for part in path.parts):
        raise ValueError(f"Unsafe repository path: {value}")
    reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{n}" for n in range(1, 10)),
                *(f"LPT{n}" for n in range(1, 10))}
    if any(part.endswith((" ", ".")) or part.split(".")[0].upper() in reserved for part in path.parts):
        raise ValueError("Path contains a Windows device name or ambiguous suffix")
    if str(path) != value or value == ".":
        raise ValueError(f"Path must be canonical: {value}")
    return value


@dataclass(frozen=True)
class Budget:
    max_steps: int = 20
    max_tokens: int = 24000
    wall_seconds: float = 300
    test_seconds: float = 30
    response_tokens: int = 1024

    def __post_init__(self):
        for key, value in asdict(self).items():
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value <= 0:
                raise ValueError(f"{key} must be positive")
        for key in ("max_steps", "max_tokens", "response_tokens"):
            if not isinstance(getattr(self, key), int):
                raise ValueError(f"{key} must be an integer")


@dataclass(frozen=True)
class Task:
    id: str
    repository: Path
    base_commit: str
    issue: str
    editable_paths: tuple[str, ...]
    test_command: tuple[str, ...]
    evaluator_dir: Path
    evaluation_command: tuple[str, ...]
    split: str = "development"
    expected_failure: str = "AssertionError"

    @classmethod
    def load(cls, path: Path) -> "Task":
        raw = json.loads(path.read_text(encoding="utf-8"))
        base = path.resolve().parent
        for key in ("id", "issue", "base_commit"):
            if not isinstance(raw.get(key), str) or not raw[key].strip():
                raise ValueError(f"Missing task field: {key}")
        if raw.get("split", "development") not in {"train", "validation", "test", "development"}:
            raise ValueError("Invalid task split")
        if not isinstance(raw.get("expected_failure", "AssertionError"), str) or not raw.get("expected_failure", "AssertionError"):
            raise ValueError("expected_failure must be a nonempty baseline failure marker")
        editable = raw.get("editable_paths")
        if not isinstance(editable, list) or not editable:
            raise ValueError("editable_paths must enumerate permitted source files")
        for name in editable:
            relative_name(name)
            if name.startswith(".aurora_eval/"):
                raise ValueError("Evaluator files cannot be editable")
        for key in ("test_command", "evaluation_command"):
            command = raw.get(key)
            if not isinstance(command, list) or not command or any(
                not isinstance(arg, str) or not arg or "\x00" in arg for arg in command
            ):
                raise ValueError(f"{key} must be a nonempty argv array")
        repo = (base / raw["repository"]).resolve()
        evaluator = (base / raw["evaluator_dir"]).resolve()
        if not repo.is_dir() or not evaluator.is_dir():
            raise ValueError("Repository and evaluator directory must exist")
        if evaluator == repo or repo in evaluator.parents:
            raise ValueError("Evaluator must be stored outside the source repository")
        return cls(raw["id"], repo, raw["base_commit"], raw["issue"], tuple(editable),
                   tuple(raw["test_command"]), evaluator, tuple(raw["evaluation_command"]),
                   raw.get("split", "development"), raw.get("expected_failure", "AssertionError"))

    def public_context(self) -> dict:
        return {"id": self.id, "issue": self.issue, "editable_paths": self.editable_paths,
                "test_command": self.test_command}

    def fingerprint(self, commit: str, evaluator_hash: str) -> str:
        content = {**self.public_context(), "commit": commit, "evaluator": evaluator_hash,
                   "evaluation_command": self.evaluation_command, "split": self.split,
                   "expected_failure": self.expected_failure}
        return hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
