import hashlib
import threading
import time
from pathlib import Path

from ..config import settings


# After an eviction pass, shrink to this fraction of the cap so we don't
# immediately cross the threshold again on the very next write.
_LOW_WATER_RATIO = 0.9

_sweeper_started = False
_sweeper_lock = threading.Lock()


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
    return data


def _touch(path: Path) -> None:
    try:
        path.touch(exist_ok=True)
    except OSError:
        pass


def start_sweeper() -> None:
    """Start the background thread that periodically trims the cache.

    Safe to call multiple times; only the first call actually starts the
    thread. The thread is daemonic so it exits with the process.
    """
    global _sweeper_started
    with _sweeper_lock:
        if _sweeper_started:
            return
        _sweeper_started = True

    thread = threading.Thread(target=_sweep_loop, name="cache-sweeper", daemon=True)
    thread.start()


def _sweep_loop() -> None:
    # Run once at startup so an over-cap cache doesn't linger.
    _evict_if_needed()
    interval = max(10, settings.cache_sweep_interval)
    while True:
        time.sleep(interval)
        _evict_if_needed()


def _evict_if_needed() -> None:
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
