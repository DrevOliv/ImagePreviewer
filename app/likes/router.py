from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.dependencies import require_auth
from ..fs import resolve_safe, to_relative
from .store import store


router = APIRouter(prefix="/api/likes", tags=["likes"], dependencies=[Depends(require_auth)])


class PathBody(BaseModel):
    path: str


@router.get("")
def list_likes() -> dict:
    return {"liked": store.list()}


@router.post("/toggle")
def toggle(body: PathBody) -> dict:
    target = resolve_safe(body.path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    rel = to_relative(target)
    liked = store.toggle(rel)
    return {"path": rel, "liked": liked}
