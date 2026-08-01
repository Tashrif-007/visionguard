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
# not the username exists, so login timing can't disclose valid usernames.
_DUMMY_HASH = _pwd_context.hash("dummy-password-for-timing-safety")


class InvalidCredentialsError(Exception):
    """Raised when a username/password pair does not authenticate."""


class UserAlreadyExistsError(Exception):
    """Raised when creating a user whose username is already taken."""


class InvalidTokenError(Exception):
    """Raised when a bearer token is missing, expired, malformed, or unknown."""


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def authenticate(db: Session, username: str, password: str) -> User:
    user = user_repository.get_by_username(db, username)
    if user is None:
        verify_password(password, _DUMMY_HASH)
        raise InvalidCredentialsError("Invalid username or password")
    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("Invalid username or password")
    return user


def create_access_token(user: User) -> tuple[str, int]:
    expires_in = settings.jwt_expire_minutes * 60
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user.id),
        "username": user.username,
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


def create_user(db: Session, username: str, password: str, role: str) -> User:
    if user_repository.get_by_username(db, username) is not None:
        raise UserAlreadyExistsError(f"Username '{username}' is already taken")
    return user_repository.create_user(db, username=username, password_hash=hash_password(password), role=role)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    if not verify_password(current_password, user.password_hash):
        raise InvalidCredentialsError("Current password is incorrect")
    return user_repository.update_password(db, user, hash_password(new_password))


def seed_admin(db: Session) -> None:
    if user_repository.count_users(db) > 0:
        return
    if not settings.admin_password:
        logger.warning(
            "No users exist and ADMIN_PASSWORD is not set — skipping admin seeding. "
            "Set ADMIN_USERNAME/ADMIN_PASSWORD in .env and restart to create the initial admin."
        )
        return
    user_repository.create_user(
        db,
        username=settings.admin_username,
        password_hash=hash_password(settings.admin_password),
        role="admin",
    )
    logger.info("Seeded initial admin user '%s'", settings.admin_username)
