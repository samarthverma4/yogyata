"""Fix 5 — near-duplicate detection.

Exact-text de-dup let swapped-noun template clones through:
  "how does multi-threading work under the hood" / "how does a thread pool work under the hood"
  "what is one key property of concurrency"       / "what is one key property of distributed systems"
  "when is using a mutex the right choice"         / "when is using Python the right choice"

This detector combines:
  1. a STRUCTURAL mold check — mask content words to a skeleton and compare, which
     catches the template reuse above regardless of the swapped nouns; and
  2. a SEMANTIC check — embedding cosine, which catches paraphrases that share no
     surface template.

Anything above threshold against an already-asked question is rejected so the
generator can regenerate. Rejections are logged with the matched prior question.
"""
from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from interview_agents.interview_engine.protocols import Embedder

logger = logging.getLogger(__name__)

_SEMANTIC_THRESHOLD = 0.86
_STRUCTURAL_THRESHOLD = 0.72

# Function/skeleton words kept when masking content words away.
_SKELETON_KEEP = {
    "how", "does", "do", "what", "is", "are", "the", "a", "an", "of", "one", "key",
    "property", "when", "using", "right", "choice", "and", "not", "difference",
    "between", "explain", "work", "works", "under", "hood", "can", "you", "in",
    "most", "would", "over", "why", "walk", "me", "through", "describe", "give",
    "with", "for", "to", "your", "vs", "versus", "compare",
}
# Distinctive template phrases seen collapsing the audited run.
_MOLD_PHRASES = [
    "under the hood",
    "one key property",
    "the right choice",
    "difference between",
    "walk me through",
    "in the context of",
]


def _tokens(text: str) -> List[str]:
    return re.findall(r"[a-z0-9+#]+", (text or "").lower())


def _skeleton(text: str) -> List[str]:
    """Replace content words with a placeholder, keep the templated frame."""
    out: List[str] = []
    for t in _tokens(text):
        out.append(t if t in _SKELETON_KEEP else "_")
    # collapse runs of placeholders so "how does X Y work" ~ "how does X work"
    collapsed: List[str] = []
    for t in out:
        if t == "_" and collapsed and collapsed[-1] == "_":
            continue
        collapsed.append(t)
    return collapsed


def _shingles(seq: List[str], n: int = 3) -> set:
    if len(seq) < n:
        return {" ".join(seq)} if seq else set()
    return {" ".join(seq[i:i + n]) for i in range(len(seq) - n + 1)}


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def structural_similarity(q1: str, q2: str) -> float:
    s1, s2 = _skeleton(q1), _skeleton(q2)
    if s1 == s2 and s1.count("_") <= 2:
        return 1.0
    sim = _jaccard(_shingles(s1), _shingles(s2))
    # Shared distinctive mold phrase is a strong duplicate signal on its own.
    low1, low2 = q1.lower(), q2.lower()
    for phrase in _MOLD_PHRASES:
        if phrase in low1 and phrase in low2:
            sim = max(sim, 0.75)
    return sim


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ── code-shape similarity (Fix 7) ───────────────────────────────────────────
# Two coding problems can be the SAME api shape under completely different
# domain words - "MessageHistory.add_message(timestamp: int, message: str) +
# get_last_n(n: int)" vs "JobApplicationTracker.add_application(timestamp:
# int, description: str) + get_last_n(n: int)" measured 0.50 semantic cosine
# and 0.44 structural similarity (both far under threshold) despite being an
# identical class shape with the entity renamed - text embeddings capture
# TOPIC (chat vs job applications are genuinely different topics), and the
# skeleton check is tuned for short verbal-question sentence structure,
# neither of which represents "same method signatures, different domain
# vocabulary". This extracts each method's (verb-intent, param-shape) and
# compares that set directly, independent of identifiers.
_CODE_SHAPE_THRESHOLD = 0.7
_METHOD_SIG_RE = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^()]*)\)")
_SIG_NOISE_NAMES = {
    "if", "for", "while", "print", "return", "example", "input", "output",
    "class", "def", "function", "int", "str", "float", "bool", "list", "dict",
}
_VERB_BUCKETS = [
    (("add", "insert", "append", "push", "create", "register", "enqueue", "put"), "ADD"),
    (("get", "retrieve", "fetch", "list", "find", "query", "read", "peek"), "GET"),
    (("remove", "delete", "pop", "evict", "dequeue", "clear"), "REMOVE"),
    (("update", "modify", "edit", "set"), "UPDATE"),
    (("validate", "check", "verify"), "VALIDATE"),
    (("process", "handle", "execute", "run", "call"), "PROCESS"),
]


def _verb_bucket(name: str) -> str:
    words = re.findall(r"[a-z]+|[A-Z][a-z]*", name)
    first = (words[0] if words else name).lower()
    for verbs, bucket in _VERB_BUCKETS:
        if first in verbs:
            return bucket
    return first


