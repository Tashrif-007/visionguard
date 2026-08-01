from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models import User


def create_user(db: Session, username: str, password_hash: str, role: str) -> User:
    user = User(username=username, password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_by_username(db: Session, username: str) -> User | None:
    stmt = select(User).where(User.username == username)
    return db.execute(stmt).scalars().first()


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def count_users(db: Session) -> int:
    return db.execute(select(func.count()).select_from(User)).scalar_one()


def update_password(db: Session, user: User, password_hash: str) -> User:
    user.password_hash = password_hash
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
