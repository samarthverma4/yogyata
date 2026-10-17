"""Concrete dependency implementations.

- HashingEmbedder: dependency-free, deterministic bag-of-words hashing embedding.
  Used as the default for near-duplicate detection so semantic checks always run
  without pulling in numpy/OpenAI, and it keeps the end-to-end test deterministic.
- OpenAILLM / TavilyWeb / OpenAIEmbedder: thin adapters wrapping the existing
  services so the engine runs against the real stack in production.
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_TOKEN = re.compile(r"[a-z0-9+#]+")
_STOP = {"the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
         "is", "are", "how", "what", "would", "you", "i", "it", "that", "this"}


class HashingEmbedder:
    """Deterministic hashing embedding (cosine-comparable), no external deps."""

    def __init__(self, dim: int = 256) -> None:
        self.dim = dim

    def embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dim
        for tok in _TOKEN.findall((text or "").lower()):
            if tok in _STOP:
                continue
            h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dim
            sign = 1.0 if (h >> 8) & 1 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        if norm:
            vec = [v / norm for v in vec]
        return vec


# ── production adapters (wrap existing services) ──────────────────────────────
class OpenAILLM:
    """Wrap the shared OpenAIService so the engine can call structured/complete."""

    def __init__(self, openai_service: Any) -> None:
        self._svc = openai_service

    def structured(self, system: str, user: str) -> Dict[str, Any]:
        import json as _json
        raw = self._svc.generate_completion(
            system_instruction=system + " Return only valid minified JSON.",
            user_prompt=user,
        )
        raw = (raw or "").strip()
        # Tolerate ```json fences and leading/trailing prose.
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            raw = m.group(0)
        try:
            return _json.loads(raw)
        except Exception:
            logger.warning("OpenAILLM.structured could not parse JSON: %r", raw[:200])
            return {}

    def complete(self, system: str, user: str) -> str:
        return self._svc.generate_completion(system_instruction=system, user_prompt=user)


class TavilyWeb:
    """Wrap WebSearchService.fetch_context into the engine's (text, sources) shape."""

    def __init__(self, web_service: Any, interview_type: str = "company",
                 subject: Optional[str] = None) -> None:
        self._svc = web_service
        self._domains = web_service.get_domains(interview_type, subject) if web_service else []

    def fetch(self, query: str) -> Tuple[str, List[str]]:
        if not self._svc or not getattr(self._svc, "is_configured", False):
            return "", []
        text = self._svc.fetch_context(query=query, domains=self._domains)
        return (text or ""), []


class OpenAIEmbedder:
    """Real embeddings when available; falls back to hashing on any error."""

    def __init__(self, openai_service: Any, model: str = "text-embedding-3-small") -> None:
        self._svc = openai_service
        self._model = model
        self._fallback = HashingEmbedder()

    def embed(self, text: str) -> List[float]:
        try:
            client = getattr(self._svc, "client", None)
            if client is None:
                return self._fallback.embed(text)
            resp = client.embeddings.create(model=self._model, input=text or " ")
            return list(resp.data[0].embedding)
        except Exception:
            logger.warning("OpenAI embedding failed, using hashing embedder", exc_info=True)
            return self._fallback.embed(text)


class CachingEmbedder:
    """Memoizes embed() by text hash, process-wide.

    A NearDuplicateDetector is rebuilt from scratch on every stateless HTTP
    turn and seeded by re-embedding every question already asked in the
    session. Without this cache that made each turn's seeding cost grow
    linearly with how far into the interview it was (turn 15 re-embedded 14
    already-unchanging questions via a live OpenAI call before even
    generating anything), which is exactly why per-turn latency climbed from
    ~5s to ~13s+ over a single interview once real embeddings replaced the
    free hashing embedder. A question's text never changes once asked, so
    its embedding is safe to reuse for the rest of the process's lifetime -
    across sessions too, since it's a pure function of the text.
    """

    _cache: Dict[str, List[float]] = {}

    def __init__(self, inner: Any) -> None:
        self._inner = inner

    def embed(self, text: str) -> List[float]:
        key = hashlib.sha256((text or "").encode("utf-8")).hexdigest()
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        vec = self._inner.embed(text)
        self._cache[key] = vec
        return vec
