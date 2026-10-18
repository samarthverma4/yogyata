"""Live per-turn session layer for the adaptive engine.

The engine runs a full interview internally, but the production flow is turn by
turn over HTTP (Node asks for one question, the student answers, Node asks it to
score, then asks for the next). This module keeps one stateful InterviewEngine per
interview id so blueprint progress, the difficulty controller, the dedup detector,
the source router and the transcript all survive across HTTP calls, and wires the
real OpenAI / Tavily / embedding adapters.

Difficulty is advanced by the evaluate call (record_answer) and read by the next
generate call (produce_question), so questions are response-conditioned across the
run. Sessions are held in-process for the life of one interview; a mid-interview
agent restart simply rebuilds a fresh session (acceptable for a single sitting).
"""
from __future__ import annotations

import logging
import threading
from typing import Dict, Optional

from interview_agents.config.settings import get_settings
from interview_agents.interview_engine.adapters import HashingEmbedder, OpenAIEmbedder, OpenAILLM, TavilyWeb
from interview_agents.interview_engine.engine import EngineConfig, InterviewEngine
from interview_agents.interview_engine.protocols import Turn

logger = logging.getLogger(__name__)

_STORE: "OrderedDict[str, InterviewEngine]" = None  # set below
_LOCK = threading.Lock()
_MAX_SESSIONS = 500     # bound memory: evict the oldest interview when exceeded

from collections import OrderedDict
_STORE = OrderedDict()


def _build_engine(cfg: EngineConfig) -> InterviewEngine:
    settings = get_settings()

    # Reuse the process-wide warm OpenAI client the rest of the agent shares.
    from interview_agents.services.interview_service import _get_shared_openai_service
    openai_service = _get_shared_openai_service(settings)

    llm = OpenAILLM(openai_service) if openai_service is not None else None
    embedder = OpenAIEmbedder(openai_service) if openai_service is not None else HashingEmbedder()

    web = None
    web_available = False
    try:
        from interview_agents.services.web_search_service import WebSearchService
        web_service = WebSearchService(settings)
        if getattr(web_service, "is_configured", False):
            web = TavilyWeb(web_service, interview_type=cfg.interview_type)
            web_available = True
    except Exception:
        logger.warning("web search unavailable for adaptive session", exc_info=True)

    cfg.web_available = cfg.web_available and web_available
    engine = InterviewEngine(cfg, llm=llm, web=web, embedder=embedder)
    logger.info(
        "[ADAPTIVE] built session %s role=%r company=%r total=%d web=%s bank=%s quota=%s",
        cfg.interview_id, cfg.role, cfg.company, cfg.total_questions,
        cfg.web_available, cfg.question_bank_id, engine.blueprint.quota,
    )
    return engine


def get_or_create(cfg: EngineConfig) -> InterviewEngine:
    with _LOCK:
        engine = _STORE.get(cfg.interview_id)
        if engine is None:
            engine = _build_engine(cfg)
            _STORE[cfg.interview_id] = engine
            while len(_STORE) > _MAX_SESSIONS:
                _STORE.popitem(last=False)   # evict oldest (FIFO)
        else:
            _STORE.move_to_end(cfg.interview_id)
        return engine


def get(interview_id: str) -> Optional[InterviewEngine]:
    return _STORE.get(interview_id)


def drop(interview_id: str) -> None:
    with _LOCK:
        _STORE.pop(interview_id, None)


def produce(cfg: EngineConfig, question_no: int) -> Turn:
    """Generate (or return the already-produced) question for a turn."""
    engine = get_or_create(cfg)
    return engine.produce_question(question_no)


def record(interview_id: str, question_no: int, answer: str) -> Optional[Turn]:
    """Score an answer, advance difficulty, and attach any follow-up."""
    engine = get(interview_id)
    if engine is None:
        return None
    if question_no >= len(engine.turns):
        # Evaluate arrived for a question this session never produced (agent
        # restarted, or out-of-order). Caller falls back to legacy scoring.
        return None
    return engine.record_answer(question_no, answer)
