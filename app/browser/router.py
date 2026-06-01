import os
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from ..auth.dependencies import require_auth
from ..fs import is_hidden, resolve_safe, to_relative
from ..preview.registry import is_previewable
from ..video import is_video


router = APIRouter(prefix="/api/browse", tags=["browser"], dependencies=[Depends(require_auth)])

# Recursive folder sizes are cached briefly so repeatedly opening the same
# folder (or bouncing between siblings) doesn't re-walk the tree every time.
_SIZE_TTL = 60.0          # seconds a computed size stays fresh
_SIZE_CACHE_MAX = 512     # bound the cache so it can't grow without limit
_size_cache: dict[str, tuple[float, dict]] = {}


def _has_subfolders(path) -> bool:
    try:
        with os.scandir(path) as it:
            for entry in it:
                if entry.name.startswith("."):
                    continue
                try:
                    if entry.is_dir(follow_symlinks=False):
                        return True
                except OSError:
                    continue
    except OSError:
        pass
    return False


def _entry(path, kind: str) -> dict:
    try:
        stat = path.stat()
        size = stat.st_size if kind == "file" else None
        mtime = stat.st_mtime
    except OSError:
        size, mtime = None, None

    item = {
        "name": path.name,
        "path": to_relative(path),
        "type": kind,
    }
    if kind == "file":
        video = is_video(path.suffix)
        item["size"] = size
        item["mtime"] = mtime
        item["previewable"] = video or is_previewable(path.suffix)
        item["is_video"] = video
        item["extension"] = path.suffix.lstrip(".").lower()
    else:
        item["has_subfolders"] = _has_subfolders(path)
    return item


@router.get("")
def browse(path: str = "") -> dict:
    target = resolve_safe(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")

    folders, files = [], []
    try:
        entries = list(target.iterdir())
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    for entry in entries:
        if is_hidden(entry):
            continue
        if entry.is_dir():
            folders.append(_entry(entry, "folder"))
        elif entry.is_file():
            files.append(_entry(entry, "file"))

    folders.sort(key=lambda e: e["name"].lower())
    files.sort(key=lambda e: e["name"].lower())

    return {
        "path": to_relative(target),
        "folders": folders,
        "files": files,
    }


def _dir_size(root: Path) -> tuple[int, int]:
    """Recursively total the file bytes and file count under ``root``.

    Hidden entries (dot-files) are skipped and symlinked directories are not
    followed, mirroring how the browser lists folders and avoiding loops.
    """
    total = files = 0
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            entries = current.iterdir()
        except OSError:
            continue
        for entry in entries:
            if entry.name.startswith("."):
                continue
            try:
                if entry.is_symlink():
                    continue
                if entry.is_dir():
                    stack.append(entry)
                elif entry.is_file():
                    total += entry.stat().st_size
                    files += 1
            except OSError:
                continue
    return total, files


@router.get("/size")
def folder_size(path: str = "") -> dict:
    """Total size on disk of the given folder, including all subfolders.

    Defined as a sync endpoint so FastAPI runs the (blocking) directory walk in
    its threadpool rather than stalling the event loop. Results are cached for
    a short while; see ``_SIZE_TTL``.
    """
    target = resolve_safe(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")

    rel = to_relative(target)
    now = time.monotonic()
    cached = _size_cache.get(rel)
    if cached and cached[0] > now:
        return cached[1]

    total, files = _dir_size(target)
    result = {"path": rel, "bytes": total, "files": files}

    if len(_size_cache) >= _SIZE_CACHE_MAX:
        _size_cache.clear()
    _size_cache[rel] = (now + _SIZE_TTL, result)
    return result
