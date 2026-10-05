from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from backend.db.models import User

# One-time backfill for the accounts that existed before email-based login —
# real emails the user gave us, not generated placeholders. Only used by
# ensure_email_column below, which only touches rows where email is still
# NULL after the rename, so this is a no-op once the migration has run once.
_LEGACY_EMAIL_BACKFILL = {
    "admin": "admin@gmail.com",
    "operator1": "operator@gmail.com",
    "tashrif": "tashrif@gmail.com",
}


def create_user(db: Session, name: str, email: str, password_hash: str, role: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_is_active_column(db: Session) -> None:
    """Idempotently add users.is_active.

    Base.metadata.create_all only creates missing tables, never adds columns
    to a table that already exists — mirrors video_source_repository's
    ensure_created_by_column for the same reason.
    """
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true"))
    db.commit()


def ensure_email_column(db: Session) -> None:
    """Idempotently migrate users.username -> users.name + users.email.

    Three steps, each safe to run on every startup:
    1. Rename username -> name, only if username still exists (a fresh DB
       created via create_all already has `name`, never `username`, so this
       is a no-op there).
    2. Add email (nullable first, so this doesn't fail against existing rows).
    3. Backfill the known legacy accounts' real emails, then enforce
       NOT NULL + a unique index. Any row not in the backfill map (there
       shouldn't be any on this project) would block the NOT NULL step —
       intentional, so a forgotten account surfaces loudly instead of
       silently getting a fake email.
    """
    db.execute(
        text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'username'
                ) THEN
                    ALTER TABLE users RENAME COLUMN username TO name;
                END IF;
            END $$;
            """
        )
    )
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)"))
    db.commit()

    for name, email in _LEGACY_EMAIL_BACKFILL.items():
        db.execute(
            text("UPDATE users SET email = :email WHERE name = :name AND email IS NULL"),
            {"email": email, "name": name},
        )
    db.commit()

    db.execute(text("ALTER TABLE users ALTER COLUMN email SET NOT NULL"))
    db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"))
    # The old username column carried a unique index that survived the rename;
    # the display name is no longer a login key, so two users may share a name.
    db.execute(text("DROP INDEX IF EXISTS ix_users_username"))
    db.commit()


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
