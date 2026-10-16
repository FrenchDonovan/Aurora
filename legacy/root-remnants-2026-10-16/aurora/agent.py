"""Explicit agent loop with finite steps, time, context and token accounting."""
from __future__ import annotations

from dataclasses import asdict
import json
import time

from aurora.providers import Provider
from aurora.failures import FailureClassifier, HINTS, failed_event, observable_event
from aurora.task import Budget
from aurora.tools import TOOL_GUIDE, Tools
from aurora.trace import Trace


def run_agent(provider: Provider, tools: Tools, budget: Budget, trace: Trace,
              failure_model: FailureClassifier | None = None) -> dict:
    started = time.monotonic()
    messages = [{"role": "system", "content": "You are Aurora, a careful coding agent.\n" + TOOL_GUIDE},
                {"role": "user", "content": json.dumps(tools.task.public_context())}]
    observations, intervened = [], False
    trace.emit("agent_started", budget=asdict(budget), provider=provider.identity(),
               messages=messages)
    status, steps, input_tokens, output_tokens, tool_calls = "step_limit", 0, 0, 0, 0
    final = None
    for step in range(budget.max_steps):
        remaining = budget.wall_seconds - (time.monotonic() - started)
        tokens_left = budget.max_tokens - input_tokens - output_tokens
        if remaining <= 0:
            status = "time_limit"
            break
        if tokens_left <= 0:
            status = "token_limit"
            break
        if len(json.dumps(messages)) > 64000:
            status = "context_limit"
            break
        steps = step + 1
        try:
            reply = provider.complete(messages, remaining, min(budget.response_tokens, tokens_left))
        except Exception as error:
            trace.emit("provider_error", error=f"{type(error).__name__}: {error}")
            status = "provider_error"
            break
        input_tokens += reply.input_tokens
        output_tokens += reply.output_tokens
        trace.emit("model_response", step=steps, content=reply.content,
                   input_tokens=reply.input_tokens, output_tokens=reply.output_tokens)
        messages.append({"role": "assistant", "content": reply.content})
        if time.monotonic() - started >= budget.wall_seconds:
            status = "time_limit"
            break
        if input_tokens + output_tokens > budget.max_tokens:
            status = "token_limit"
            break
        try:
            action = json.loads(reply.content)
            if not isinstance(action, dict):
                raise ValueError("Action must be an object")
            if set(action) == {"finish"} and isinstance(action["finish"], str):
                final, status = action["finish"], "finished"
                break
            if set(action) != {"tool", "arguments"} or not isinstance(action["tool"], str):
                raise ValueError("Expected tool + arguments, or finish")
            tool_calls += 1
            trace.emit("tool_requested", step=steps, tool=action["tool"], arguments=action["arguments"])
            remaining = budget.wall_seconds - (time.monotonic() - started)
            result = tools.call(action["tool"], action["arguments"], min(budget.test_seconds, remaining))
            trace.emit("tool_result", step=steps, tool=action["tool"], result=result)
            event = {"kind": "tool_result", "tool": action["tool"], "result": result}
        except Exception as error:
            result = {"error": f"{type(error).__name__}: {error}"}
            trace.emit("action_error", step=steps, result=result)
            event = {"kind": "action_error", "result": result}
        messages.append({"role": "user", "content": "Tool observation:\n" + json.dumps(result)[:14000]})
        if piece := observable_event(event):
            observations.append(piece)
        if failure_model and not intervened and failed_event(event):
            text = "\n".join(observations)[-24000:]
            label = failure_model.predict(text)
            messages.append({"role": "system", "content": "Failure-analysis suggestion: " + HINTS[label]})
            trace.emit("failure_intervention", label=label, model_sha256=failure_model.fingerprint())
            intervened = True
    if time.monotonic() - started >= budget.wall_seconds:
        status = "time_limit"
    outcome = {"status": status, "steps": steps, "tool_calls": tool_calls,
               "input_tokens": input_tokens, "output_tokens": output_tokens,
               "seconds": time.monotonic() - started, "final": final}
    trace.emit("agent_stopped", **outcome)
    return outcome
