import hashlib
import threading
from pathlib import Path

from ..config import settings


_eviction_lock = threading.Lock()
# After an eviction pass, shrink to this fraction of the cap so we don't
# trigger a new eviction on every single write right after a sweep.
_LOW_WATER_RATIO = 0.9


def cache_path(source: Path, max_size: int, mime: str) -> Path:
    stat = source.stat()
    key = f"{source.resolve()}|{stat.st_mtime_ns}|{stat.st_size}|{max_size}|{mime}"
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
    extension = "webp" if "webp" in mime else "jpg"
    return settings.cache_root / digest[:2] / f"{digest}.{extension}"


def read_or_generate(source: Path, max_size: int, mime: str, generator) -> bytes:
    """Return cached preview bytes, generating and storing if missing.

    On cache hit we update the file's mtime so the eviction pass treats
    mtime as "last access time" — giving us a simple LRU policy.
    """
    path = cache_path(source, max_size, mime)
    if path.exists():
        _touch(path)
        return path.read_bytes()

    data = generator()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)
    _schedule_eviction()
    return data


def _touch(path: Path) -> None:
    try:
        path.touch(exist_ok=True)
    except OSError:
        pass


def _schedule_eviction() -> None:
    """Run eviction in the background so the request doesn't wait on it."""
    threading.Thread(target=_evict_if_needed, daemon=True).start()


def _evict_if_needed() -> None:
    # Only one eviction pass at a time; skip if another one is already running.
    if not _eviction_lock.acquire(blocking=False):
        return
    try:
        cap = settings.cache_max_mb * 1024 * 1024
        if cap <= 0:
            return

        entries: list[tuple[float, int, Path]] = []
        total = 0
        for entry in settings.cache_root.rglob("*"):
            if not entry.is_file():
                continue
            try:
                stat = entry.stat()
            except OSError:
                continue
            entries.append((stat.st_mtime, stat.st_size, entry))
            total += stat.st_size

        if total <= cap:
            return

        target = int(cap * _LOW_WATER_RATIO)
        entries.sort(key=lambda e: e[0])  # oldest first
        for _, size, path in entries:
            if total <= target:
                break
            try:
                path.unlink()
                total -= size
            except OSError:
                pass
    finally:
        _eviction_lock.release()
