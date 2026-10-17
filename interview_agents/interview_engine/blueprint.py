"""Fix 4 — coverage blueprint.

Before generation, allocate explicit quotas across coverage buckets so one JD
phrase can never consume the whole run. Quotas scale with the role (a Google SWE
run gets real DSA/coding presence). Generation fills slots against the blueprint
and the remaining-deficit picker enforces the contract turn by turn.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Canonical buckets. Values double as the audit-trail label on each question.
DSA_CODING = "dsa_coding"
CS_FUNDAMENTALS = "cs_fundamentals"
SYSTEM_TECHNICAL = "system_technical"
BEHAVIORAL_HR = "behavioral_hr"
RESUME = "resume"

ALL_BUCKETS = [DSA_CODING, CS_FUNDAMENTALS, SYSTEM_TECHNICAL, BEHAVIORAL_HR, RESUME]

# Role -> relative weights across buckets. A weight of 0 removes the bucket.
# SWE-family roles keep a strong DSA presence; data/ML shift toward fundamentals;
# purely behavioral-light roles still guarantee a non-zero behavioral slice.
_ROLE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "swe": {DSA_CODING: 0.28, CS_FUNDAMENTALS: 0.22, SYSTEM_TECHNICAL: 0.25, BEHAVIORAL_HR: 0.13, RESUME: 0.12},
    "backend": {DSA_CODING: 0.24, CS_FUNDAMENTALS: 0.20, SYSTEM_TECHNICAL: 0.31, BEHAVIORAL_HR: 0.13, RESUME: 0.12},
    "data_ml": {DSA_CODING: 0.20, CS_FUNDAMENTALS: 0.28, SYSTEM_TECHNICAL: 0.22, BEHAVIORAL_HR: 0.15, RESUME: 0.15},
    "frontend": {DSA_CODING: 0.18, CS_FUNDAMENTALS: 0.22, SYSTEM_TECHNICAL: 0.30, BEHAVIORAL_HR: 0.15, RESUME: 0.15},
    "default": {DSA_CODING: 0.20, CS_FUNDAMENTALS: 0.22, SYSTEM_TECHNICAL: 0.26, BEHAVIORAL_HR: 0.16, RESUME: 0.16},
}


def classify_role(role: str, jd: str = "") -> str:
    text = f"{role} {jd}".lower()
    if re.search(r"\b(ml|machine learning|data scien|data engineer|ai engineer|nlp|analytics)\b", text):
        return "data_ml"
    if re.search(r"\b(front[\s-]?end|react|ui|ux|web developer)\b", text):
        return "frontend"
    if re.search(r"\b(back[\s-]?end|platform|distributed|infrastructure|systems)\b", text):
        return "backend"
    if re.search(r"\b(software|swe|sde|developer|engineer|programmer)\b", text):
        return "swe"
    return "default"


def _largest_remainder_alloc(weights: Dict[str, float], total: int) -> Dict[str, int]:
    """Turn fractional weights into integer counts summing exactly to `total`."""
    active = {b: w for b, w in weights.items() if w > 0}
    wsum = sum(active.values()) or 1.0
    raw = {b: (w / wsum) * total for b, w in active.items()}
    floors = {b: int(v) for b, v in raw.items()}
    used = sum(floors.values())
    remainder = total - used
    # Hand out the leftover to the largest fractional parts.
    order = sorted(active, key=lambda b: raw[b] - floors[b], reverse=True)
    for i in range(remainder):
        floors[order[i % len(order)]] += 1
    return {b: floors.get(b, 0) for b in ALL_BUCKETS}


@dataclass
class Blueprint:
    role_family: str
    quota: Dict[str, int]
    subtopics: Dict[str, List[str]]
    filled: Dict[str, int] = field(default_factory=lambda: {b: 0 for b in ALL_BUCKETS})
    _cursor: Dict[str, int] = field(default_factory=lambda: {b: 0 for b in ALL_BUCKETS})

    def total(self) -> int:
        return sum(self.quota.values())

    def remaining(self, bucket: str) -> int:
        return self.quota.get(bucket, 0) - self.filled.get(bucket, 0)

    def next_bucket(self) -> str:
        """Pick the bucket with the largest remaining deficit (fills evenly and
        guarantees every quota'd bucket is reached before the run ends)."""
        candidates = [b for b in ALL_BUCKETS if self.remaining(b) > 0]
        if not candidates:
            # Blueprint already satisfied — keep going on the technical spine.
            return SYSTEM_TECHNICAL
        return max(candidates, key=lambda b: self.remaining(b))

    def next_subtopic(self, bucket: str) -> str:
        topics = self.subtopics.get(bucket) or [bucket.replace("_", " ")]
        idx = self._cursor[bucket] % len(topics)
        self._cursor[bucket] += 1
        return topics[idx]

    def mark_filled(self, bucket: str) -> None:
        self.filled[bucket] = self.filled.get(bucket, 0) + 1

    def is_satisfied(self) -> bool:
        return all(self.remaining(b) <= 0 for b in self.quota)


# ── subtopic extraction (drives fix 3's per-question web queries) ──────────────
_DSA_HINTS = ["arrays and hashing", "two pointers", "binary search", "trees and graphs",
              "dynamic programming", "linked lists", "sorting and heaps"]
_CS_HINTS = ["operating systems", "computer networks", "databases and indexing",
             "concurrency and threads", "memory management", "oop design"]


def _jd_phrases(jd: str, limit: int = 8) -> List[str]:
    # Cheap noun-ish phrase harvest: split on delimiters, keep multi-word tech phrases.
    chunks = re.split(r"[.;:,\n]", jd or "")
    phrases: List[str] = []
    for c in chunks:
        c = c.strip().lower()
        for m in re.findall(r"[a-z][a-z0-9+#/ -]{6,40}", c):
            m = m.strip()
            if 2 <= len(m.split()) <= 5 and m not in phrases:
                phrases.append(m)
    return phrases[:limit]


# Common technologies a resume subtopic should latch onto (fix 4: resume-based
# slots must reference real resume content, not the candidate's name).
_TECH_VOCAB = {
    "java", "python", "golang", "go", "c++", "javascript", "typescript", "react",
    "node", "express", "spring", "boot", "fastapi", "django", "flask", "kafka",
    "mongodb", "mysql", "postgres", "redis", "docker", "kubernetes", "aws", "gcp",
    "azure", "microservices", "rag", "llm", "graphql", "grpc", "terraform",
    "spark", "hadoop", "airflow", "tensorflow", "pytorch", "rest", "iiot",
}


def _resume_phrases(resume: str, limit: int = 6) -> List[str]:
    if not resume:
        return []
    toks = re.findall(r"[A-Za-z][A-Za-z0-9+.#]{1,}", resume)
    seen: List[str] = []
    # Prefer real technologies the candidate listed over any capitalised token
    # (which would otherwise pick up their name).
    for t in toks:
        tl = t.lower().strip(".")
        if tl in _TECH_VOCAB and t.strip(".") not in seen:
            seen.append(t.strip("."))
    if not seen:
        seen.append("your most complex project")
    return seen[:limit]


def build_blueprint(
    role: str,
    jd: str = "",
    resume: str = "",
    total: int = 20,
) -> Blueprint:
    family = classify_role(role, jd)
    weights = dict(_ROLE_WEIGHTS.get(family, _ROLE_WEIGHTS["default"]))

    # No resume => fold the resume quota into behavioral/system so we never emit
    # a resume slot we cannot ground in real resume content.
    if not resume.strip():
        weights[SYSTEM_TECHNICAL] += weights[RESUME] * 0.5
        weights[BEHAVIORAL_HR] += weights[RESUME] * 0.5
        weights[RESUME] = 0.0

    quota = _largest_remainder_alloc(weights, total)

    jd_phrases = _jd_phrases(jd)
    subtopics = {
        DSA_CODING: _DSA_HINTS,
        CS_FUNDAMENTALS: _CS_HINTS,
        SYSTEM_TECHNICAL: jd_phrases or ["system design", "scalability", "reliability"],
        BEHAVIORAL_HR: ["ownership and impact", "conflict and collaboration",
                        "learning under pressure", "why this company"],
        RESUME: _resume_phrases(resume) or ["your most complex project"],
    }
    return Blueprint(role_family=family, quota=quota, subtopics=subtopics)
