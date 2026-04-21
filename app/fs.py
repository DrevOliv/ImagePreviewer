from pathlib import Path
from fastapi import HTTPException

from .config import settings


def resolve_safe(relative: str) -> Path:
    """Resolve a user-supplied relative path inside DATA_ROOT.

    Raises 400 for invalid paths and 403 for attempts to escape the root.
    """
    relative = (relative or "").lstrip("/")
    candidate = (settings.data_root / relative).resolve()
    try:
        candidate.relative_to(settings.data_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Path outside data root")
    return candidate


def to_relative(path: Path) -> str:
    return str(path.resolve().relative_to(settings.data_root)).replace("\\", "/")


def is_hidden(path: Path) -> bool:
    return path.name.startswith(".")
