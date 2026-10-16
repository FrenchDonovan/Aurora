from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import time


class Trace:
    def __init__(self, path: Path):
        self.path, self.started, self.sequence = path, time.monotonic(), 0

    def emit(self, kind: str, **payload):
        record = {"sequence": self.sequence, "at": datetime.now(timezone.utc).isoformat(),
                  "elapsed_seconds": time.monotonic() - self.started, "kind": kind, **payload}
        self.sequence += 1
        with self.path.open("a", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_json(path: Path, content):
    path.write_text(json.dumps(content, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
