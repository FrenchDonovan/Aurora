"""Local task harness. SWE-bench scoring must use its official harness separately."""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import time
import uuid

from aurora import __version__
from aurora.failures import FailureClassifier
from aurora.agent import run_agent
from aurora.process import Runner
from aurora.providers import Provider
from aurora.repository import apply_patch, git_snapshot, make_patch, overlay_evaluator, tree_hash
from aurora.task import Budget, Task
from aurora.tools import Tools
from aurora.trace import Trace, write_json


def run_task(task: Task, provider: Provider, runner: Runner, output: Path, budget: Budget,
             failure_model: FailureClassifier | None = None) -> dict:
    identity = runner.identity()
    output = output.resolve()
    if output == task.repository or output.is_relative_to(task.repository):
        raise ValueError("Run directory must be outside the source repository")
    output.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    trace = Trace(output / "trace.jsonl")
    trace.emit("run_started", task_id=task.id, version=__version__)
    try:
        baseline = output / "baseline"
        commit = git_snapshot(task, baseline)
        evaluator = output / "evaluator"
        # Freeze the independent evaluator before any model interaction.
        shutil.copytree(task.evaluator_dir, evaluator, symlinks=True)
        evaluator_hash = tree_hash(evaluator)  # rejects links
        baseline_grade = output / "baseline-grade"
        shutil.copytree(baseline, baseline_grade)
        overlay_evaluator(evaluator, baseline_grade)
        before = runner.run(baseline_grade, task.evaluation_command, budget.test_seconds)
        baseline_valid = (before.returncode == 1 and not before.timed_out
                          and task.expected_failure in before.output)
        trace.emit("baseline_graded", result=before.to_dict(), valid=baseline_valid)
        metadata = {"schema_version": 1, "aurora_version": __version__, "task_id": task.id,
                    "task_fingerprint": task.fingerprint(commit, evaluator_hash),
                    "base_commit": commit, "evaluator_sha256": evaluator_hash,
                    "repository_sha256": tree_hash(baseline), "split": task.split,
                    "runner": identity, "provider": provider.identity(), "budget": asdict(budget),
                    "intervention": failure_model.fingerprint() if failure_model else None,
                    "intervention_training_synthetic": failure_model.state.get("synthetic", False) if failure_model else False,
                    "baseline": before.to_dict(),
                    "created_at": datetime.now(timezone.utc).isoformat()}
        write_json(output / "metadata.json", metadata)
        agent, after, regression, changes = None, None, None, []
        if not baseline_valid:
            outcome = "invalid_baseline"
        else:
            workspace = output / "workspace"
            shutil.copytree(baseline, workspace)
            agent = run_agent(provider, Tools(workspace, task, runner), budget, trace, failure_model)
            changes, patch = make_patch(baseline, workspace, task.editable_paths)
            write_json(output / "patch.json", changes)
            (output / "patch.diff").write_text(patch, encoding="utf-8", newline="\n")
            candidate = output / "candidate-grade"
            shutil.copytree(baseline, candidate)
            apply_patch(candidate, changes, task.editable_paths)
            overlay_evaluator(evaluator, candidate)
            after = runner.run(candidate, task.evaluation_command, budget.test_seconds)
            # Always rerun public regression tests on the clean candidate as well.
            regression = runner.run(candidate, task.test_command, budget.test_seconds)
            trace.emit("candidate_graded", acceptance=after.to_dict(), regression=regression.to_dict())
            executions = [after, regression]
            if any(result.timed_out for result in executions):
                outcome = "evaluation_timeout"
            elif any(result.returncode not in {0, 1} for result in executions):
                outcome = "evaluation_error"
            elif after.returncode == 0 and regression.returncode == 0:
                outcome = "resolved"
            else:
                outcome = "unresolved"
        summary = {**metadata, "outcome": outcome, "resolved": outcome == "resolved", "agent": agent,
                   "acceptance": after.to_dict() if after else None,
                   "regression": regression.to_dict() if regression else None,
                   "patch_files": len(changes), "seconds": time.monotonic() - started,
                   "cost_usd": None}
        write_json(output / "summary.json", summary)
        trace.emit("run_finished", outcome=outcome)
        return summary
    except Exception as error:
        trace.emit("run_error", error=f"{type(error).__name__}: {error}")
        write_json(output / "error.json", {"task_id": task.id, "error": str(error)})
        raise


def unique_run(parent: Path) -> Path:
    return parent / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8])


def load_summaries(root: Path) -> list[dict]:
    if root.is_file():
        return [json.loads(root.read_text(encoding="utf-8"))]
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(root.rglob("summary.json"))]
