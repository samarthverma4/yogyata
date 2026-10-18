"""Choose WHICH of the fixed workflow actions to run. The planner can only select from an allow-list; it cannot add tools,
change arguments, or alter permissions. Deterministic routing is the default; an optional LLM may propose a plan which is
validated against the allow-list and otherwise ignored.
"""
from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict

from yogyata_ai.common.llm import LLMAdapter, call_llm_json
from yogyata_ai.common.safety import UNTRUSTED_NOTICE, wrap_untrusted

from .schemas import ALL_ACTIONS

_ROUTES = [
    ("roadmap", r"\b(roadmap|plan|schedule|learning path|what should i (learn|study)|next steps?)\b", ["gap", "roadmap"]),
    ("gap", r"\b(skill gaps?|gaps?|weak(ness)?|strengths?|ready|readiness)\b", ["gap"]),
    ("opps", r"\b(jobs?|internships?|opportunit\w+|openings?|startup tasks?|roles? for me|apply)\b", ["gap", "opportunities"]),
    ("mentors", r"\b(mentors?|coach\w*|guidance)\b", ["gap", "mentors"]),
    ("interview", r"\b(interview|mock|practice questions?)\b", ["interview", "gap"]),
    ("tasks", r"\b(tasks?|projects?|portfolio|practice work)\b", ["gap", "tasks"]),
    ("resume", r"\b(resume|cv|linkedin)\b", ["resume"]),
]
# Requests the assistant must never perform; handled in assistant.py with an explanation
CONSEQUENTIAL = [
    ("apply_to_opportunity", r"\b(apply|submit (my )?application|send (my )?(resume|cv))\b.{0,40}\b(for me|on my behalf|to (the|this|that|these|those|all))\b|\bapply (for me|on my behalf|now|automatically)\b"),
    ("book_mentor_session", r"\b(book|schedule|reserve)\b.{0,30}\b(mentor|session|call)\b"),
    ("make_payment", r"\b(pay|payment|purchase|buy|checkout|charge)\b"),
]


class _LLMPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actions: list[str]


def detect_consequential(message: str | None) -> list[str]:
    low = (message or "").lower()
    return [kind for kind, pat in CONSEQUENTIAL if re.search(pat, low)]


def deterministic_plan(message: str | None, available: set[str]) -> list[str]:
    """No message -> everything that has inputs. Otherwise the union of matched routes (default: everything)."""
    low = (message or "").lower()
    chosen: list[str] = []
    for _, pat, acts in _ROUTES:
        if re.search(pat, low):
            chosen += acts
    if not chosen:
        chosen = list(ALL_ACTIONS)
    if "resume" in available and "resume" not in chosen and not message:
        chosen.append("resume")
    if "interview" in available and "interview" not in chosen:
        chosen.append("interview")  # supplied answers are always assessed so evidence is not silently dropped
    if "resume" in available and "resume" not in chosen:
        chosen.append("resume")
    return [a for a in ALL_ACTIONS if a in set(chosen)]


def llm_plan(llm: LLMAdapter, message: str) -> tuple[list[str] | None, str | None]:
    system = (UNTRUSTED_NOTICE + " Choose which of these actions to run: " + ", ".join(ALL_ACTIONS) +
              '. Respond ONLY with JSON {"actions": [...]}.')
    parsed, err = call_llm_json(llm, system, wrap_untrusted("student_message", message, 2000), _LLMPlan)
    if parsed is None:
        return None, err
    bad = [a for a in parsed.actions if a not in ALL_ACTIONS]
    if bad:
        return None, "llm_plan_rejected: unknown or disallowed actions " + ", ".join(sorted(set(bad))[:5])
    if not parsed.actions or len(parsed.actions) > len(ALL_ACTIONS):
        return None, "llm_plan_rejected: empty or oversized plan"
    return [a for a in ALL_ACTIONS if a in set(parsed.actions)], None
