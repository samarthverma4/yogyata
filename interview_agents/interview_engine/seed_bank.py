"""Fix 2 (data) — a seeded, role/topic-tagged question bank.

The audited run had an empty bank, so every `qb` router slot silently collapsed
to LLM. This is a small starter bank tagged by blueprint bucket, subtopic, and
difficulty so the router can actually resolve bank slots and the run report can
attribute them. It is intentionally compact; faculty uploads extend it at runtime
through the existing question-bank ingestion path.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from interview_agents.interview_engine.blueprint import (
    CS_FUNDAMENTALS,
    DSA_CODING,
    SYSTEM_TECHNICAL,
)

# Each entry: bucket, subtopic tags (lowercase), difficulty, question text.
SEED_BANK: List[Dict] = [
    # DSA / coding
    {"bucket": DSA_CODING, "tags": ["arrays and hashing", "arrays", "hashing"], "difficulty": "Easy",
     "question": "Given an array of integers, walk me through how you would find whether any two numbers sum to a target, and state the time and space complexity."},
    {"bucket": DSA_CODING, "tags": ["two pointers", "strings"], "difficulty": "Medium",
     "question": "Explain how you would detect whether a string is a palindrome ignoring non alphanumeric characters, and why the two pointer approach is optimal here."},
    {"bucket": DSA_CODING, "tags": ["binary search"], "difficulty": "Medium",
     "question": "Describe how you would find the first bad version in a sequence of versions where every version after a point is bad, and justify the complexity."},
    {"bucket": DSA_CODING, "tags": ["trees and graphs", "graphs", "bfs"], "difficulty": "Hard",
     "question": "Walk me through how you would find the shortest path in an unweighted graph, which data structures you would use, and where it can degrade."},
    {"bucket": DSA_CODING, "tags": ["dynamic programming", "dp"], "difficulty": "Hard",
     "question": "Explain how you would compute the length of the longest increasing subsequence and how you would reason about the state and transition."},

    # CS fundamentals
    {"bucket": CS_FUNDAMENTALS, "tags": ["operating systems", "concurrency and threads", "deadlock"], "difficulty": "Medium",
     "question": "What are the four conditions required for a deadlock, and how would you break one of them in a real service?"},
    {"bucket": CS_FUNDAMENTALS, "tags": ["computer networks", "tcp"], "difficulty": "Easy",
     "question": "Explain what happens during the TCP three way handshake and why each step is needed."},
    {"bucket": CS_FUNDAMENTALS, "tags": ["databases and indexing", "databases", "index"], "difficulty": "Medium",
     "question": "How does a B tree index speed up lookups, and when would adding an index actually hurt performance?"},
    {"bucket": CS_FUNDAMENTALS, "tags": ["memory management"], "difficulty": "Medium",
     "question": "Explain the difference between the stack and the heap and how that affects how you allocate large objects."},

    # System / technical depth
    {"bucket": SYSTEM_TECHNICAL, "tags": ["scalability", "load balancer", "distributed"], "difficulty": "Hard",
     "question": "How would you design a rate limiter for a distributed API so that limits hold across many servers, and what trade offs would you accept?"},
    {"bucket": SYSTEM_TECHNICAL, "tags": ["reliability", "caching", "cache"], "difficulty": "Medium",
     "question": "Explain how you would add a cache in front of a read heavy service and how you would keep it consistent with the source of truth."},
]


def _difficulty_rank(d: str) -> int:
    return {"Easy": 0, "Medium": 1, "Hard": 2}.get(d, 1)


def lookup(
    bucket: str,
    subtopic: str,
    difficulty: str,
    already_used: Optional[set] = None,
) -> Optional[Dict]:
    """Return the best unused bank question for a bucket/subtopic/difficulty, or None."""
    already_used = already_used or set()
    sub = (subtopic or "").lower().strip()
    target = _difficulty_rank(difficulty)

    candidates = [q for q in SEED_BANK if q["bucket"] == bucket and q["question"] not in already_used]
    if not candidates:
        return None

    def score(q: Dict) -> tuple:
        tag_hit = 1 if any(sub and (sub in t or t in sub) for t in q["tags"]) else 0
        diff_gap = -abs(_difficulty_rank(q["difficulty"]) - target)
        return (tag_hit, diff_gap)

    best = max(candidates, key=score)
    return best
