from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from interview_agents.database.base import Base
except ImportError:
    try:
        from app.database.base import Base
    except ImportError:
        from sqlalchemy.orm import DeclarativeBase

        class Base(DeclarativeBase):
            """SQLAlchemy declarative base."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    experience: Mapped[str] = mapped_column(String(120), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="Medium")
    skills_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    candidate_profile_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    questions_asked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    
    # GLAMIS-specific fields
    interview_type: Mapped[str] = mapped_column(String(20), nullable=False, default="subject")
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    jd_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resume_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    svar_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    web_search_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Admin-defined fixed difficulty mix + question-bank config. The Mongo branch of
    # create_glamis_session already persists these; without these columns the SQL
    # branch silently dropped them (adaptive difficulty + no QB in SQL mode).
    easy_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    medium_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hard_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Appended after easy/medium/hard are exhausted - a LeetCode-style coding round,
    # same convention as the non-avatar flow. None/0 (every session predating this
    # column) means no coding round, same as easy/medium/hard being None means adaptive.
    coding_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    question_bank_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    question_bank_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    student_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    weak_areas_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    strong_areas_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    asked_questions_hash: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    final_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    questions: Mapped[list[Question]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Question.created_at",
    )
    answers: Mapped[list[Answer]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Answer.created_at",
    )
    report: Mapped[Optional["InterviewReport"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        uselist=False,
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    is_follow_up: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    session: Mapped[InterviewSession] = relationship(back_populates="questions")
    answers: Mapped[list[Answer]] = relationship(back_populates="question", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[Optional[int]] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL"), nullable=True, index=True)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    evaluation_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    session: Mapped[InterviewSession] = relationship(back_populates="answers")
    question: Mapped[Optional["Question"]] = relationship(back_populates="answers")


class InterviewReport(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    report_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    session: Mapped[InterviewSession] = relationship(back_populates="report")
