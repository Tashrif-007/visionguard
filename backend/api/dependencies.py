import asyncio
from collections.abc import Generator

from fastapi import Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from backend.config import settings
from backend.db.database import SessionLocal
from backend.db.models import User
from backend.services import auth_service
from backend.services.auth_service import InvalidTokenError
from backend.services.capture_service import CapturePool

_bearer_scheme = HTTPBearer(auto_error=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_capture_pool(request: Request) -> CapturePool:
    return request.app.state.capture_pool


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    # Auth is enforced only here, at the router/dependency layer — never
    # inside services or controllers — per CLAUDE.md's auth rules. Raising
    # HTTPException in a dependency is the one place outside a controller
    # where that's correct, since dependencies belong to the router layer.
    try:
        return auth_service.get_user_from_token(db, credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


def get_capture_pool_ws(websocket: WebSocket) -> CapturePool:
    return websocket.app.state.capture_pool


def _user_from_token(token: str) -> User:
    db = SessionLocal()
    try:
        return auth_service.get_user_from_token(db, token)
    finally:
        db.close()


async def get_ws_user(websocket: WebSocket) -> User:
    """Authenticate a WebSocket from its first message (the bearer token).

    Browsers cannot set an Authorization header on a WebSocket, and a token in
    the URL would end up in server logs, so the client sends it as the first
    text frame instead. Like get_current_user, this is the only place auth is checked.
    """
    await websocket.accept()
    try:
        token = await asyncio.wait_for(
            websocket.receive_text(), timeout=settings.browser_stream_auth_timeout_seconds
        )
        return await run_in_threadpool(_user_from_token, token)
    except (asyncio.TimeoutError, InvalidTokenError, WebSocketDisconnect) as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized") from exc
