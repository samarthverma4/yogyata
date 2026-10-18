from __future__ import annotations

from typing import Any

from pydantic import Field, ValidationError

from yogyata_ai.common.similarity import SimilarityBackend
from yogyata_ai.skill_gap.api import _GapInput, merge_evidence
from yogyata_ai.skill_gap.roles import RoleCatalog, default_catalog

from .ranker import rank_mentors
from .schemas import Mentor, Slot


class _MentorInput(_GapInput):
    mentors: list[dict[str, Any]] = Field(default_factory=list)
    availability: list[Slot] | None = None
    languages: list[str] | None = None
    session_minutes: int = Field(60, ge=15, le=240)
    limit: int = Field(5, ge=1, le=50)


def recommend_mentors(payload: dict[str, Any], *, roles: RoleCatalog | None = None,
                      backend: SimilarityBackend | None = None) -> dict[str, Any]:
    """Rank mentors supplied by the backend. Invalid mentor records are skipped and reported. Nothing is booked."""
    d = _MentorInput(**payload)
    role_id = d.role_id or d.profile.target_role
    if not role_id:
        raise ValueError("role_id is required (or set profile.target_role)")
    role = (roles or default_catalog()).get(role_id)
    profile = merge_evidence(d.profile, d.interview_evaluations, d.extra_evidence, d.review_ledger)
    mentors, skipped = [], []
    for raw in d.mentors:
        try:
            mentors.append(Mentor(**raw))
        except ValidationError as e:
            skipped.append(f"skipped invalid mentor record '{raw.get('id', '?')}': {e.errors()[0]['msg']}")
    res = rank_mentors(profile, role, mentors, availability=d.availability, languages=d.languages,
                       session_minutes=d.session_minutes, limit=d.limit, backend=backend)
    res.warnings = [*skipped, *res.warnings]
    return res.model_dump(mode="json")
