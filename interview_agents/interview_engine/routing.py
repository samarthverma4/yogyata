"""Fix 2 — activate the source router with a recorded fallback chain.

Reuses the existing app.services.question_source_router.QuestionSourceRouter
(DWRR turn plan, behavioral cap, no 3 in a row) which was dormant because RAG was
off and the stateless path bypassed it. Here it drives a real per-turn source, and
every slot resolves through an explicit fallback chain:

    bank hit           -> use bank
    bank miss          -> web-grounded generation
    web unavailable    -> llm

The chain never silently collapses to LLM without recording that it happened
(planned_source + source + fallback_reason land on the question's audit record).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Set

from interview_agents.interview_engine import seed_bank
from interview_agents.interview_engine.blueprint import BEHAVIORAL_HR
from interview_agents.services.question_source_router import QuestionSourceRouter

logger = logging.getLogger(__name__)


@dataclass
class Resolution:
    planned_source: str          # what the router asked for
    source: str                  # what actually filled the slot
    fallback_reason: Optional[str]
    bank_question: Optional[str]  # populated only when source == "bank"
    needs_web: bool               # engine should ground this slot via WebGrounder


class SourceRouter:
    def __init__(
        self,
        total_questions: int,
        interview_type: str = "company",
        interview_mode: str = "default",
        question_bank_id: Optional[str] = None,
        session_id: Optional[str] = None,
        web_available: bool = True,
    ) -> None:
        # question_bank_id non-empty => the router allocates a real qb quota.
        # Must stay None by default - a truthy placeholder here activates RAG
        # (and the hardcoded seed_bank fallback) even when nothing was ever
        # uploaded for this interview.
        self.plan: List[str] = QuestionSourceRouter.build_turn_plan(
            total_questions=total_questions,
            interview_mode=interview_mode,
            question_bank_id=question_bank_id,
            interview_type=interview_type,
            session_id=session_id,
        )
        self.web_available = web_available
        self._used_bank: Set[str] = set()
        logger.info("[ROUTER] turn plan: %s", self.plan)

    def planned_for(self, turn_no: int) -> str:
        idx = turn_no - 1
        return self.plan[idx] if 0 <= idx < len(self.plan) else "llm"

    def resolve(self, turn_no: int, bucket: str, subtopic: str, difficulty: str) -> Resolution:
        planned = self.planned_for(turn_no)

        # A behavioral/HR blueprint bucket forces the behavioral source regardless
        # of the DWRR plan, so coverage and source stay consistent.
        if bucket == BEHAVIORAL_HR:
            return Resolution("behavioral", "behavioral", None, None, needs_web=False)

        if planned == "behavioral":
            # Router wanted behavioral but the bucket is technical: treat as llm.
            planned = "llm"

        if planned == "qb":
            hit = seed_bank.lookup(bucket, subtopic, difficulty, self._used_bank)
            if hit:
                self._used_bank.add(hit["question"])
                return Resolution("qb", "bank", None, hit["question"], needs_web=False)
            if self.web_available:
                return Resolution("qb", "web", "bank miss", None, needs_web=True)
            return Resolution("qb", "llm", "bank miss, web unavailable", None, needs_web=False)

        if planned == "web":
            if self.web_available:
                return Resolution("web", "web", None, None, needs_web=True)
            return Resolution("web", "llm", "web unavailable", None, needs_web=False)

        return Resolution("llm", "llm", None, None, needs_web=False)
