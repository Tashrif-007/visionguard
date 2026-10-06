from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models import User


def create_user(db: Session, name: str, email: str, password_hash: str, role: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_by_email(db: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
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


def update_profile(db: Session, user: User, name: str, email: str) -> User:
    user.name = name
    user.email = email
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session) -> list[User]:
    stmt = select(User).order_by(User.name)
    return list(db.execute(stmt).scalars().all())


def set_active(db: Session, user: User, is_active: bool) -> User:
    user.is_active = is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def count_active_admins(db: Session) -> int:
    stmt = select(func.count()).select_from(User).where(User.role == "admin", User.is_active.is_(True))
    return db.execute(stmt).scalar_one()
