"""Mentor records are SUPPLIED by the backend. This package never invents mentors, prices, ratings or availability."""
from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Day = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def to_min(hhmm: str) -> int:
    return int(hhmm[:2]) * 60 + int(hhmm[3:])


class Slot(BaseModel):
    """Recurring weekly window (one consistent timezone is the backend's responsibility)."""
    model_config = ConfigDict(extra="forbid")
    day: Day
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def _fmt(cls, v):
        if not _HHMM.match(v):
            raise ValueError("time must be HH:MM (24h)")
        return v

    @model_validator(mode="after")
    def _order(self):
        if to_min(self.end) <= to_min(self.start):
            raise ValueError("slot end must be after start")
        return self


class Mentor(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    headline: str = ""
    bio: str = ""
    expertise: dict[str, Annotated[int, Field(ge=1, le=5)]] = Field(..., min_length=1, description="canonical skill -> depth 1-5")
    roles: list[str] = Field(default_factory=list)
    years_experience: float | None = Field(None, ge=0, le=60)
    languages: list[str] | None = None
    price_per_session_inr: float | None = Field(None, ge=0, description="None = unknown (never guessed)")
    availability: list[Slot] | None = Field(None, description="None = unknown; [] = known to have no availability")
    accepting_students: bool = True
    rating: float | None = Field(None, ge=1, le=5)
    n_reviews: int = Field(0, ge=0)
    is_demo_data: bool = False


class RankedMentor(BaseModel):
    mentor_id: str
    score: float = Field(..., ge=0, le=100)
    components: dict[str, float]
    matched_skills: list[dict]
    reasons: list[str]
    unknowns: list[str] = Field(default_factory=list)
    price_per_session_inr: float | None
    next_step: str = ("Review the profile and, if you wish, request a session through the platform. "
                      "This system has not booked or paid for anything.")


class ExcludedMentor(BaseModel):
    mentor_id: str
    reason: str


class MentorResult(BaseModel):
    ranked: list[RankedMentor]
    excluded: list[ExcludedMentor]
    target_skills: list[dict]
    warnings: list[str] = Field(default_factory=list)
    backend_status: str = ""
    booking_performed: Literal[False] = False
    score_meaning: str = "Relevance of a mentor's declared expertise to this student's current gaps; not a prediction of outcomes or a quality rating."
