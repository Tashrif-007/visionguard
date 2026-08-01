from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import User
from backend.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserCreate,
    UserRead,
)
from backend.services import auth_service
from backend.services.auth_service import InvalidCredentialsError, UserAlreadyExistsError


def login(db: Session, request: LoginRequest) -> TokenResponse:
    try:
        user = auth_service.authenticate(db, request.username, request.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    token, expires_in = auth_service.create_access_token(user)
    return TokenResponse(access_token=token, expires_in=expires_in)


def get_me(user: User) -> UserRead:
    return UserRead.model_validate(user)


def create_user(db: Session, request: UserCreate) -> UserRead:
    try:
        user = auth_service.create_user(
            db, username=request.username, password=request.password, role=request.role.value
        )
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UserRead.model_validate(user)


def change_password(db: Session, user: User, request: PasswordChangeRequest) -> UserRead:
    try:
        updated = auth_service.change_password(
            db, user, current_password=request.current_password, new_password=request.new_password
        )
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return UserRead.model_validate(updated)
