import logging
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.repositories import user_repository

logger = logging.getLogger(__name__)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fixed dummy hash used to keep authenticate() at a constant time whether or
# not the email exists, so login timing can't disclose registered emails.
_DUMMY_HASH = _pwd_context.hash("dummy-password-for-timing-safety")


class InvalidCredentialsError(Exception):
    """Raised when an email/password pair does not authenticate."""


class UserAlreadyExistsError(Exception):
    """Raised when creating/updating a user to an email already taken."""


class InvalidTokenError(Exception):
    """Raised when a bearer token is missing, expired, malformed, or unknown."""


class UserNotFoundError(Exception):
    """Raised when an operation targets a user id that doesn't exist."""


class SelfLockoutError(Exception):
    """Raised when an admin tries to deactivate their own account."""


class LastAdminError(Exception):
    """Raised when deactivating a user would leave zero active admins."""


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def authenticate(db: Session, email: str, password: str) -> User:
    user = user_repository.get_by_email(db, email)
    if user is None:
        verify_password(password, _DUMMY_HASH)
        raise InvalidCredentialsError("Invalid email or password")
    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("Invalid email or password")
    if not user.is_active:
        # Same generic message as a wrong password — deliberately
        # indistinguishable, consistent with this function's no-enumeration
        # design (see _DUMMY_HASH above).
        raise InvalidCredentialsError("Invalid email or password")
    return user


def create_access_token(user: User) -> tuple[str, int]:
    expires_in = settings.jwt_expire_minutes * 60
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def get_user_from_token(db: Session, token: str) -> User:
    try:
        claims = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = int(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise InvalidTokenError("Invalid or expired token") from exc

    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise InvalidTokenError("Token refers to a user that no longer exists")
    return user


def create_user(db: Session, name: str, email: str, password: str, role: str) -> User:
    if user_repository.get_by_email(db, email) is not None:
        raise UserAlreadyExistsError(f"Email '{email}' is already registered")
    return user_repository.create_user(db, name=name, email=email, password_hash=hash_password(password), role=role)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    if not verify_password(current_password, user.password_hash):
        raise InvalidCredentialsError("Current password is incorrect")
    return user_repository.update_password(db, user, hash_password(new_password))


def update_profile(db: Session, user: User, name: str, email: str) -> User:
    if email != user.email and user_repository.get_by_email(db, email) is not None:
        raise UserAlreadyExistsError(f"Email '{email}' is already registered")
    return user_repository.update_profile(db, user, name=name, email=email)


def list_users(db: Session) -> list[User]:
    return user_repository.list_users(db)


def set_user_active(db: Session, actor: User, user_id: int, is_active: bool) -> User:
    target = user_repository.get_by_id(db, user_id)
    if target is None:
        raise UserNotFoundError(f"User {user_id} not found")
    if not is_active:
        if target.id == actor.id:
            raise SelfLockoutError("You cannot deactivate your own account")
        if target.role == "admin" and user_repository.count_active_admins(db) <= 1:
            raise LastAdminError("Cannot deactivate the last active admin")
    return user_repository.set_active(db, target, is_active)


def seed_admin(db: Session) -> None:
    if user_repository.count_users(db) > 0:
        return
    if not settings.admin_password:
        logger.warning(
            "No users exist and ADMIN_PASSWORD is not set — skipping admin seeding. "
            "Set ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD in .env and restart to create the initial admin."
        )
        return
    user_repository.create_user(
        db,
        name=settings.admin_name,
        email=settings.admin_email,
        password_hash=hash_password(settings.admin_password),
        role="admin",
    )
    logger.info("Seeded initial admin user '%s'", settings.admin_email)
