import json
import threading
from pathlib import Path

from ..config import settings


class LikeStore:
    """Tiny JSON-backed set of liked file paths.

    Easy to swap out for a real database later — keep the interface stable.
    """

    def __init__(self, file: Path) -> None:
        self._file = file
        self._lock = threading.Lock()
        self._file.parent.mkdir(parents=True, exist_ok=True)
        if not self._file.exists():
            self._file.write_text("[]")

    def _read(self) -> set[str]:
        try:
            return set(json.loads(self._file.read_text() or "[]"))
        except json.JSONDecodeError:
            return set()

    def _write(self, items: set[str]) -> None:
        tmp = self._file.with_suffix(self._file.suffix + ".tmp")
        tmp.write_text(json.dumps(sorted(items), indent=2))
        tmp.replace(self._file)

    def list(self) -> list[str]:
        with self._lock:
            return sorted(self._read())

    def is_liked(self, path: str) -> bool:
        with self._lock:
            return path in self._read()

    def toggle(self, path: str) -> bool:
        with self._lock:
            items = self._read()
            if path in items:
                items.remove(path)
                liked = False
            else:
                items.add(path)
                liked = True
            self._write(items)
            return liked


store = LikeStore(settings.state_root / "likes.json")
