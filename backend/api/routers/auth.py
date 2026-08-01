from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, require_admin
from backend.controllers import auth_controller
from backend.db.models import User
from backend.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserCreate,
    UserRead,
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
