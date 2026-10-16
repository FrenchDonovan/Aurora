"""Replay fixtures and local Ollama inference behind one small protocol."""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Protocol
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


@dataclass
class Reply:
    content: str
    input_tokens: int = 0
    output_tokens: int = 0


class Provider(Protocol):
    def identity(self) -> dict: ...
    def complete(self, messages: list[dict], timeout: float, max_output: int) -> Reply: ...


class ReplayProvider:
    """Deliberately scripted integration fixture, never a model benchmark."""
    def __init__(self, actions: list[dict]):
        self.actions, self.index = actions, 0

    def identity(self):
        import hashlib
        return {"provider": "replay", "model": None, "synthetic": True,
                "script_sha256": hashlib.sha256(json.dumps(self.actions, sort_keys=True).encode()).hexdigest()}

    def complete(self, messages, timeout, max_output):
        if self.index >= len(self.actions):
            raise ValueError("Replay script exhausted before finish")
        action = self.actions[self.index]
        self.index += 1
        return Reply(json.dumps(action))


class OllamaProvider:
    def __init__(self, model: str, endpoint: str = "http://127.0.0.1:11434"):
        parsed = urlsplit(endpoint)
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
            raise ValueError("Use an HTTP(S) endpoint without embedded credentials")
        if not parsed.hostname or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
            raise ValueError("Endpoint must be an origin, such as http://127.0.0.1:11434")
        self.model, self.endpoint = model, endpoint.rstrip("/")

    def identity(self):
        return {"provider": "ollama", "model": self.model, "endpoint": self.endpoint,
                "synthetic": False, "temperature": 0, "seed": 42}

    def complete(self, messages, timeout, max_output):
        body = {"model": self.model, "messages": messages, "stream": False, "format": "json",
                "options": {"temperature": 0, "seed": 42, "num_predict": max_output}}
        request = Request(self.endpoint + "/api/chat", json.dumps(body).encode(),
                          {"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=max(0.01, timeout)) as response:
            raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("Provider response exceeds 1 MB")
        data = json.loads(raw)
        if not data.get("done") or not isinstance(data.get("message", {}).get("content"), str):
            raise ValueError("Invalid or incomplete Ollama response")
        counts = [data.get("prompt_eval_count"), data.get("eval_count")]
        if any(type(value) is not int or value < 0 for value in counts):
            raise ValueError("Provider must report nonnegative token usage")
        return Reply(data["message"]["content"], *counts)
