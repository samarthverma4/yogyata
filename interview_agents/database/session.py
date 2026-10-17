from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from interview_agents.config.settings import get_settings
from interview_agents.database.base import Base

settings = get_settings()

engine_kwargs = {"connect_args": {"check_same_thread": False}} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, future=True, pool_pre_ping=True, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator:
    """Yield a database session for request-scoped work."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all database tables."""

    Base.metadata.create_all(bind=engine)

    # create_all only adds missing TABLES, not missing COLUMNS on tables that
    # already exist on disk (no Alembic in this project). web_search_enabled
    # was added to InterviewSession after earlier sqlite files were created -
    # patch it in directly, ignoring "duplicate column" if it's already there.
    if settings.database_url.startswith("sqlite"):
        from sqlalchemy import text
        with engine.begin() as conn:
            try:
                conn.execute(text(
                    "ALTER TABLE interview_sessions ADD COLUMN web_search_enabled BOOLEAN NOT NULL DEFAULT 0"
                ))
            except Exception:
                pass
