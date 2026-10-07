from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, require_admin
from backend.controllers import auth_controller
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

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth_controller.login(db=db, request=request)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return auth_controller.get_me(current_user)


@router.post("/users", response_model=UserRead, status_code=201, dependencies=[Depends(require_admin)])
def create_user(request: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    return auth_controller.create_user(db=db, request=request)


@router.patch("/password", response_model=UserRead)
def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    return auth_controller.change_password(db=db, user=current_user, request=request)


@router.patch("/profile", response_model=UserRead)
def update_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    return auth_controller.update_profile(db=db, user=current_user, request=request)


@router.get("/users", response_model=list[UserRead], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)) -> list[UserRead]:
    return auth_controller.list_users(db=db)


@router.patch("/users/{user_id}/status", response_model=UserRead, dependencies=[Depends(require_admin)])
def set_user_status(
    user_id: int,
    request: UserStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    return auth_controller.set_user_status(db=db, actor=current_user, user_id=user_id, request=request)
