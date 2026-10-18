"""Public integration surface. Backend developers should import only from here.

All functions accept/return JSON-compatible dicts; Pydantic validates at the boundary.
Approach for the whole module: deterministic rules/heuristics (+ TF-IDF similarity); no LLM is used.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from yogyata_ai.common.safety import detect_injection

from .comparison import compare_resume_to_job
from .linkedin import analyze_linkedin_text, compare_linkedin_to_resume
from .matching import match_job
from .profile import profile_from_analysis
from .schemas import JobMatchInput, ResumeInput
from .scoring import analyze_resume


class _LinkedInInput(ResumeInput):
    pass


class _ConsistencyInput(BaseModel):
    linkedin_text: str
    resume_text: str


class _ProfileInput(ResumeInput):
    target_role: str | None = None


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"resume_text": str} -> ResumeAnalysis as a dict."""
    data = ResumeInput(**payload)
    out = analyze_resume(data.resume_text).model_dump(mode="json")
    flags = detect_injection(data.resume_text)
    if flags:  # advisory only; content never influences scoring logic or permissions
        out["warnings"].append("Resume text contains instruction-like phrases (" + ", ".join(flags) + "); treated as plain text.")
    return out


def match(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"resume_text": str, "job_description": str} -> JobMatchResult as a dict (original scorer)."""
    data = JobMatchInput(**payload)
    return match_job(data.resume_text, data.job_description).model_dump(mode="json")


def compare_job(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"resume_text", "job_description"} -> evidence-aware JobComparison dict."""
    data = JobMatchInput(**payload)
    return compare_resume_to_job(data.resume_text, data.job_description).model_dump(mode="json")


def analyze_linkedin(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"resume_text": <linkedin profile text>} -> LinkedInAnalysis dict.

    The field is named `resume_text` for schema reuse; it holds the pasted LinkedIn profile text.
    """
    data = _LinkedInInput(**payload)
    return analyze_linkedin_text(data.resume_text).model_dump(mode="json")


def check_linkedin_consistency(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"linkedin_text", "resume_text"} -> ConsistencyReport dict."""
    data = _ConsistencyInput(**payload)
    return compare_linkedin_to_resume(data.linkedin_text, data.resume_text).model_dump(mode="json")


def build_profile(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"resume_text", "target_role"?} -> shared StudentProfile dict (no contact details)."""
    data = _ProfileInput(**payload)
    analysis = analyze_resume(data.resume_text)
    return profile_from_analysis(analysis, target_role=data.target_role).model_dump(mode="json")
