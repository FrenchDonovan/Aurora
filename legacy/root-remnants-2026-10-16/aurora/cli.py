from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import subprocess

from aurora.demo import prepare_demo, run_demo
from aurora.evaluation import load_summaries, run_task, unique_run
from aurora.failures import FailureClassifier, LABELS, failure_text, train_and_evaluate
from aurora.metrics import paired_report, report
from aurora.process import Runner
from aurora.providers import OllamaProvider
from aurora.task import Budget, Task
from aurora.trace import write_json


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Aurora — evaluation-driven coding agent")
    sub = parser.add_subparsers(dest="command", required=True)
    demo = sub.add_parser("demo", help="Run the trusted, scripted integration fixture; no LLM")
    demo.add_argument("--backend", choices=["local", "docker"], default="local")
    demo.add_argument("--output", type=Path, default=Path(".aurora/demo"))
    prepare = sub.add_parser("prepare-demo", help="Prepare the fixture for a real model attempt")
    prepare.add_argument("--output", type=Path, default=Path(".aurora/tasks"))
    run = sub.add_parser("run", help="Attempt an operator-owned local Git task using Ollama")
    run.add_argument("task", type=Path)
    run.add_argument("--model", required=True, help="An exact model name already installed in Ollama")
    run.add_argument("--endpoint", default="http://127.0.0.1:11434")
    run.add_argument("--backend", choices=["docker", "local"], default="docker")
    run.add_argument("--allow-local", action="store_true", help="Allow host code execution for trusted tasks")
    run.add_argument("--image", default="python:3.12-slim")
    run.add_argument("--output", type=Path, default=Path(".aurora/runs"))
    run.add_argument("--max-steps", type=int, default=20)
    run.add_argument("--max-tokens", type=int, default=24000)
    run.add_argument("--wall-seconds", type=float, default=300)
    run.add_argument("--test-seconds", type=float, default=30)
    run.add_argument("--failure-model", type=Path)
    stats = sub.add_parser("report", help="Report one configuration, with one attempt per task")
    stats.add_argument("runs", type=Path)
    stats.add_argument("--output", type=Path)
    paired = sub.add_parser("compare", help="Compare two configurations on paired tasks")
    paired.add_argument("left", type=Path)
    paired.add_argument("right", type=Path)
    annotate = sub.add_parser("annotation", help="Export a failure prefix for manual labeling")
    annotate.add_argument("run", type=Path)
    annotate.add_argument("--repository-group", required=True, help="Stable project identity, e.g. owner/repo")
    annotate.add_argument("--split", choices=["train", "validation"], required=True)
    annotate.add_argument("--output", type=Path, required=True)
    train = sub.add_parser("train-failures", help="Train/evaluate a CPU Naive Bayes failure classifier")
    train.add_argument("dataset", type=Path)
    train.add_argument("--output", type=Path, default=Path("models/failure-nb.json"))
    args = parser.parse_args(argv)
    project = Path(__file__).resolve().parent.parent
    try:
        if args.command == "demo":
            summary, path = run_demo(args.output, project, args.backend)
            print(json.dumps({"outcome": summary["outcome"], "synthetic": True,
                              "note": "Scripted plumbing demo; no model inference or benchmark evidence.",
                              "run": str(path.resolve()), "report": report([summary])}, indent=2))
            return 0 if summary["resolved"] else 1
        if args.command == "prepare-demo":
            print(prepare_demo(args.output, project).resolve())
            return 0
        if args.command == "run":
            task = Task.load(args.task)
            budget = Budget(args.max_steps, args.max_tokens, args.wall_seconds, args.test_seconds)
            model = FailureClassifier.load(args.failure_model) if args.failure_model else None
            if model and task.split == "test":
                if task.id in model.state.get("train_task_ids", []):
                    raise ValueError("Test task was used to train this failure classifier")
            path = unique_run(args.output)
            summary = run_task(task, OllamaProvider(args.model, args.endpoint),
                               Runner(args.backend, args.image, args.allow_local), path, budget, model)
            print(json.dumps({"outcome": summary["outcome"], "run": str(path.resolve())}, indent=2))
            return 0 if summary["resolved"] else 1
        if args.command == "report":
            result = report(load_summaries(args.runs))
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                write_json(args.output, result)
        elif args.command == "compare":
            result = paired_report(load_summaries(args.left), load_summaries(args.right))
        elif args.command == "annotation":
            metadata = json.loads((args.run / "metadata.json").read_text(encoding="utf-8"))
            if metadata["split"] == "test":
                raise ValueError("Held-out test trajectories cannot enter classifier development")
            result = {"task_id": metadata["task_id"], "repository_group": args.repository_group,
                      "split": args.split, "label": None,
                      "text": failure_text(args.run / "trace.jsonl"),
                      "synthetic": metadata["provider"].get("synthetic", False)}
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with args.output.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(result) + "\n")
            print(f"Appended annotation candidate. Manually set label to one of: {', '.join(LABELS)}")
            return 0
        else:
            result = train_and_evaluate(args.dataset, args.output)
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Aurora: {error}", file=sys.stderr)
        return 2
