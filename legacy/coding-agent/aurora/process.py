"""Bounded subprocess output and process-tree timeouts; no shell execution."""
from __future__ import annotations

from dataclasses import asdict, dataclass
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
import uuid


@dataclass
class Execution:
    returncode: int
    output: str
    timed_out: bool
    seconds: float
    truncated: bool = False

    def to_dict(self):
        return asdict(self)


def execute(argv: list[str], cwd: Path, timeout: float, env: dict | None = None,
            output_limit: int = 24000) -> Execution:
    started = time.monotonic()
    process = subprocess.Popen(argv, cwd=cwd, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, start_new_session=os.name != "nt")
    captured = bytearray()
    truncated = False

    def drain():
        nonlocal truncated
        with process.stdout:
            while chunk := process.stdout.read(4096):
                available = max(0, output_limit - len(captured))
                captured.extend(chunk[:available])
                truncated |= len(chunk) > available

    reader = threading.Thread(target=drain, daemon=True)
    reader.start()
    timed_out = False
    try:
        process.wait(timeout=max(0.01, timeout))
    except subprocess.TimeoutExpired:
        timed_out = True
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                           capture_output=True, timeout=10, check=False)
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.kill()
        process.wait(timeout=10)
    reader.join(timeout=2)
    return Execution(process.returncode, captured.decode("utf-8", errors="replace"), timed_out,
                     time.monotonic() - started, truncated)


class Runner:
    def __init__(self, backend: str = "docker", image: str = "python:3.12-slim",
                 allow_local: bool = False):
        if backend not in {"docker", "local"}:
            raise ValueError("Unknown execution backend")
        if backend == "local" and not allow_local:
            raise ValueError("Local execution requires --allow-local for trusted repositories")
        self.backend, self.image = backend, image

    def identity(self) -> dict:
        if self.backend == "local":
            return {"backend": "local", "python": sys.version, "isolated": False}
        result = execute(["docker", "image", "inspect", self.image, "--format", "{{.Id}}"],
                         Path.cwd(), 10)
        if result.returncode or result.timed_out:
            raise RuntimeError("Docker unavailable or image missing. Start Docker, then pull "
                               f"{self.image}. Details: {result.output[:1000]}")
        return {"backend": "docker", "image": self.image, "image_id": result.output.strip(),
                "network": "none", "memory": "512m", "cpus": 1, "pids": 64}

    def run(self, workspace: Path, command: tuple[str, ...], timeout: float) -> Execution:
        if self.backend == "local":
            argv = [sys.executable if command[0] == "python" else command[0], *command[1:]]
            # Local mode is explicitly trusted; this is environment minimization, not isolation.
            keep = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LANG"}
            env = {k: v for k, v in os.environ.items() if k.upper() in keep}
            env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8", PYTHONNOUSERSITE="1")
            return execute(argv, workspace, timeout, env)
        name = "aurora-" + uuid.uuid4().hex
        workspace = workspace.resolve()
        if "," in str(workspace):
            raise ValueError("Docker mount paths cannot contain commas")
        argv = ["docker", "run", "--rm", "--pull=never", "--name", name, "--init",
                "--network=none", "--read-only", "--cap-drop=ALL",
                "--security-opt=no-new-privileges", "--pids-limit=64", "--memory=512m",
                "--memory-swap=512m", "--cpus=1", "--user=65534:65534",
                "--tmpfs=/tmp:rw,noexec,nosuid,size=64m", "--env=PYTHONDONTWRITEBYTECODE=1",
                "--env=PYTHONIOENCODING=utf-8", "--mount",
                f"type=bind,source={workspace},target=/workspace,readonly",
                "--workdir=/workspace", "--entrypoint", command[0], self.image, *command[1:]]
        try:
            return execute(argv, workspace, timeout)
        finally:
            # Killing a Docker client does not necessarily stop its container.
            execute(["docker", "rm", "-f", name], workspace, 10, output_limit=1000)
