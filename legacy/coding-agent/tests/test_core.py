from __future__ import annotations

from dataclasses import replace
import json
import os
from pathlib import Path
import tempfile
import unittest

from aurora.agent import run_agent
from aurora.demo import prepare_demo
from aurora.evaluation import run_task
from aurora.failures import FailureClassifier, failure_text, train_and_evaluate
from aurora.metrics import paired_report, report, wilson
from aurora.process import Runner, execute
from aurora.providers import ReplayProvider, Reply
from aurora.repository import apply_patch, make_patch, safe_path
from aurora.task import Budget, Task, relative_name
from aurora.tools import Tools
from aurora.trace import Trace

PROJECT = Path(__file__).resolve().parents[1]


class PathTests(unittest.TestCase):
    def test_rejects_escape_and_windows_paths(self):
        for name in ("../secret", "/secret", "C:/secret", "folder/../../secret", "a\\b", ".git/config", "a//b",
                     "NUL.py", "CON", "a/COM1.txt", ".git /config", "a/.. /secret"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                relative_name(name)

    def test_rejects_symlinks_when_supported(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            outside, workspace = root / "outside", root / "workspace"
            outside.mkdir()
            workspace.mkdir()
            try:
                (workspace / "link").symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("OS denies symlink creation")
            with self.assertRaises(ValueError):
                safe_path(workspace, "link/file.py")

    def test_patch_rejects_wrong_preimage_and_non_allowlisted_file(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "app.py").write_text("old", encoding="utf-8")
            change = {"path": "app.py", "old_sha256": "wrong", "content": "new"}
            with self.assertRaises(ValueError):
                apply_patch(root, [change], ("app.py",))
            with self.assertRaises(ValueError):
                apply_patch(root, [change], ("other.py",))


class BudgetTests(unittest.TestCase):
    def test_rejects_invalid_budget(self):
        for value in (0, -1, float("nan"), float("inf"), True):
            with self.subTest(value=value), self.assertRaises(ValueError):
                Budget(wall_seconds=value)
        with self.assertRaises(ValueError):
            Budget(max_steps=1.5)

    def test_process_timeout_and_output_limit(self):
        import sys
        result = execute([sys.executable, "-c", "import time; print('x'*10000, flush=True); time.sleep(5)"],
                         PROJECT, .3, output_limit=100)
        self.assertTrue(result.timed_out)
        self.assertTrue(result.truncated)
        self.assertEqual(len(result.output), 100)

    def test_local_requires_explicit_opt_in(self):
        with self.assertRaises(ValueError):
            Runner("local")


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        (self.workspace / "app.py").write_text("answer = 1\n", encoding="utf-8")
        self.task = Task("test", self.root, "HEAD", "Fix the answer", ("app.py",),
                         ("python", "-c", "print('ok')"), self.root, ("python", "-c", "pass"))
        self.tools = Tools(self.workspace, self.task, Runner("local", allow_local=True))
        self.trace = Trace(self.root / "trace.jsonl")

    def tearDown(self):
        self.temp.cleanup()

    def test_rejects_unauthorized_edits_and_arbitrary_commands(self):
        for tool, arguments in (("replace_text", {"path": "tests.py", "old": "x", "new": "y"}),
                                ("run_tests", {"command": "dangerous"}), ("shell", {})):
            with self.subTest(tool=tool), self.assertRaises(ValueError):
                self.tools.call(tool, arguments, 1)

    def test_exact_replacement_rejects_ambiguous_preimage(self):
        (self.workspace / "app.py").write_text("x = x", encoding="utf-8")
        with self.assertRaises(ValueError):
            self.tools.call("replace_text", {"path": "app.py", "old": "x", "new": "y"}, 1)

    def test_step_limit_stops_model(self):
        provider = ReplayProvider([{"tool": "list_files", "arguments": {}}] * 3)
        result = run_agent(provider, self.tools, Budget(max_steps=2), self.trace)
        self.assertEqual(result["status"], "step_limit")
        self.assertEqual(provider.index, 2)

    def test_malformed_action_can_recover(self):
        provider = ReplayProvider([{"wrong": "format"}, {"finish": "No patch"}])
        result = run_agent(provider, self.tools, Budget(), self.trace)
        self.assertEqual(result["status"], "finished")
        self.assertIn("action_error", self.trace.path.read_text())

    def test_reported_token_overrun_prevents_tool_execution(self):
        class HugeReply:
            def identity(self):
                return {"provider": "test"}

            def complete(self, *args):
                return Reply(json.dumps({"tool": "replace_text", "arguments": {
                    "path": "app.py", "old": "1", "new": "2"}}), 1000, 1000)

        result = run_agent(HugeReply(), self.tools, Budget(max_tokens=10), self.trace)
        self.assertEqual(result["status"], "token_limit")
        self.assertEqual((self.workspace / "app.py").read_text(), "answer = 1\n")

    def test_failure_intervention_occurs_once_and_uses_observations(self):
        model = FailureClassifier.fit([
            {"label": "edit", "text": "ValueError preimage editable_paths"},
            {"label": "test_failure", "text": "AssertionError assertion failed"},
        ])
        provider = ReplayProvider([
            {"tool": "replace_text", "arguments": {"path": "app.py", "old": "missing", "new": "2"}},
            {"tool": "replace_text", "arguments": {"path": "app.py", "old": "missing", "new": "2"}},
            {"finish": "done"},
        ])
        run_agent(provider, self.tools, Budget(), self.trace, model)
        events = [json.loads(line) for line in self.trace.path.read_text().splitlines()]
        interventions = [row for row in events if row["kind"] == "failure_intervention"]
        self.assertEqual(len(interventions), 1)
        self.assertEqual(interventions[0]["label"], "edit")
        self.assertNotIn("missing dependencies", failure_text(self.trace.path))


class HarnessTests(unittest.TestCase):
    def test_scripted_fix_and_clean_independent_grading(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task_path = prepare_demo(root / "fixtures", PROJECT)
            task = Task.load(task_path)
            actions = json.loads((task_path.parent / "replay.json").read_text())
            summary = run_task(task, ReplayProvider(actions), Runner("local", allow_local=True),
                               root / "run", Budget())
            self.assertTrue(summary["resolved"])
            self.assertEqual(summary["baseline"]["returncode"], 1)
            self.assertEqual(summary["acceptance"]["returncode"], 0)
            self.assertFalse((root / "run/workspace/.aurora_eval").exists())
            self.assertIn("BUG", (task.repository / "config_parser.py").read_text())

    def test_finish_claim_is_not_resolution(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task = Task.load(prepare_demo(root / "fixtures", PROJECT))
            summary = run_task(task, ReplayProvider([{"finish": "All fixed!"}]),
                               Runner("local", allow_local=True), root / "run", Budget())
            self.assertFalse(summary["resolved"])
            self.assertEqual(summary["outcome"], "unresolved")

    def test_already_passing_baseline_does_not_call_model(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task = Task.load(prepare_demo(root / "fixtures", PROJECT))
            task = replace(task, evaluation_command=("python", "-c", "pass"))
            provider = ReplayProvider([])
            summary = run_task(task, provider, Runner("local", allow_local=True), root / "run", Budget())
            self.assertEqual(summary["outcome"], "invalid_baseline")
            self.assertEqual(provider.index, 0)


class LearningTests(unittest.TestCase):
    def rows(self):
        return [
            {"task_id": "a", "repository_group": "repo-a", "split": "train", "label": "edit",
             "text": "replacement preimage missing unique edit"},
            {"task_id": "b", "repository_group": "repo-a", "split": "train", "label": "environment",
             "text": "dependency missing module import package"},
            {"task_id": "c", "repository_group": "repo-b", "split": "validation", "label": "edit",
             "text": "preimage edit unique absent"},
            {"task_id": "d", "repository_group": "repo-b", "split": "validation", "label": "environment",
             "text": "missing module package dependency unavailable"},
        ]

    def train(self, rows):
        with tempfile.TemporaryDirectory() as temp:
            dataset = Path(temp) / "data.jsonl"
            dataset.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            return train_and_evaluate(dataset, Path(temp) / "model.json")

    def test_learned_baseline_and_metrics(self):
        result = self.train(self.rows())
        self.assertEqual(result["learned"]["accuracy"], 1)
        self.assertEqual(result["majority"]["accuracy"], .5)

    def test_rejects_repository_leakage(self):
        rows = self.rows()
        rows[-1]["repository_group"] = "repo-a"
        with self.assertRaisesRegex(ValueError, "leakage"):
            self.train(rows)

    def test_rejects_duplicate_text_across_partitions(self):
        rows = self.rows()
        rows[-1]["text"] = rows[0]["text"]
        with self.assertRaisesRegex(ValueError, "Identical text"):
            self.train(rows)

    def test_rejects_test_partition_and_unlabeled_rows(self):
        for field, value in (("split", "test"), ("label", None)):
            rows = self.rows()
            rows[0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.train(rows)

    def test_grader_output_is_excluded_from_features(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "trace.jsonl"
            events = [{"kind": "baseline_graded", "result": {"output": "SECRET EVALUATOR"}},
                      {"kind": "tool_result", "tool": "run_tests", "result": {"returncode": 1, "output": "assertion failed"}},
                      {"kind": "tool_result", "tool": "read_file", "result": {"content": "FUTURE"}}]
            path.write_text("\n".join(json.dumps(event) for event in events), encoding="utf-8")
            text = failure_text(path)
            self.assertIn("assertion failed", text)
            self.assertNotIn("SECRET", text)
            self.assertNotIn("FUTURE", text)


class MetricsTests(unittest.TestCase):
    def row(self, key="a", resolved=True):
        return {"task_fingerprint": key, "provider": {"synthetic": False}, "runner": {"backend": "docker"},
                "budget": {"max_steps": 10}, "intervention": None, "seconds": 2.0,
                "outcome": "resolved" if resolved else "unresolved", "resolved": resolved,
                "agent": {"tool_calls": 3, "input_tokens": 20, "output_tokens": 10}, "cost_usd": None}

    def test_unknown_cost_stays_unknown(self):
        self.assertIsNone(report([self.row()])["cost_per_resolved_usd"])

    def test_duplicates_and_mixed_configurations_are_rejected(self):
        row = self.row("b")
        row["budget"] = {"max_steps": 20}
        for rows in ([self.row(), self.row()], [self.row(), row]):
            with self.assertRaises(ValueError):
                report(rows)

    def test_wilson_interval_small_sample(self):
        lower, upper = wilson(1, 1)
        self.assertAlmostEqual(lower, .2065493144)
        self.assertAlmostEqual(upper, 1)
        self.assertIsNone(wilson(0, 0))

    def test_paired_comparison_and_task_mismatch(self):
        result = paired_report([self.row(resolved=False)], [self.row()])
        self.assertEqual(result["resolution_difference_pp"], 100)
        self.assertEqual(result["mcnemar_exact_p"], 1)
        with self.assertRaises(ValueError):
            paired_report([self.row()], [self.row("b")])


if __name__ == "__main__":
    unittest.main()
