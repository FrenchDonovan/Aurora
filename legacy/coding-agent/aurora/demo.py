from __future__ import annotations

from dataclasses import replace
import json
from pathlib import Path
import shutil
import subprocess

from aurora.evaluation import run_task, unique_run
from aurora.process import Runner
from aurora.providers import ReplayProvider
from aurora.task import Budget, Task


def prepare_demo(root: Path, project: Path) -> Path:
    """Copy our trusted fixture; never initializes or edits the user's repository."""
    target = unique_run(root)
    shutil.copytree(project / "examples" / "nested-config", target)
    repository = target / "repo"
    for args in (["init", "--quiet"], ["add", "."],
                 ["-c", "user.name=Aurora Demo", "-c", "user.email=demo@aurora.invalid",
                  "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null",
                  "commit", "--quiet", "-m", "Trusted Aurora fixture"]):
        subprocess.run(["git", "-C", str(repository), *args], check=True, capture_output=True, timeout=15)
    task_path = target / "task.json"
    shutil.copyfile(target / "task.template.json", task_path)
    return task_path


def run_demo(root: Path, project: Path, backend: str) -> tuple[dict, Path]:
    task_path = prepare_demo(root / "tasks", project)
    actions = json.loads((task_path.parent / "replay.json").read_text(encoding="utf-8"))
    run_path = unique_run(root / "runs")
    summary = run_task(Task.load(task_path), ReplayProvider(actions),
                       Runner(backend, allow_local=backend == "local"), run_path, Budget())
    return summary, run_path
