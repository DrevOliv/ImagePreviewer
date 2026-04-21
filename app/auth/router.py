from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from ..config import settings
from .dependencies import check_password, issue_token


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(body: LoginRequest, response: Response) -> dict:
    if not check_password(body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    response.set_cookie(
        key=settings.session_cookie,
        value=issue_token(),
        max_age=settings.session_max_age,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(settings.session_cookie)
    return {"ok": True}
