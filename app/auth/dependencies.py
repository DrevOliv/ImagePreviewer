import hmac
from fastapi import Cookie, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from ..config import settings

_SESSION_VALUE = "ok"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.secret_key, salt="session")


def issue_token() -> str:
    return _serializer().dumps(_SESSION_VALUE)


def verify_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        value = _serializer().loads(token, max_age=settings.session_max_age)
    except (BadSignature, SignatureExpired):
        return False
    return value == _SESSION_VALUE


def check_password(candidate: str) -> bool:
    if not settings.password:
        return False
    return hmac.compare_digest(candidate, settings.password)


def require_auth(
    session: str | None = Cookie(default=None, alias=settings.session_cookie),
) -> None:
    if not verify_token(session):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
