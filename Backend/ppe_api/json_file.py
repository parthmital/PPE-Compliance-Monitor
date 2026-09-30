"""A JSON document on disk with atomic writes."""

import json
import logging
import os
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)


class JsonFile:
    def __init__(self, path: Path, default: Callable[[], Any]):
        self.path = path
        self._default = default

    def load(self) -> Any:
        if not self.path.exists():
            return self._default()
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            logger.exception("Failed to read %s; using defaults", self.path)
            return self._default()

    def save(self, data: Any) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        try:
            tmp.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError:
            logger.exception("Failed to write %s", self.path)

    def delete(self) -> None:
        self.path.unlink(missing_ok=True)
