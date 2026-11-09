"""Sessão SQLAlchemy. O laboratório usa SQLite; a URL troca o banco."""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_state: dict[str, object] = {"engine": None, "factory": None, "url": None}


class Base(DeclarativeBase):
    pass


def resolve_database_url() -> str:
    settings = get_settings()
    if settings.database_url:
        return settings.database_url
    path = settings.root / "data" / "sentinela.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return "sqlite:///" + path.resolve().as_posix()


def _enable_fk(dbapi_connection, _record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _ensure_sqlite_parent(url: str) -> None:
    if not url.startswith("sqlite:///") or url.endswith(":memory:"):
        return
    Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)


def get_engine():
    url = resolve_database_url()
    if _state["engine"] is not None and _state["url"] == url:
        return _state["engine"]
    if _state["engine"] is not None:
        _state["engine"].dispose()
    _ensure_sqlite_parent(url)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args, future=True)
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _enable_fk)
    _state["engine"] = engine
    _state["factory"] = sessionmaker(bind=engine, autoflush=True, autocommit=False, expire_on_commit=False)
    _state["url"] = url
    return engine


def session_factory():
    get_engine()
    return _state["factory"]


def reset_engine() -> None:
    engine = _state["engine"]
    if engine is not None:
        engine.dispose()
    _state["engine"] = None
    _state["factory"] = None
    _state["url"] = None


def _upgrade_user_profile() -> None:
    engine = get_engine()
    if not str(engine.url).startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as conn:
        if "role" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(4) DEFAULT 'N1' NOT NULL"))
        if "sector" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN sector VARCHAR(32) DEFAULT 'Suporte' NOT NULL"))


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(get_engine())
    _upgrade_user_profile()


def get_db() -> Generator[Session, None, None]:
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    db = session_factory()()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
