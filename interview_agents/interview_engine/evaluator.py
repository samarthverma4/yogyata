"""Fix 6 — discriminating evaluator.

The audited run returned a flat 90 for every answer. This evaluator scores four
dimensions (correctness, depth, specificity, communication), combines them into a
weighted 0-100 total, and returns the breakdown plus extracted topics. The LLM
prompt is calibrated with few-shot band anchors so weak/partial/strong answers
separate and 90+ is reserved for genuinely strong answers. The heuristic fallback
is deliberately discriminating too, so scores never collapse to a constant when
the LLM is unavailable. The per-dimension result is what fix 1 (difficulty +
follow-up) consumes, closing the loop.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from interview_agents.interview_engine.protocols import (
    DimensionScores,
    Evaluation,
    LLMClient,
)

logger = logging.getLogger(__name__)

# Weighted combine — correctness dominates, communication is a modifier.
_WEIGHTS = {"correctness": 0.40, "depth": 0.25, "specificity": 0.20, "communication": 0.15}

_EVAL_SYSTEM = (
    "You are a strict, calibrated technical interviewer. Score the candidate "
    "answer on four dimensions from 0 to 10 and return STRICT JSON. Do not be "
    "generous: reserve 9-10 for genuinely strong answers. Never use em dashes."
)

# Few-shot band anchors keep the model from defaulting to a flat high score.
_ANCHORS = """
CALIBRATION ANCHORS (score bands the run must be able to reach):
- WEAK (0-4 total band): vague, hand-wavy, one line, no concrete mechanism or example.
    example answer: "I would just use a database and it works." -> correctness 3, depth 2, specificity 1, communication 4
- PARTIAL (5-7 band): broadly correct but shallow, missing trade-offs or specifics.
    example answer: "I'd shard the data across nodes to scale." -> correctness 7, depth 5, specificity 4, communication 6
- STRONG (8-10 band): correct, specific, names mechanisms/trade-offs, gives a concrete example.
    example answer: "I'd partition by user id with consistent hashing, replicate 3x for
    fault tolerance, and reconcile with a quorum read; at Goldman I used this for an IIoT
    ingest path." -> correctness 9, depth 9, specificity 9, communication 9
"""

_EVAL_USER_TMPL = """{anchors}

QUESTION:
{question}

CANDIDATE ANSWER:
{answer}

Return JSON:
{{"correctness": <0-10>, "depth": <0-10>, "specificity": <0-10>,
  "communication": <0-10>, "topics": ["<key topic the candidate actually mentioned>", ...],
  "justification": "<one sentence, no em dashes>"}}
"""

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "that",
    "this", "it", "is", "are", "would", "will", "can", "i", "you", "we", "they",
    "how", "what", "when", "which", "as", "by", "so", "if", "then", "at", "be",
    "have", "has", "do", "does", "my", "your", "their", "there", "using", "use",
}
_SPECIFIC_MARKERS = re.compile(
    r"\b(for example|for instance|e\.g\.|specifically|because|trade[- ]?off|"
    r"o\(|complexity|latency|throughput|consistency|replicat|shard|index|"
    r"mutex|quorum|cache|kafka|raft|big[- ]?o)\b",
    re.IGNORECASE,
)
_VAGUE_MARKERS = re.compile(
    r"\b(just|somehow|stuff|things|whatever|maybe|probably|i guess|not sure|it works)\b",
    re.IGNORECASE,
)


def _band(total: int) -> str:
    if total >= 78:
        return "strong"
    if total >= 55:
        return "partial"
    return "weak"


def _combine(d: DimensionScores) -> int:
    raw = (
        d.correctness * _WEIGHTS["correctness"]
        + d.depth * _WEIGHTS["depth"]
        + d.specificity * _WEIGHTS["specificity"]
        + d.communication * _WEIGHTS["communication"]
    )
    return int(round(max(0.0, min(10.0, raw)) * 10))


def _extract_topics(answer: str, limit: int = 5) -> List[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{2,}", answer)
    topics: List[str] = []
    for w in words:
        wl = w.lower()
        if wl in _STOPWORDS:
            continue
        # Keep capitalised tokens (proper nouns / tech) and long content words.
        if w[0].isupper() or len(wl) >= 6:
            if wl not in [t.lower() for t in topics]:
                topics.append(w)
        if len(topics) >= limit:
            break
    return topics


def _heuristic(question: str, answer: str) -> Evaluation:
    """Discriminating fallback: derives separated scores from answer signals."""
    ans = (answer or "").strip()
    words = ans.split()
    n = len(words)

    if n == 0:
        dims = DimensionScores(0, 0, 0, 0)
        return Evaluation(dims, 0, "weak", "empty answer", [], True)

    specifics = len(_SPECIFIC_MARKERS.findall(ans))
    vague = len(_VAGUE_MARKERS.findall(ans))

    # length signal (spoken answers): very short -> weak, well-developed -> strong.
    length = min(10.0, n / 22.0 * 10.0)          # ~22 words == full marks on length
    specificity = max(0.0, min(10.0, specifics * 3.0 - vague * 2.0 + (2.0 if n > 40 else 0.0)))
    depth = max(0.0, min(10.0, length * 0.6 + specifics * 1.5 - vague * 1.5))
    correctness = max(0.0, min(10.0, 5.0 + specifics * 1.2 - vague * 2.5 + (1.0 if n > 30 else -1.0)))
    communication = max(0.0, min(10.0, length * 0.8 - vague * 1.0))

    dims = DimensionScores(round(correctness, 1), round(depth, 1),
                           round(specificity, 1), round(communication, 1))
    total = _combine(dims)
    band = _band(total)
    return Evaluation(
        dimensions=dims, total=total, band=band,
        justification=f"heuristic: {n} words, {specifics} specifics, {vague} vague markers",
        topics=_extract_topics(ans),
        follow_up_needed=(band != "strong"),
    )


class DiscriminatingEvaluator:
    def __init__(self, llm: Optional[LLMClient] = None) -> None:
        self.llm = llm

    def evaluate(self, question: str, answer: str) -> Evaluation:
        if self.llm is not None:
            try:
                user = _EVAL_USER_TMPL.format(anchors=_ANCHORS, question=question, answer=answer)
                raw: Dict[str, Any] = self.llm.structured(_EVAL_SYSTEM, user)
                dims = DimensionScores(
                    correctness=float(raw.get("correctness", 0)),
                    depth=float(raw.get("depth", 0)),
                    specificity=float(raw.get("specificity", 0)),
                    communication=float(raw.get("communication", 0)),
                )
                total = _combine(dims)
                topics = raw.get("topics") or _extract_topics(answer)
                return Evaluation(
                    dimensions=dims, total=total, band=_band(total),
                    justification=str(raw.get("justification", ""))[:300],
                    topics=[str(t) for t in topics][:6],
                    follow_up_needed=(_band(total) != "strong"),
                )
            except Exception:
                logger.warning("LLM evaluation failed, using discriminating heuristic", exc_info=True)
        return _heuristic(question, answer)
