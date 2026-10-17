"""Answer Validation Guard (F9) — catches empty, non-answers, and trivially short responses."""
from __future__ import annotations

_NON_ANSWERS = frozenset({
    "i don't know", "i do not know", "idk", "i dunno", "no idea", "not sure",
    "skip", "pass", "next", "i have no idea", "i am not sure", "i'm not sure",
    "no clue", "can't answer", "cannot answer", "i give up", "i quit",
    "don't know", "dk", "na", "n/a", "no answer", "nothing",
})

_TOPIC_HINTS: dict[str, str] = {
    "binary": "think about what property distinguishes a BST from a regular binary tree",
    "sort": "consider how you'd arrange a deck of cards in order — what's the simplest rule?",
    "sql": "start with a simple SELECT … FROM … WHERE statement",
    "oop": "think about a class as a blueprint and an object as something built from it",
    "network": "consider how a letter travels through the postal system — layers of processing",
    "thread": "think about running two tasks at the same time within one program",
    "memory": "think about the difference between RAM (fast, temporary) and disk (slow, permanent)",
    "default": "break the problem into smaller parts and explain what you do know — partial credit counts",
}


def validate_answer(answer: str, question: str = "") -> dict:
    """
    Validates a candidate answer before LLM evaluation.

    Returns:
        {"valid": bool, "issue": str|None, "prompt": str|None}
        issue is one of: "empty", "non_answer", "too_short"
        prompt is the message to re-show the candidate.
    """
    stripped = answer.strip()

    if not stripped:
        return {
            "valid": False,
            "issue": "empty",
            "prompt": (
                "It looks like you didn't submit an answer. "
                "Please share what you know — even a partial attempt is perfectly fine!"
            ),
        }

    normalized = stripped.lower().rstrip(".!?")

    if normalized in _NON_ANSWERS or all(c in "?!. " for c in normalized):
        hint_key = next((k for k in _TOPIC_HINTS if k in question.lower()), "default")
        return {
            "valid": False,
            "issue": "non_answer",
            "prompt": (
                f"That's okay — let's work through it together. "
                f"Hint: {_TOPIC_HINTS[hint_key]}. Take a moment and give it your best shot!"
            ),
        }

    word_count = len(stripped.split())
    if word_count < 5:
        return {
            "valid": False,
            "issue": "too_short",
            "prompt": (
                f"Your answer is very brief ({word_count} word{'s' if word_count != 1 else ''}). "
                "Could you expand? A strong answer explains the concept, gives an example, "
                "or walks through your reasoning."
            ),
        }

    return {"valid": True, "issue": None, "prompt": None}


def is_shallow_answer(answer: str, score: int) -> bool:
    """True when a valid answer is brief enough that Socratic probing adds value."""
    stripped = answer.strip()
    if not stripped:
        return False
    word_count = len(stripped.split())
    return word_count < 40 and 4 <= score <= 6
