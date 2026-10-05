from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import User
from backend.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    TokenResponse,
    UserCreate,
    UserRead,
    UserStatusUpdate,
)
from backend.services import auth_service
from backend.services.auth_service import (
    InvalidCredentialsError,
    LastAdminError,
    SelfLockoutError,
    UserAlreadyExistsError,
    UserNotFoundError,
)


def login(db: Session, request: LoginRequest) -> TokenResponse:
    try:
        user = auth_service.authenticate(db, request.email, request.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    token, expires_in = auth_service.create_access_token(user)
    return TokenResponse(access_token=token, expires_in=expires_in)


def get_me(user: User) -> UserRead:
    return UserRead.model_validate(user)


def create_user(db: Session, request: UserCreate) -> UserRead:
    try:
        user = auth_service.create_user(
            db, name=request.name, email=request.email, password=request.password, role=request.role.value
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


def update_profile(db: Session, user: User, request: ProfileUpdateRequest) -> UserRead:
    try:
        updated = auth_service.update_profile(db, user, name=request.name, email=request.email)
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UserRead.model_validate(updated)


def list_users(db: Session) -> list[UserRead]:
    return [UserRead.model_validate(u) for u in auth_service.list_users(db)]


def set_user_status(db: Session, actor: User, user_id: int, request: UserStatusUpdate) -> UserRead:
    try:
        updated = auth_service.set_user_active(db, actor, user_id, request.is_active)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (SelfLockoutError, LastAdminError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UserRead.model_validate(updated)
