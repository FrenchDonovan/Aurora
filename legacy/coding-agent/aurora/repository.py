"""Immutable Git snapshots and an allowlisted, independently replayable patch."""
from __future__ import annotations

import difflib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

from aurora.task import Task, relative_name

MAX_FILE = 256_000
MAX_REPOSITORY = 32_000_000


def safe_path(root: Path, name: str) -> Path:
    relative_name(name)
    root = root.resolve()
    target = root / name
    for part in [target, *target.parents]:
        if part == root:
            break
        if part.is_symlink() or (hasattr(part, "is_junction") and part.is_junction()):
            raise ValueError(f"Links are not permitted: {name}")
    if not target.resolve().is_relative_to(root):
        raise ValueError("Path escapes workspace")
    return target


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_snapshot(task: Task, destination: Path) -> str:
    if destination.exists():
        raise ValueError("Snapshot destination must be new")
    prefix = ["git", "-C", str(task.repository)]
    commit = subprocess.run([*prefix, "rev-parse", "--verify", "--end-of-options",
                             task.base_commit + "^{commit}"], capture_output=True,
                            text=True, check=True, timeout=10).stdout.strip()
    # Use a file so an unexpectedly large archive does not accumulate in memory.
    import tempfile
    with tempfile.TemporaryFile() as archive:
        process = subprocess.Popen([*prefix, "archive", "--format=tar", commit],
                                   stdout=archive, stderr=subprocess.DEVNULL)
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise ValueError("Git archive timed out")
        if process.returncode:
            raise ValueError("Git archive failed")
        if archive.tell() > MAX_REPOSITORY:
            raise ValueError("Repository exceeds the 32 MB MVP limit")
        archive.seek(0)
        destination.mkdir(parents=True)
        total = 0
        with tarfile.open(fileobj=archive) as tar:
            for member in tar:
                name = member.name.rstrip("/")
                target = safe_path(destination, name)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                elif member.isfile():
                    total += member.size
                    if member.size > MAX_FILE or total > MAX_REPOSITORY:
                        raise ValueError("Snapshot exceeds file or repository size limit")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(tar.extractfile(member).read())
                else:
                    raise ValueError("Symlinks, submodules and special files are unsupported")
    return commit


def files(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
            raise ValueError("Workspace contains a link")
        if path.is_file():
            yield path.relative_to(root).as_posix()


def tree_hash(root: Path) -> str:
    return digest(json.dumps([(name, digest(safe_path(root, name).read_bytes()))
                              for name in files(root)], sort_keys=True).encode())


def overlay_evaluator(source: Path, workspace: Path):
    target = workspace / ".aurora_eval"
    if target.exists():
        raise ValueError("Source repository uses reserved .aurora_eval path")
    target.mkdir()
    for name in files(source):
        data = safe_path(source, name).read_bytes()
        if len(data) > MAX_FILE:
            raise ValueError("Evaluator file too large")
        dest = safe_path(target, name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)


def make_patch(baseline: Path, candidate: Path, editable: tuple[str, ...]) -> tuple[list[dict], str]:
    changes, diffs = [], []
    for name in editable:
        old_path, new_path = safe_path(baseline, name), safe_path(candidate, name)
        old = old_path.read_bytes() if old_path.exists() else b""
        new = new_path.read_bytes() if new_path.exists() else b""
        if len(new) > MAX_FILE:
            raise ValueError("Patch file too large")
        if old == new and old_path.exists() == new_path.exists():
            continue
        old_text, new_text = old.decode("utf-8"), new.decode("utf-8")
        changes.append({"path": name, "old_sha256": digest(old) if old_path.exists() else None,
                        "content": new_text if new_path.exists() else None})
        diffs.extend(difflib.unified_diff(old_text.splitlines(keepends=True),
                                        new_text.splitlines(keepends=True),
                                        fromfile="a/" + name if old_path.exists() else "/dev/null",
                                        tofile="b/" + name if new_path.exists() else "/dev/null"))
    return changes, "".join(diffs)


def apply_patch(root: Path, changes: list[dict], editable: tuple[str, ...]):
    for change in changes:
        name = change["path"]
        if name not in editable:
            raise ValueError("Patch touches a non-editable file")
        path = safe_path(root, name)
        before = digest(path.read_bytes()) if path.exists() else None
        if before != change["old_sha256"]:
            raise ValueError("Patch preimage does not match baseline")
        if change["content"] is None:
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(change["content"].encode("utf-8"))
