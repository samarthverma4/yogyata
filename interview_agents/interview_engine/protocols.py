"""Shared data model and injected-dependency protocols for the engine.

Kept dependency-free (no OpenAI, no Tavily imports) so unit tests can construct
records directly and inject scripted doubles for every external call.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

try:  # Protocol lives in typing on 3.8+, keep a shim just in case.
    from typing import Protocol
except ImportError:  # pragma: no cover
    Protocol = object  # type: ignore


# ── injected dependencies ─────────────────────────────────────────────────────
class LLMClient(Protocol):
    """Anything that can turn a system+user prompt into a JSON dict / string."""

    def structured(self, system: str, user: str) -> Dict[str, Any]:
        ...

    def complete(self, system: str, user: str) -> str:
        ...


class WebSearchClient(Protocol):
    def fetch(self, query: str) -> Tuple[str, List[str]]:
        """Return (grounding_snippets_text, source_urls) for a query."""
        ...


class Embedder(Protocol):
    def embed(self, text: str) -> List[float]:
        ...


# ── audit records ─────────────────────────────────────────────────────────────
@dataclass
class QuestionMeta:
    """The audit trail the constraints require on every question in a run."""

    index: int
    bucket: str                     # blueprint bucket (fix 4)
    source: str                     # actual source used: bank | web | llm | behavioral (fix 2)
    planned_source: str             # what the router asked for before fallback
    difficulty: str                 # response-conditioned difficulty (fix 1)
    web_query: Optional[str] = None  # exact query issued, if any (fix 3)
    source_fallback_reason: Optional[str] = None
    dedup_regens: int = 0           # near-duplicate regenerations (fix 5)
    is_follow_up: bool = False
    subtopic: str = ""


@dataclass
class DimensionScores:
    correctness: float = 0.0
    depth: float = 0.0
    specificity: float = 0.0
    communication: float = 0.0

    def as_dict(self) -> Dict[str, float]:
        return asdict(self)


@dataclass
class Evaluation:
    dimensions: DimensionScores
    total: int                      # 0-100
    band: str                       # weak | partial | strong
    justification: str = ""
    topics: List[str] = field(default_factory=list)   # extracted from the answer
    follow_up_needed: bool = False


@dataclass
class Turn:
    meta: QuestionMeta
    question: str
    answer: str = ""
    evaluation: Optional[Evaluation] = None
    difficulty_decision: Optional[Dict[str, Any]] = None
    follow_up: Optional[Dict[str, Any]] = None      # {question, references, referenced_phrase}


@dataclass
class RunReport:
    interview_id: str
    role: str
    company: str
    total_questions: int
    turns: List[Turn] = field(default_factory=list)
    blueprint_quota: Dict[str, int] = field(default_factory=dict)
    blueprint_filled: Dict[str, int] = field(default_factory=dict)

    # ── derived audit metrics (used by the test + the report artifact) ──
    def source_mix(self) -> Dict[str, int]:
        mix: Dict[str, int] = {}
        for t in self.turns:
            mix[t.meta.source] = mix.get(t.meta.source, 0) + 1
        return mix

    def scores(self) -> List[int]:
        return [t.evaluation.total for t in self.turns if t.evaluation]

    def difficulty_sequence(self) -> List[str]:
        return [t.meta.difficulty for t in self.turns]

    def web_queries(self) -> List[str]:
        return [t.meta.web_query for t in self.turns if t.meta.web_query]

    def follow_ups(self) -> List[Dict[str, Any]]:
        return [t.follow_up for t in self.turns if t.follow_up]

    def score_variance(self) -> float:
        xs = self.scores()
        if len(xs) < 2:
            return 0.0
        mean = sum(xs) / len(xs)
        return sum((x - mean) ** 2 for x in xs) / len(xs)
