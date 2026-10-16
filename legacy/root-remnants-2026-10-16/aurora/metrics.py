"""Task-level statistics. Duplicate attempts cannot masquerade as pass@1."""
from __future__ import annotations

import math
import statistics


def wilson(successes: int, count: int) -> list[float] | None:
    if not count:
        return None
    z = 1.959963984540054
    p, denominator = successes / count, 1 + z * z / count
    center = (p + z * z / (2 * count)) / denominator
    radius = z * math.sqrt(p * (1 - p) / count + z * z / (4 * count * count)) / denominator
    return [max(0, center - radius), min(1, center + radius)]


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * p
    lower, upper = math.floor(index), math.ceil(index)
    return values[lower] + (values[upper] - values[lower]) * (index - lower)


def report(rows: list[dict]) -> dict:
    keys = [row["task_fingerprint"] for row in rows]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate tasks: select exactly one attempt per task and configuration")
    # Single-configuration reports must not mix interventions, inference budgets or models.
    import json
    configurations = {json.dumps({key: row.get(key) for key in ("provider", "runner", "budget", "intervention")},
                                 sort_keys=True) for row in rows}
    if len(configurations) > 1:
        raise ValueError("Mixed configurations: report each configuration separately")
    valid = [row for row in rows if row["outcome"] != "invalid_baseline"]
    successes = sum(row["resolved"] for row in valid)
    costs = [row.get("cost_usd") for row in valid]
    complete_cost = bool(costs) and all(value is not None for value in costs)
    latencies = [row["seconds"] for row in valid]
    return {"runs": len(rows), "eligible_tasks": len(valid), "invalid_baselines": len(rows) - len(valid),
            "resolved": successes, "pass_at_1": successes / len(valid) if valid else None,
            "resolution_95pct_wilson": wilson(successes, len(valid)),
            "latency_median_seconds": statistics.median(latencies) if latencies else None,
            "latency_p95_seconds": percentile(latencies, .95),
            "total_reported_tokens": sum((row.get("agent") or {}).get("input_tokens", 0) +
                                         (row.get("agent") or {}).get("output_tokens", 0) for row in valid),
            "total_tool_calls": sum((row.get("agent") or {}).get("tool_calls", 0) for row in valid),
            "cost_per_resolved_usd": sum(costs) / successes if complete_cost and successes else None,
            "synthetic": any(row["provider"].get("synthetic", False) or
                             row.get("intervention_training_synthetic", False) for row in rows),
            "outcomes": {outcome: sum(row["outcome"] == outcome for row in rows)
                         for outcome in sorted({row["outcome"] for row in rows})}}


def paired_report(left: list[dict], right: list[dict]) -> dict:
    report(left)
    report(right)
    a = {row["task_fingerprint"]: row for row in left}
    b = {row["task_fingerprint"]: row for row in right}
    if not a or a.keys() != b.keys():
        raise ValueError("Paired experiments need exactly the same nonempty task set")
    for key in a:
        for field in ("runner", "budget"):
            if a[key][field] != b[key][field]:
                raise ValueError("Paired experiments require the same runtime and inference budget")
        if a[key]["outcome"] == "invalid_baseline" or b[key]["outcome"] == "invalid_baseline":
            raise ValueError("Exclude invalid baselines before paired comparison")
        if a[key]["provider"].get("synthetic") or b[key]["provider"].get("synthetic"):
            raise ValueError("Replay fixtures are not model-improvement experiments")
        if a[key].get("intervention_training_synthetic") or b[key].get("intervention_training_synthetic"):
            raise ValueError("Use real training observations before reporting a learned improvement")
    wins = sum(not a[key]["resolved"] and b[key]["resolved"] for key in a)
    losses = sum(a[key]["resolved"] and not b[key]["resolved"] for key in a)
    n = wins + losses
    # Exact two-sided McNemar test on discordant pairs.
    p = min(1.0, 2 * sum(math.comb(n, k) for k in range(min(wins, losses) + 1)) / 2 ** n) if n else 1.0
    return {"tasks": len(a), "right_only_resolved": wins, "left_only_resolved": losses,
            "resolution_difference_pp": 100 * (wins - losses) / len(a),
            "mcnemar_exact_p": p}