def _param_shape(params: str) -> str:
    parts = [p.strip() for p in params.split(",") if p.strip()]
    if not parts:
        return "0"
    types = []
    for p in parts:
        if ":" in p:
            t = p.split(":", 1)[1].split("=")[0].strip().lower()
            types.append(t or "?")
        else:
            types.append("?")
    return f"{len(parts)}:" + ",".join(types)


def extract_code_shape(text: str) -> set:
    shape = set()
    for name, params in _METHOD_SIG_RE.findall(text or ""):
        if name.lower() in _SIG_NOISE_NAMES:
            continue
        shape.add((_verb_bucket(name), _param_shape(params)))
    return shape


def code_shape_similarity(q1: str, q2: str) -> float:
    """1.0 = identical set of (verb-bucket, param-shape) method signatures.
    Requires at least 2 signatures on each side so a single coincidental
    match on a trivial one-method problem can't trigger a false positive."""
    s1, s2 = extract_code_shape(q1), extract_code_shape(q2)
    if len(s1) < 2 or len(s2) < 2:
        return 0.0
    inter = len(s1 & s2)
    smaller = min(len(s1), len(s2))
    return inter / smaller if smaller else 0.0


@dataclass
class DuplicateHit:
    is_duplicate: bool
    matched: Optional[str]
    kind: str          # "structural" | "semantic" | ""
    score: float
    vec: Optional[List[float]] = None   # candidate's embedding, so add() can reuse it (Fix 2)


class NearDuplicateDetector:
    def __init__(
        self,
        embedder: Optional[Embedder] = None,
        semantic_threshold: float = _SEMANTIC_THRESHOLD,
        structural_threshold: float = _STRUCTURAL_THRESHOLD,
        code_shape_threshold: float = _CODE_SHAPE_THRESHOLD,
        max_history: Optional[int] = None,
    ) -> None:
        if embedder is None:
            # Lightweight, dependency-free default so semantic checks always run.
            from interview_agents.interview_engine.adapters import HashingEmbedder
            embedder = HashingEmbedder()
        self.embedder = embedder
        self.semantic_threshold = semantic_threshold
        self.structural_threshold = structural_threshold
        self.code_shape_threshold = code_shape_threshold
        # None (default) keeps every caller's existing unbounded behavior.
        # Set only by long-lived, cross-session detectors (a per-JD registry
        # shared by every candidate interviewing against the same JD, which
        # otherwise grows forever across every drive that ever reuses that
        # JD) so old entries age out instead of accumulating indefinitely.
        self.max_history = max_history
        self._asked: List[str] = []
        self._vecs: List[List[float]] = []

    def check(self, candidate: str) -> DuplicateHit:
        cand_vec = self.embedder.embed(candidate)
        return self.check_with_vec(candidate, cand_vec)

    def check_with_vec(self, candidate: str, cand_vec: List[float]) -> DuplicateHit:
        """Same comparison as check(), given an already-computed embedding.
        Split out so a caller that must hold a lock around the comparison
        (e.g. a detector shared across concurrent sessions) can embed the
        candidate - a slow network call that touches no shared state -
        BEFORE acquiring that lock, instead of holding it for the embed too."""
        best = DuplicateHit(False, None, "", 0.0)
        for prior, pvec in zip(self._asked, self._vecs):
            struct = structural_similarity(candidate, prior)
            if struct >= self.structural_threshold and struct > best.score:
                best = DuplicateHit(True, prior, "structural", struct)
            sem = _cosine(cand_vec, pvec)
            if sem >= self.semantic_threshold and sem > best.score:
                best = DuplicateHit(True, prior, "semantic", sem)
            shape = code_shape_similarity(candidate, prior)
            if shape >= self.code_shape_threshold and shape > best.score:
                best = DuplicateHit(True, prior, "code_shape", shape)
        best.vec = cand_vec   # Fix 2: expose the candidate embedding so add() need not recompute it
        return best

    def is_duplicate(self, candidate: str) -> bool:
        return self.check(candidate).is_duplicate

    def add(self, question: str, vec: Optional[List[float]] = None) -> None:
        self._asked.append(question)
        # Fix 2: reuse the embedding computed in check() when the caller passes it;
        # only embed here when add() is called without a prior check().
        self._vecs.append(vec if vec is not None else self.embedder.embed(question))
        if self.max_history is not None and len(self._asked) > self.max_history:
            overflow = len(self._asked) - self.max_history
            del self._asked[:overflow]
            del self._vecs[:overflow]

    def register_or_reject(self, candidate: str) -> DuplicateHit:
        """Add the candidate if novel; otherwise log the rejection and return the hit."""
        hit = self.check(candidate)
        if hit.is_duplicate:
            logger.info(
                "[DEDUP] rejected (%s sim=%.2f) %r ~ prior %r",
                hit.kind, hit.score, candidate[:70], (hit.matched or "")[:70],
            )
            return hit
        self.add(candidate, hit.vec)   # Fix 2: reuse the embedding from check()
        return hit
