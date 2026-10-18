"""Fix 3 — per-question web grounding.

The audited run reused one role-level query ("Google Software Developer interview
questions 2026") for all 20 questions, all cache hits, so every question saw the
same backdrop. This grounder derives the query from the specific subtopic/skill
the current blueprint slot is probing, caches by that query key (so distinct
subtopics get distinct retrievals), and records the exact query issued.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from interview_agents.interview_engine.protocols import WebSearchClient

logger = logging.getLogger(__name__)


def build_subtopic_query(company: str, role: str, subtopic: str) -> str:
    """Short, specific query keyed on the subtopic (Tavily prefers 3-6 words)."""
    subtopic = re.sub(r"\s+", " ", (subtopic or "").strip())
    company = (company or "").strip()
    # Subtopic leads so distinct slots produce distinct cache keys; company scopes it.
    parts = [p for p in [company, subtopic, "interview question"] if p]
    return " ".join(parts).strip()


@dataclass
class Grounding:
    query: str
    snippets: str
    sources: List[str]
    cache_hit: bool


class WebGrounder:
    """Per-query cached wrapper over an injected web-search client."""

    def __init__(self, web: Optional[WebSearchClient], company: str, role: str) -> None:
        self.web = web
        self.company = company
        self.role = role
        self._cache: Dict[str, Tuple[str, List[str]]] = {}
        self.issued: List[str] = []   # audit: every distinct query actually issued

    def for_slot(self, subtopic: str) -> Grounding:
        query = build_subtopic_query(self.company, self.role, subtopic)
        if query in self._cache:
            snippets, sources = self._cache[query]
            logger.info("[WEB] cache hit query=%r", query)
            return Grounding(query, snippets, sources, cache_hit=True)

        snippets, sources = "", []
        if self.web is not None:
            try:
                snippets, sources = self.web.fetch(query)
            except Exception:
                logger.warning("[WEB] fetch failed query=%r", query, exc_info=True)
                snippets, sources = "", []
        self._cache[query] = (snippets, sources)
        self.issued.append(query)
        logger.info("[WEB] issued query=%r sources=%d", query, len(sources))
        return Grounding(query, snippets, sources, cache_hit=False)
