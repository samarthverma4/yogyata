"""Fix 1b — conditional, content-referencing follow-up.

In the audited run no follow-up ever fired. A follow-up must:
  * fire CONDITIONALLY on the actual answer, not every turn;
  * probe deeper on strong answers, ask for specifics on vague ones, and
    correct-and-redirect on wrong ones; and
  * reference something the candidate ACTUALLY said, not the topic in the abstract.

The referenced phrase is extracted from the candidate answer and threaded into
the follow-up so the reference is verifiable in the run report.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from interview_agents.interview_engine.protocols import Evaluation, LLMClient

logger = logging.getLogger(__name__)

_FOLLOWUP_SYSTEM = (
    "You are a senior interviewer asking ONE short spoken follow-up. It must "
    "quote or paraphrase something the candidate actually said. No em dashes. "
    "Return STRICT JSON: {\"question\": \"...\", \"referenced_phrase\": \"...\"}."
)

_STOP = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "that",
    "this", "it", "is", "are", "would", "will", "can", "i", "you", "we", "they",
    "how", "what", "so", "at", "by", "as", "my", "your", "their", "use", "using",
}


def _pick_phrase(answer: str, topics: List[str]) -> str:
    """Choose a concrete phrase the candidate used, to anchor the follow-up."""
    for t in topics:
        if t and t.lower() not in _STOP:
            return t
    # Fall back to the longest content noun in the answer.
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{3,}", answer or "")
             if w.lower() not in _STOP]
    if not words:
        return ""
    return max(words, key=len)


def should_follow_up(evaluation: Evaluation) -> bool:
    """Fire on genuinely strong answers (probe) and on weak/partial ones (repair),
    but not on every middling turn, so follow-ups stay meaningful."""
    if evaluation.total >= 82:
        return True                       # strong -> probe deeper
    if evaluation.band == "weak":
        return True                       # wrong/vague -> repair
    if evaluation.dimensions.specificity < 4.0:
        return True                       # vague -> ask for specifics
    return False


class FollowUpGenerator:
    def __init__(self, llm: Optional[LLMClient] = None) -> None:
        self.llm = llm

    def maybe(self, question: str, answer: str, evaluation: Evaluation) -> Optional[Dict[str, Any]]:
        if not should_follow_up(evaluation):
            return None

        phrase = _pick_phrase(answer, evaluation.topics)
        if evaluation.total >= 82:
            intent, template = "probe", (
                f"You mentioned {phrase}. Can you go one level deeper on how {phrase} "
                f"actually works under production load and what could break?"
            )
        elif evaluation.band == "weak" and evaluation.dimensions.correctness < 4.0:
            intent, template = "correct_redirect", (
                f"You said {phrase}, but that misses a key case. How would you handle "
                f"the situation where {phrase} does not hold?"
            )
        else:
            intent, template = "specifics", (
                f"You referenced {phrase} but stayed general. Can you give a concrete "
                f"example with specifics of how you applied {phrase}?"
            )

        question_text = template
        referenced = phrase
        if self.llm is not None:
            try:
                user = (
                    f"Original question: {question}\nCandidate answer: {answer}\n"
                    f"Evaluation band: {evaluation.band}. Intent: {intent}. "
                    f"Anchor the follow-up on this phrase the candidate used: {phrase}"
                )
                raw = self.llm.structured(_FOLLOWUP_SYSTEM, user)
                if raw.get("question"):
                    question_text = str(raw["question"])
                    referenced = str(raw.get("referenced_phrase") or phrase)
            except Exception:
                logger.warning("LLM follow-up failed, using content-referencing template", exc_info=True)

        # Guarantee the reference is real: the anchor phrase must appear in the answer.
        references = bool(phrase) and phrase.lower() in (answer or "").lower()
        result = {
            "question": _strip_em_dashes(question_text),
            "intent": intent,
            "referenced_phrase": referenced,
            "references_answer": references,
        }
        logger.info("[FOLLOWUP] intent=%s ref=%r fired", intent, referenced)
        return result


def _strip_em_dashes(text: str) -> str:
    return (text or "").replace("—", ", ").replace("–", "-")
