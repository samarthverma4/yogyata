from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import re
import statistics
import threading
import datetime
from collections.abc import Mapping
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── shared per-JD dedup registry ────────────────────────────────────────────
# A NearDuplicateDetector built fresh per HTTP request and seeded only from
# that session's own conversation_history has no visibility into what OTHER
# concurrent candidates interviewing against the SAME JD have already been
# asked. Load-testing 10 concurrent candidates on one JD confirmed this:
# 0 within-session duplicates (the per-turn skill rotation + local dedup
# already handles that) but ~3.5% cross-session near-duplicates - two
# different candidates occasionally getting the same question, since each
# session's rotation only offsets where it STARTS in the same shared
# skill/category pool. Keyed by the same (role|jd_text) hash already used for
# JD-skill-extraction caching, so every candidate on the same JD - and every
# turn of the same candidate's session - shares one persistent detector
# instead of each session only ever seeing its own history.
_jd_dedup_registry: dict[str, Any] = {}
_jd_dedup_locks: dict[str, threading.Lock] = {}
# Guards creation of registry/lock ENTRIES only (fast dict ops) - never held
# during the actual check-and-add below, which does a real embedding call.
# Holding it there would serialize dedup across every JD process-wide instead
# of only among candidates sharing the same one.
_jd_dedup_registry_lock = threading.Lock()
_JD_DEDUP_MAX_HISTORY = 500  # caps memory for a JD reused across many drives over time


def _jd_dedup_key(role: str, jd_text: str) -> str:
    return hashlib.sha256(f"{role or ''}|{jd_text or ''}".encode("utf-8")).hexdigest()


# question_generator.py's resume_focus_directive (fires 1-in-5 turns) is a
# single, unenforced LLM instruction - reliable-ish across a long interview
# (a miss or two goes unnoticed among several other resume-grounded turns),
# but a 5-question interview gets exactly ONE resume-eligible turn, so a
# single miss reads as "resume grounding never worked at all". Confirmed live:
# a real 5-question interview's one resume-eligible turn landed on a
# "behavioral"-category turn and the model produced a plain technical
# question, ignoring the resume instruction entirely. This heuristically
# verifies the directive actually took effect and forces one stronger,
# more explicit retry when it didn't - same pattern as the dedup regen loop
# below, which _generate_from_context_deduped already runs this alongside.
_RESUME_TOKEN_RE = re.compile(r"[A-Z][A-Za-z0-9+\-]{2,}")
_RESUME_TOKEN_STOPWORDS = {
    "The", "This", "That", "With", "From", "For", "And", "Built", "Led",
    "Developed", "Designed", "Created", "Managed", "Worked", "Responsible",
}


def _resume_referenced(question: str, resume_text: str) -> bool:
    """True if `question` names something distinctive from the resume (a
    capitalized project/technology/employer token), or if there's nothing
    distinctive to check against - only False is actionable (triggers a
    regen), so an inconclusive check must never block on its own."""
    if not (resume_text or "").strip():
        return True
    tokens = {
        t for t in _RESUME_TOKEN_RE.findall(resume_text)
        if t not in _RESUME_TOKEN_STOPWORDS and len(t) > 3
    }
    if not tokens:
        return True
    q_lower = (question or "").lower()
    return any(tok.lower() in q_lower for tok in tokens)


def _get_shared_jd_detector_and_lock(jd_key: str, openai_service: Any):
    """Get-or-create the persistent detector (+ its own per-JD lock) so every
    candidate on this JD and every turn of their session shares one dedup
    pool, while candidates on a DIFFERENT JD never contend with each other."""
    if _NearDuplicateDetector is None:
        return None, None
    with _jd_dedup_registry_lock:
        det = _jd_dedup_registry.get(jd_key)
        lock = _jd_dedup_locks.get(jd_key)
        if det is None:
            embedder = None
            if _OpenAIEmbedder is not None and openai_service is not None:
                embedder = _OpenAIEmbedder(openai_service)
                if _CachingEmbedder is not None:
                    embedder = _CachingEmbedder(embedder)
            det = _NearDuplicateDetector(embedder, max_history=_JD_DEDUP_MAX_HISTORY)
            _jd_dedup_registry[jd_key] = det
        if lock is None:
            lock = threading.Lock()
            _jd_dedup_locks[jd_key] = lock
    return det, lock


def _register_or_reject_shared(jd_key: str, candidate: str, openai_service: Any):
    """Atomically check-and-add `candidate` against every question already
    asked for this JD, across every concurrent (and past) candidate on it.

    Embeds OUTSIDE the per-JD lock - the embed is a real OpenAI network call
    (~300-500ms) that touches no shared state, so holding the lock through it
    meant every concurrent candidate on the same JD queued behind each
    other's network round trip every single turn (this is what made overall
    latency climb ~40-50% when the shared registry first went in: 10
    candidates serializing on one JD's lock for a slow call that 10 of them
    could otherwise have made in parallel). Only the fast in-memory
    comparison-and-append needs the lock.
    """
    det, lock = _get_shared_jd_detector_and_lock(jd_key, openai_service)
    if det is None:
        return None
    cand_vec = det.embedder.embed(candidate)
    with lock:
        hit = det.check_with_vec(candidate, cand_vec)
        if hit.is_duplicate:
            logger.info(
                "[DEDUP] rejected (%s sim=%.2f) %r ~ prior %r",
                hit.kind, hit.score, candidate[:70], (hit.matched or "")[:70],
            )
        else:
            det.add(candidate, hit.vec)
        return hit

# Optional deferred-import shims — resolved at first call so startup never fails
try:
    from interview_agents.services.question_source_router import QuestionSourceRouter as _QuestionSourceRouter
except Exception:  # pragma: no cover
    _QuestionSourceRouter = None  # type: ignore[assignment]

try:
    from interview_agents.utils.metrics_tracker import record_rag_turn as _record_rag_turn
except Exception:  # pragma: no cover
    def _record_rag_turn(*_a, **_kw): pass  # type: ignore[misc]

try:
    from interview_agents.utils.metrics_tracker import record_web_search as _record_web_search
except Exception:  # pragma: no cover
    def _record_web_search(*_a, **_kw): pass  # type: ignore[misc]

try:
    from services.retrieval.jd_skill_extractor import extract_jd_skills_llm as _extract_jd_skills_llm
except Exception:  # pragma: no cover
    def _extract_jd_skills_llm(*_a, **_kw): return []  # type: ignore[misc]

try:
    from interview_agents.interview_engine.dedup import NearDuplicateDetector as _NearDuplicateDetector
except Exception:  # pragma: no cover
    _NearDuplicateDetector = None  # type: ignore[assignment]

try:
    from interview_agents.interview_engine.adapters import OpenAIEmbedder as _OpenAIEmbedder
    from interview_agents.interview_engine.adapters import CachingEmbedder as _CachingEmbedder
except Exception:  # pragma: no cover
    _OpenAIEmbedder = None  # type: ignore[assignment]
    _CachingEmbedder = None  # type: ignore[assignment]

from sqlalchemy.orm import Session

from interview_agents.agents import (
    AnswerEvaluatorAgent,
    DifficultyControllerAgent,
    FollowUpQuestionGeneratorAgent,
    QuestionGeneratorAgent,
    ReportGeneratorAgent,
)
from interview_agents.agents.subject_agent import SubjectAgent
from interview_agents.agents.verbal_agent import VerbalAgent
from interview_agents.agents.written_agent import WrittenAgent
from interview_agents.agents.company_agent import CompanyAgent
from interview_agents.agents.hr_behavioral_agent import HRBehavioralAgent
from interview_agents.agents.svar_agent import SVARAgent
from interview_agents.agents.system_design_agent import SystemDesignAgent
from interview_agents.agents.psychometric_agent import PsychometricAgent
from interview_agents.config.settings import get_settings
from interview_agents.graph.workflow import build_interview_graph
from interview_agents.memory.memory_manager import MemoryManager
from interview_agents.schemas.interview import (
    AnswerEvaluationResult,
    CodeEvaluationResult,
    CodingEvaluationFeedback,
    CodingQuestionResult,
    CodingScoringParameter,
    CodingScoringParameters,
    FinalReportResult,
    HealthResponse,
    QuestionGenerationResult,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from interview_agents.services.openai_service import OpenAIConfigurationError, OpenAIService
from interview_agents.services.web_search_service import WebSearchService, prefetch_grounding
from interview_agents.utils.enums import DifficultyLevel, InterviewType, QuestionCategory


# Maps an external client's interview type (e.g. the Avatar Interviews studio)
# to a free-text category hint consumed by ${category_hint} in the question
# generation prompt. Unknown / None types fall through to the agent's own
# category cycling. The hint is advisory text only — the model still returns one
# of the valid QuestionCategory output values.
AVATAR_TYPE_CATEGORY_HINTS: dict[str, str] = {
    "behavioral": "Behavioral",
    "technical": "Technical / core CS concepts",
    "dsa": "Data Structures & Algorithms (problem solving)",
    "system-design": "System Design",
    "verbal": "Verbal communication / general",
}

_VALID_DIFFICULTIES = {
    DifficultyLevel.EASY.value,
    DifficultyLevel.MEDIUM.value,
    DifficultyLevel.HARD.value,
}


def normalize_difficulty(value: str | None, default: str = DifficultyLevel.MEDIUM.value) -> str:
    """Coerce a client-supplied difficulty (e.g. 'hard') to a canonical level."""

    if isinstance(value, str):
        candidate = value.strip().capitalize()
        if candidate in _VALID_DIFFICULTIES:
            return candidate
    return default


def _has_fixed_difficulty_schedule(session: Any) -> bool:
    """True when the session carries an admin-defined easy/medium/hard mix."""
    return getattr(session, "easy_count", None) is not None


def _positional_difficulty(session: Any, question_no: int) -> str:
    """Position-based difficulty from a fixed easy/medium/hard mix - mirrors the
    Node backend's scheduling for admin-scheduled interviews exactly
    (easyRemaining > questionNo ? Easy : mediumRemaining + easyRemaining > questionNo
    ? Medium : Hard), so avatar and non-avatar follow the identical schedule."""
    easy = getattr(session, "easy_count", None) or 0
    medium = getattr(session, "medium_count", None) or 0
    if easy > question_no:
        return DifficultyLevel.EASY.value
    if medium + easy > question_no:
        return DifficultyLevel.MEDIUM.value
    return DifficultyLevel.HARD.value


def _trace(msg: str) -> None:
    """Emit a human-readable, real-time trace of the agent pipeline.

    Prints to the agent's stdout (console / uvicorn.log) with flush, so it shows
    up live while an interview runs — e.g. watch it during an Avatar interview
    with: Get-Content uvicorn.log -Wait
    """
    print(f"[agent] {msg}", flush=True)


# One shared OpenAIService (and thus one warm OpenAI client / connection pool)
# reused across every request. The orchestrator is rebuilt per request, but the
# LLM client must not be — a fresh client per request means a cold TLS handshake
# on every question-generation call. The OpenAI SDK client is thread-safe.
_shared_openai_service: "OpenAIService | None" = None
_shared_openai_service_ready = False
_web_search_warmed: set[str] = set()


def _get_shared_openai_service(settings) -> "OpenAIService | None":
    global _shared_openai_service, _shared_openai_service_ready
    if _shared_openai_service_ready:
        return _shared_openai_service
    if getattr(settings, "openai_api_key", None):
        try:
            _shared_openai_service = OpenAIService(settings)
        except OpenAIConfigurationError:
            _shared_openai_service = None
    _shared_openai_service_ready = True
    return _shared_openai_service


# The RAG/retriever stack (ChromaStore, embedding services, retriever, question
# selector, followup manager, question-bank service) has no dependency on the
# per-request `db`/`memory` the orchestrator otherwise needs rebuilt per request
# (see get_interview_orchestrator in app/api/deps.py) - it's pure config +
# shared external resources, exactly like _shared_openai_service above. Left
# inline in __init__, ChromaStore() alone reopens a chromadb.PersistentClient
# (real disk I/O) on every single API call - question generation, evaluation,
# even health checks - regardless of whether that request ever touches RAG.
# Built once and reused; openai_service is itself already the shared singleton
# above, so every caller passes the same instance in regardless of which
# request happened to trigger the first build.
_shared_rag_components: dict | None = None
_shared_rag_ready = False
_shared_rag_lock = threading.Lock()


def _build_rag_components(settings, openai_service) -> dict:
    components: dict[str, Any] = {
        "retriever": None,
        "question_selector": None,
        "context_manager": None,
        "llm_adapter": None,
        "followup_manager": None,
        "qb_service": None,
        "rag_enabled": False,
        "rag_disabled_reason": None,
    }
    try:
        from services.vector_store.chroma_store import ChromaStore  # type: ignore[import]
        from services.vector_store.embedding_provider import TestEmbeddingProvider, OpenAIEmbeddingProvider  # type: ignore[import]
        from services.vector_store.embedding_service import EmbeddingService  # type: ignore[import]
        from services.vector_store.retrieval_service import RetrievalService  # type: ignore[import]
        from services.vector_store.embedding_cache import EmbeddingCache  # type: ignore[import]
        from services.vector_store.embedding_version import EmbeddingVersionManager  # type: ignore[import]
        from services.retrieval.retriever import Retriever  # type: ignore[import]
        from services.retrieval.question_selector import QuestionSelector  # type: ignore[import]
        from services.rag.context_manager import ContextManager  # type: ignore[import]
        from services.rag.llm_adapter import LLMAdapter  # type: ignore[import]
        from services.rag.followup_manager import FollowupManager  # type: ignore[import]
        from services.retrieval.question_bank_service import QuestionBankService  # type: ignore[import]

        v_mgr = EmbeddingVersionManager()
        active_version = v_mgr.get_active_version()
        collection_name = v_mgr.get_collection_name(active_version)

        store = ChromaStore()
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cache_file = os.path.join(base_dir, "knowledge_base", "embeddings", "embedding_cache.json")
        cache = EmbeddingCache(cache_file=cache_file)

        api_key = settings.openai_api_key
        if api_key:
            provider = OpenAIEmbeddingProvider(api_key=api_key)
        else:
            provider = TestEmbeddingProvider(dimensions=1536)

        embedding_service = EmbeddingService(provider, cache)
        retrieval_service = RetrievalService(store, embedding_service, collection_name)

        reports_dir = os.path.join(base_dir, "knowledge_base", "reports")
        components["retriever"] = Retriever(retrieval_service, reports_dir=reports_dir)
        components["question_selector"] = QuestionSelector()
        components["context_manager"] = ContextManager()
        components["llm_adapter"] = LLMAdapter(openai_service)
        components["followup_manager"] = FollowupManager(
            retriever=components["retriever"],
            question_selector=components["question_selector"],
            context_manager=components["context_manager"],
            llm_adapter=components["llm_adapter"],
        )
        components["qb_service"] = QuestionBankService()
        components["rag_enabled"] = settings.rag_enabled
        if components["rag_enabled"]:
            _trace("RAG pipeline initialized (ChromaDB + retriever ready)")
            # Visibility: an enabled-but-empty store retrieves nothing. Warn loudly
            # rather than let every RAG interview silently return no grounding.
            try:
                _stats = store.get_collection_stats(collection_name)
                _cnt = _stats.get("total_items", 0) if isinstance(_stats, dict) else 0
                if not _cnt:
                    logger.warning(
                        "RAG is ENABLED but vector collection '%s' is EMPTY — retrieval will "
                        "return nothing; run populate_chromadb.py to ingest the knowledge base.",
                        collection_name,
                    )
            except Exception as _cnt_exc:  # counting must never break init
                logger.warning("RAG enabled but could not read collection '%s' size: %s", collection_name, _cnt_exc)
        else:
            components["rag_disabled_reason"] = "RAG_ENABLED=false"
            _trace("RAG pipeline imported but disabled via settings (RAG_ENABLED=false) — skipping retrieval, using specialized agents directly")
    except Exception as _rag_exc:
        components["rag_disabled_reason"] = f"initialization failed: {_rag_exc}"
        logger.warning(
            "RAG pipeline unavailable (%s) — falling back to LLM-only question generation",
            _rag_exc,
        )
        _trace(f"RAG disabled: {_rag_exc}")
    return components


def _get_shared_rag_components(settings, openai_service) -> dict:
    global _shared_rag_components, _shared_rag_ready
    if _shared_rag_ready:
        return _shared_rag_components
    with _shared_rag_lock:
        if not _shared_rag_ready:
            _shared_rag_components = _build_rag_components(settings, openai_service)
            _shared_rag_ready = True
    return _shared_rag_components


# generate_coding_question's anti-convergence pools: with an empty session
# history (every fresh candidate), the "don't repeat" instruction alone has
# nothing to compare against, and the model reliably collapses onto the same
# handful of examples (verified: 3 of 4 independent empty-history calls for
# "Software Engineer"/Medium all returned a "REST API for a book collection"
# problem). Randomly forcing a category + scenario server-side, rather than
# leaving both entirely up to the model, guarantees actual variety instead of
# hoping for it.
_CODING_CATEGORY_POOL = [
    "array/string manipulation", "hash map or frequency counting", "two-pointer or sliding window",
    "tree or graph traversal", "dynamic programming", "recursion or backtracking",
    "sorting or searching variant", "stack or queue simulation", "OOP class design",
    "string parsing or regex", "concurrency or async coordination", "caching (e.g. LRU) design",
    "matrix or grid traversal", "greedy algorithm", "bit manipulation",
]
_CODING_SQL_CATEGORY_POOL = [
    "aggregation and grouping", "window functions", "self-join or multi-table join",
    "subquery or CTE", "ranking within groups", "date/time range filtering",
]
_CODING_FRONTEND_CATEGORY_POOL = [
    "state management in a component", "list rendering and filtering", "form validation logic",
    "debounced/throttled event handling", "custom hook design", "async data-fetching with loading/error states",
]
_CODING_AGENT_CATEGORY_POOL = [
    "tool-calling / function-calling schema design", "agent state machine or workflow graph design",
    "prompt-chaining or multi-step pipeline logic", "structured output parsing and validation",
    "retry/fallback orchestration across multiple LLM calls", "memory or context-window management for an agent",
    "routing logic between multiple specialized agents", "rate-limiting or queueing for LLM API calls",
]
_CODING_SCENARIO_POOL = [
    "a ride-sharing trip matching system", "a hospital patient appointment scheduler",
    "a warehouse inventory tracker", "a social media post feed", "a music streaming playlist manager",
    "a flight booking system", "a hotel room reservation system", "a fitness tracker workout log",
    "a banking transaction ledger", "a customer support ticket queue", "a video game leaderboard",
    "a stock trading order book", "a smart-home sensor data stream", "a university course enrollment system",
    "a parking lot occupancy tracker", "a chat application's message history", "a job application tracker",
    "a food delivery order queue", "a package shipment tracking system", "a movie streaming recommendation list",
]
# Paired with _CODING_AGENT_CATEGORY_POOL - a generic business scenario (ride-
# sharing, hospital, ...) combined with an agent category hint kept producing
# ordinary DSA problems with agent vocabulary sprinkled on top ("match riders
# to drivers via a function-calling schema") instead of an actual agent
# exercise, since the LLM leans on whichever hint is more concrete. Both hints
# need to be agent-native together for the result to actually be one.
_CODING_AGENT_SCENARIO_POOL = [
    "a customer-support agent that must call lookup_order/refund/escalate tools",
    "a research agent that chains a search tool into a summarization tool",
    "a coding agent that calls read_file/edit_file/run_tests tools in sequence",
    "a travel-booking agent coordinating flight/hotel/car-rental tool calls",
    "a multi-agent pipeline handing off a task between a planner and an executor agent",
    "an agent enforcing a JSON schema on an LLM's structured tool-call output",
    "an agent retrying a failed tool call with exponential backoff before falling back",
    "an agent router dispatching a user request to one of several specialized sub-agents",
]


# Deterministic all-zero evaluation for a blank answer, shaped to match each
# eval prompt's schema exactly so the Node.js backend reads the same keys it
# would from a real LLM response. Returned instead of calling the LLM when the
# candidate submitted nothing — a non-answer is a 0, never a floored ~10.
def _empty_glamis_eval(interview_type: str, question: str) -> dict[str, Any]:
    NONE = "No answer was provided."
    pc = {"Pros": "", "Cons": NONE}
    itype = (interview_type or "").lower()
    if itype == "written":
        return {
            "overallScore": 0, "grammarScore": 0, "vocabularyScore": 0, "contentStructureScore": 0,
            "contentStructureExplanation": pc, "vocabularyExplanation": pc, "grammarExplanation": pc,
            "expectedResponse": "",
        }
    if itype == "svar":
        return {
            "question": question, "userAnswer": "",
            "overallScore": 0, "grammarScore": 0, "vocabularyScore": 0,
            "pronunciationScore": 0, "correctnessScore": 0,
            "grammarExplanation": pc, "pronunciationExplanation": pc, "correctnessExplanation": pc,
            "expectedAnswer": "",
        }
    if itype == "psychometric":
        # Matches PsychometricEvaluationResult.to_base_dict()'s shape exactly
        # (snake_case, pillar_scores) rather than the generic camelCase shape
        # below, so Node parses one consistent shape for this type regardless
        # of whether the answer was blank.
        return {
            "technical_score": 0, "communication_score": 0, "relevance_score": 0,
            "problem_solving_score": 0, "completeness_score": 0, "overall_score": 0,
            "feedback": NONE, "strengths": [], "weaknesses": [],
            "follow_up_needed": False, "pillar_scores": {}, "consistency_flag": False,
        }
    # subject / verbal / company / hr share the same camelCase schema. HR also
    # carries the behavioural competency axes (STAR/Confidence/Domain) so a blank
    # answer contributes a real 0 to the batch competency averages, not a gap.
    return {
        "question": question, "userAnswer": "",
        "overallScore": 0, "grammarScore": 0, "vocabularyScore": 0,
        "technicalScore": 0, "correctnessScore": 0,
        "starScore": 0, "confidenceScore": 0, "domainScore": 0,
        "technicalExplanation": pc, "vocabularyExplanation": pc, "grammarExplanation": pc,
        "expectedAnswer": "",
    }


class InterviewOrchestrator:
    """Coordinates database, agents, and the LangGraph workflow."""

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.memory = MemoryManager(db)
        self.openai_service = self._build_openai_service()
        self.question_agent = QuestionGeneratorAgent(self.openai_service, self.memory)
        self.answer_evaluator = AnswerEvaluatorAgent(self.openai_service, self.memory)
        self.followup_agent = FollowUpQuestionGeneratorAgent(self.openai_service, self.memory)
        self.difficulty_agent = DifficultyControllerAgent(self.openai_service, self.memory)
        self.report_agent = ReportGeneratorAgent(self.openai_service, self.memory)
        self.subject_agent = SubjectAgent(self.openai_service, self.memory)
        self.verbal_agent = VerbalAgent(self.openai_service, self.memory)
        self.written_agent = WrittenAgent(self.openai_service, self.memory)
        self.company_agent = CompanyAgent(self.openai_service, self.memory)
        self.hr_agent = HRBehavioralAgent(self.openai_service, self.memory)
        self.svar_agent = SVARAgent(self.openai_service, self.memory)
        self.system_design_agent = SystemDesignAgent(self.openai_service, self.memory)
        self.psychometric_agent = PsychometricAgent(self.openai_service, self.memory)
        self.web_search_service = WebSearchService(self.settings)
        self.workflow = build_interview_graph(self)

        # RAG/retriever stack is entirely stateless (no db/memory dependency) -
        # built once process-wide and reused instead of reopening a persistent
        # ChromaDB client on every single request. See _get_shared_rag_components.
        _rag = _get_shared_rag_components(self.settings, self.openai_service)
        self.retriever = _rag["retriever"]
        self.question_selector = _rag["question_selector"]
        self.context_manager = _rag["context_manager"]
        self.llm_adapter = _rag["llm_adapter"]
        self.followup_manager = _rag["followup_manager"]
        self.qb_service = _rag["qb_service"]
        self.rag_enabled = _rag["rag_enabled"]
        # Human-readable reason RAG ended up disabled, surfaced at startup and per
        # interview so an off/empty pipeline is never a silent degradation.
        self.rag_disabled_reason = _rag["rag_disabled_reason"]

        # Startup summary: if RAG is off for ANY reason, say so at WARNING level so a
        # misconfigured server/checkout is obvious in the logs (behaviour unchanged —
        # interviews still run via the LLM/specialized-agent path).
        if not self.rag_enabled:
            logger.warning(
                "RAG DISABLED at startup (reason: %s). Interviews scheduled with a RAG mode "
                "(e.g. 'default' / 'Adaptive RAG mix') will fall back to LLM-only generation. "
                "Set RAG_ENABLED=true and populate the vector store to enable retrieval.",
                self.rag_disabled_reason or "RAG_ENABLED=false",
            )

    def _build_openai_service(self) -> OpenAIService | None:
        # Shared across all requests so the underlying OpenAI client's TCP/TLS
        # connection pool stays warm and is reused, instead of a cold handshake
        # on every question-generation call (the orchestrator is rebuilt per
        # request). The OpenAI client is thread-safe and designed for concurrent
        # reuse, so a single instance is both correct and much faster under load.
        return _get_shared_openai_service(self.settings)

    def health(self) -> HealthResponse:
        return HealthResponse()

    def start_interview(self, request: StartInterviewRequest) -> StartInterviewResponse:
        difficulty = normalize_difficulty(request.difficulty)
        has_fixed_schedule = request.easy_count is not None
        if has_fixed_schedule:
            # Admin-scheduled mix present - question 0's difficulty follows the
            # same position-based schedule as the non-avatar flow, not the
            # client-supplied starting difficulty.
            difficulty = _positional_difficulty(request, 0)
        interview_type = (request.interview_type or "").strip().lower() or None
        # Route through create_glamis_session whenever a type OR a fixed E/M/H schedule
        # is present: create_session() has no easy/medium/hard_count params, so a
        # scheduled interview with an empty interview_type would silently lose its mix
        # (honored for Q0 only, then adaptive from Q1).
        if interview_type or has_fixed_schedule:
            # Persist the type so every question/eval in the session can honor it
            # (reuses the existing interview_type/difficulty columns — no migration).
            session = self.memory.create_glamis_session(
                candidate_name=request.candidate_name,
                role=request.role,
                experience=request.experience,
                skills=request.skills,
                interview_type=interview_type or "subject",
                subject=request.subject,
                company=request.company,
                job_title=request.job_title,
                jd_details=request.jd_details,
                difficulty=difficulty,
                web_search_enabled=request.web_search_enabled,
                easy_count=request.easy_count,
                medium_count=request.medium_count,
                hard_count=request.hard_count,
                coding_count=request.coding_count,
                question_bank_id=request.question_bank_id,
                question_bank_ratio=request.question_bank_ratio,
            )
        else:
            session = self.memory.create_session(
                candidate_name=request.candidate_name,
                role=request.role,
                experience=request.experience,
                skills=request.skills,
                difficulty=difficulty,
            )
        _trace(
            f"START {interview_type or 'generic'} interview | role={request.role!r} "
            f"| start difficulty={difficulty} | session={session.id[:8]}"
        )
        state = self.workflow.invoke(
            {
                "session_id": session.id,
                "candidate_name": request.candidate_name,
                "role": request.role,
                "experience": request.experience,
                "skills": request.skills,
            }
        )
        return StartInterviewResponse(session_id=session.id, first_question=state.get("next_question", ""))

    def submit_answer(self, request: SubmitAnswerRequest) -> SubmitAnswerResponse:
        session = self.memory.get_session(request.session_id)
        # Only reject if questions_asked is somehow negative — a freshly-started
        # session has questions_asked=0 (first question just generated) so the
        # original <= 0 guard incorrectly rejected the very first answer.
        if session.questions_asked < 0:
            raise ValueError("The interview session has not been started correctly.")

        # Previously, an empty/too-short/non-answer ("I don't know", etc.) short-
        # circuited here and re-asked the SAME question instead of advancing -
        # intended as a "give them another shot" guard, but it meant a candidate
        # who didn't know an answer could never get past it within their question
        # budget. Always advance through the real workflow instead: a weak/blank
        # answer just scores low and the interview moves on to a new question.
        state = self.workflow.invoke(
            {
                "session_id": session.id,
                "candidate_answer": request.answer,
            }
        )
        evaluation = state.get("evaluation", {})
        next_question = state.get("next_question", "")
        return SubmitAnswerResponse(
            evaluation=evaluation,
            next_question=next_question,
            difficulty=state.get("current_difficulty", session.difficulty),
            interview_complete=state.get("interview_complete", False),
            question_type="coding" if state.get("is_coding_turn") else "qa",
        )

    def get_report(self, session_id: str) -> dict[str, Any]:
        report = self.memory.get_report(session_id)
        if report is None:
            result = self.report_agent.generate(session_id)
            report = self.memory.store_report(session_id, result.model_dump())
            self._save_report_snapshot(session_id, result)
        else:
            # Ensure report_snapshot exists in session
            session = self.memory.get_session(session_id)
            if not getattr(session, "report_snapshot", None):
                # FinalReportResult is already imported at the top of this module
                try:
                    result = FinalReportResult(**report.report_json)
                    self._save_report_snapshot(session_id, result)
                except Exception:
                    pass
        return report.report_json

    def _session_interview_type(self, session_id: str) -> str | None:
        """The interview type persisted on the session ('subject' by default)."""
        session = self.memory.get_session(session_id)
        itype = (getattr(session, "interview_type", None) or "").strip().lower()
        return itype or None

    def load_context(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state["session_id"]
        context = self.memory.get_recent_context(session_id)

        # Fix 6: Web-search grounding — fired ONCE per session (at turn 1) so
        # Tavily latency is never in the critical path of answer submission or
        # question generation turns. Use module-level global set.
        session = self.memory.get_session(session_id)
        global _web_search_warmed
        if session_id not in _web_search_warmed:
            _web_search_warmed.add(session_id)
            prefetch_grounding(
                self.web_search_service,
                (getattr(session, "interview_type", None) or "subject").strip().lower(),
                subject=getattr(session, "subject", None) or "",
                company=getattr(session, "company", None) or getattr(session, "job_title", None) or "",
                role=context["role"],
                web_search_enabled=bool(getattr(session, "web_search_enabled", False)),
            )

        return {
            **state,
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": context["skills"],
            "current_difficulty": context["difficulty"],
            "question_count": context["questions_asked"],
            "session_context": context,
            "recent_questions": context["recent_questions"],
            "recent_answers": context["recent_answers"],
        }

    def evaluate_answer(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state["session_id"]
        question = self.memory.get_latest_question(session_id)
        interview_type = self._session_interview_type(session_id) or "subject"

        # Coding round: grade by having the LLM read the code (logic/structure,
        # never executed) instead of the normal voice-answer evaluator - see
        # generate_coding_question_node, which is what tags a question "Coding".
        if getattr(question, "category", None) == "Coding":
            session = self.memory.get_session(session_id)
            eval_dict = self._evaluate_code_answer_as_evaluation_result(
                question.question, state["candidate_answer"], getattr(session, "difficulty", None) or "Medium"
            )
            self.memory.store_answer(session_id, question.id, state["candidate_answer"], eval_dict)
            _trace(f"CodeAnswerEvaluator -> overall {eval_dict.get('overall_score')}/10")
            return {
                **state,
                "current_question": question.question,
                "current_question_id": question.id,
                "evaluation": eval_dict,
            }

        expected_answer = None
        rubric = None
        try:
            rag_history = self.memory.get_rag_history(session_id)
            if rag_history:
                latest_turn = rag_history[-1]
                expected_answer = latest_turn.get("expected_answer")
                rubric = latest_turn.get("evaluation_rubric")
        except Exception:
            pass

        evaluation = self.answer_evaluator.evaluate(
            session_id, question.question, state["candidate_answer"], interview_type,
            expected_answer=expected_answer, rubric=rubric
        )
        
        eval_dict = evaluation.model_dump()
        # Surface a model answer for the report: prefer the turn's authoritative
        # expected answer; otherwise fall back to the one the evaluator generated.
        eval_dict["expected_answer"] = expected_answer or eval_dict.get("expected_answer") or ""
        if expected_answer or rubric:
            eval_dict["rag_metadata"] = {
                "expected_answer": expected_answer,
                "evaluation_rubric": rubric
            }

        self.memory.store_answer(session_id, question.id, state["candidate_answer"], eval_dict)
        _trace(
            f"AnswerEvaluator -> overall {evaluation.overall_score}/10 "
            f"(tech {evaluation.technical_score} comm {evaluation.communication_score} "
            f"rel {evaluation.relevance_score} prob {evaluation.problem_solving_score} "
            f"compl {evaluation.completeness_score}) follow_up_needed={evaluation.follow_up_needed}"
        )
        return {
            **state,
            "current_question": question.question,
            "current_question_id": question.id,
            "evaluation": eval_dict,
        }

    def _evaluate_code_answer_as_evaluation_result(self, question: str, code: str, difficulty: str) -> dict[str, Any]:
        """Adapts evaluate_code_answer's 0-100 CodeEvaluationResult into the same
        0-10 AnswerEvaluationResult-shaped dict evaluate_answer normally produces,
        so store_answer/report generation downstream need no changes."""
        result = self.evaluate_code_answer(question, code, difficulty)
        overall_10 = max(0, min(10, round(result.overall_score / 10)))
        correctness_10 = max(0, min(10, round(result.correctness_score / 10)))
        structure_10 = max(0, min(10, round(result.structure_score / 10)))
        feedback = "\n\n".join(part for part in (result.pros, result.cons) if part) or "No feedback generated."

        evaluation = AnswerEvaluationResult(
            technical_score=structure_10,
            communication_score=structure_10,
            relevance_score=correctness_10,
            problem_solving_score=correctness_10,
            completeness_score=correctness_10,
            correctness_score=correctness_10,
            overall_score=overall_10,
            feedback=feedback,
            strengths=[result.pros] if result.pros else [],
            weaknesses=[result.cons] if result.cons else [],
            expected_answer=result.expected_approach or "",
            # A coding turn should never trigger generate_followup - that node
            # isn't designed for code, and route_after_adjustment already routes
            # a coding turn straight to generate_coding_question regardless.
            follow_up_needed=False,
        )
        eval_dict = evaluation.model_dump()
        eval_dict["expected_answer"] = result.expected_approach or ""
        return eval_dict

    def adjust_difficulty(self, state: dict[str, Any]) -> dict[str, Any]:
        session = self.memory.get_session(state["session_id"])
        evaluation = state.get("evaluation", {})

        if _has_fixed_difficulty_schedule(session):
            # Admin-defined easy/medium/hard mix - follow it by position,
            # exactly like the non-avatar flow, instead of adapting live off
            # the candidate's score. Skips the LLM difficulty_controller call
            # entirely for these turns (fewer calls, not more - no added latency).
            emh_total = (session.easy_count or 0) + (session.medium_count or 0) + (session.hard_count or 0)
            coding_total = getattr(session, "coding_count", None) or 0
            is_coding_turn = coding_total > 0 and session.questions_asked >= emh_total
            if is_coding_turn:
                # LeetCode-style coding round: always Medium or Hard, never Easy.
                new_difficulty = random.choice(["Medium", "Hard"])
            else:
                new_difficulty = _positional_difficulty(session, session.questions_asked)
            session.difficulty = new_difficulty
            if self.memory.use_mongo:
                self.memory.col_sessions.update_one(
                    {"_id": session.id},
                    {"$set": {"difficulty": new_difficulty}}
                )
            else:
                self.db.commit()
            _trace(f"DifficultyController -> fixed-schedule -> {new_difficulty}" + (" (coding)" if is_coding_turn else ""))
            return {
                **state,
                "current_difficulty": new_difficulty,
                "difficulty_adjustment": {"action": "fixed_schedule", "difficulty": new_difficulty},
                "is_coding_turn": is_coding_turn,
            }

        adjusted = self.difficulty_agent.adjust(session.id, evaluation, session.difficulty)
        session.difficulty = adjusted.difficulty.value
        if self.memory.use_mongo:
            self.memory.col_sessions.update_one(
                {"_id": session.id},
                {"$set": {"difficulty": adjusted.difficulty.value}}
            )
        else:
            self.db.commit()
        _trace(f"DifficultyController -> {adjusted.action} -> {adjusted.difficulty.value}")
        return {
            **state,
            "current_difficulty": adjusted.difficulty.value,
            "difficulty_adjustment": adjusted.model_dump(),
            "is_coding_turn": False,
        }

    def generate_followup(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state["session_id"]
        result = self.generate_rag_followup(session_id)
        stored = self.memory.store_question(session_id, result.question, result.category.value, result.difficulty.value, True)
        
        try:
            rag_history = self.memory.get_rag_history(session_id)
            if rag_history:
                stored.rag_metadata = rag_history[-1]
        except Exception:
            pass

        _trace(f"FollowUpGenerator -> {stored.question}")
        return {
            **state,
            "next_question": stored.question,
            "current_question": stored.question,
            "current_question_id": stored.id,
        }

    def generate_question(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state["session_id"]
        context = self.memory.get_recent_context(session_id)
        itype = self._session_interview_type(session_id) or "subject"

        # Avatar/GLAMIS sessions are multi-turn: the toggle is set once at
        # start_interview() and persisted on the session row, then re-read on
        # every subsequent turn here (unlike the stateless text-interview flow,
        # which gets web_search_enabled fresh on each request instead).
        session = self.memory.get_session(session_id)
        web_search_enabled = bool(getattr(session, "web_search_enabled", False))

        result = self.generate_rag_question(
            session_id, itype,
            web_search_enabled=web_search_enabled,
            candidate_name=context.get("candidate_name"),
            role=context.get("role"),
            experience=context.get("experience"),
            skills=context.get("skills"),
            # Without this, generate_rag_question's fallback context_dict silently
            # defaults difficulty to "Medium" regardless of the session's real
            # (possibly fixed-schedule) difficulty - question_style_directive then
            # always picks from the Medium shape pool no matter what tier this
            # turn is actually supposed to be.
            difficulty=context.get("difficulty"),
            # Without this, generate_from_context's context_dict["recent_questions"]
            # is always empty for avatar sessions - the LLM has no idea what it
            # already asked and happily repeats itself turn to turn.
            conversation_history=context.get("recent_questions"),
        )
        stored = self.memory.store_question(session_id, result.question, result.category.value, result.difficulty.value, False)
        # generate_followup checks this same hash set via has_asked_question - without
        # marking it here too, a plain (non-follow-up) question is invisible to that
        # exact-duplicate guard on a later turn.
        self.memory.mark_question_asked(session_id, result.question)

        try:
            rag_history = self.memory.get_rag_history(session_id)
            if rag_history:
                stored.rag_metadata = rag_history[-1]
        except Exception:
            pass

        _trace(f"QuestionGenerator -> [{result.category.value}/{result.difficulty.value}] {stored.question}")
        return {
            **state,
            "next_question": stored.question,
            "current_question": stored.question,
            "current_question_id": stored.id,
            "current_difficulty": stored.difficulty,
            "question_count": context["questions_asked"] + 1,
        }

    def generate_coding_question_node(self, state: dict[str, Any]) -> dict[str, Any]:
        """Coding round - reached only via route_after_adjustment once easy/medium/
        hard are exhausted (is_coding_turn=True). Reuses generate_coding_question
        (the same generator the stateless non-avatar /interview/coding route uses),
        no RAG/question-bank involved - there is no admin-authored coding bank."""
        session_id = state["session_id"]
        session = self.memory.get_session(session_id)
        context = self.memory.get_recent_context(session_id)
        itype = self._session_interview_type(session_id) or "subject"
        jd_details = ""
        if itype == "company":
            domain_context = getattr(session, "job_title", None) or getattr(session, "company", None) or "Software Engineer"
            jd_details = getattr(session, "jd_details", None) or ""
        else:
            domain_context = getattr(session, "subject", None) or "Software Engineering"
        difficulty = state.get("current_difficulty") or "Medium"

        result = self.generate_coding_question(
            domain_context=domain_context,
            difficulty=difficulty,
            conversation_history=context.get("recent_questions"),
            jd_details=jd_details,
        )
        # category="Coding" is how evaluate_answer recognizes this turn and routes
        # to evaluate_code_answer instead of the normal answer_evaluator.
        stored = self.memory.store_question(session_id, result.question, "Coding", result.difficulty.value, False)
        self.memory.mark_question_asked(session_id, result.question)

        _trace(f"CodingQuestionGenerator -> [{result.difficulty.value}] {stored.question}")
        return {
            **state,
            "next_question": stored.question,
            "current_question": stored.question,
            "current_question_id": stored.id,
            "current_difficulty": stored.difficulty,
            "question_count": context["questions_asked"] + 1,
        }

    def _save_report_snapshot(self, session_id: str, report: Any) -> None:
        try:
            rag_history = []
            try:
                rag_history = self.memory.get_rag_history(session_id) or []
            except Exception:
                pass

            similarity_scores = [
                float(turn.get("retrieval_similarity") or 0.0)
                for turn in rag_history
                if turn.get("retrieval_similarity") is not None
            ]
            avg_similarity = float(statistics.mean(similarity_scores)) if similarity_scores else 0.8

            snapshot = {
                "summary": getattr(report, "summary", "") or "",
                "strengths": getattr(report, "strengths", []) or [],
                "weaknesses": getattr(report, "weaknesses", []) or [],
                "recommendations": getattr(report, "recommendations", []) or [],
                "placement_readiness": int(getattr(report, "placement_readiness_percent", 0) or getattr(report, "placement_readiness", 0) or 0),
                "company_fit": getattr(report, "company_fit", {}) or {},
                "red_flags": getattr(report, "red_flags", []) or [],
                "hiring_recommendation": getattr(report, "interview_outcome", "") or getattr(report, "hiring_recommendation", "") or "",
                "cultural_fit": int(getattr(report, "cultural_fit_score", 0) or getattr(report, "cultural_fit", 0) or 0),
                "learning_resources": getattr(report, "next_session_recommendation", "") or getattr(report, "learning_resources", "") or "",
                "retrieval_similarity": avg_similarity,
            }
            if self.memory.use_mongo:
                self.memory.col_sessions.update_one(
                    {"_id": session_id},
                    {"$set": {"report_snapshot": snapshot}},
                )
        except Exception as _snap_err:
            logger.warning("report_snapshot write failed (non-fatal): %s", _snap_err)

    def generate_report(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state["session_id"]
        report = self.report_agent.generate(session_id)
        report_dict = report.model_dump()
        report_row = self.memory.store_report(session_id, report_dict)

        self._save_report_snapshot(session_id, report)

        # Character-by-Character Exact Match Validation Report
        # Reuse self.qb_service if already initialized; otherwise skip silently.
        try:
            qb_svc = self.qb_service
            if qb_svc is None:
                raise RuntimeError("QuestionBankService not initialized (RAG disabled or import failed)")
            rag_history = self.memory.get_rag_history(session_id)
            print("\n===================================", flush=True)
            print("EXACT MATCH VALIDATION REPORT", flush=True)
            for idx, turn in enumerate(rag_history):
                if turn.get("question_source") == "QB" or turn.get("question_bank_id"):
                    retrieved_q = turn.get("expected_answer") or ""
                    # clean extracted chunk block to match original question text
                    parsed_expected = retrieved_q
                    for sep in ("\n\nExpected:", "Expected:", "\n\nAnswer:", "Answer:", "Question:"):
                        if sep in parsed_expected:
                            parsed_expected = parsed_expected.split(sep)[0].strip()
                    parsed_expected = parsed_expected.replace("Question:", "").strip()

                    displayed_q = turn.get("question") or ""
                    match_status = qb_svc.compare_questions_exact(parsed_expected, displayed_q)
                    print(f"Turn {idx + 1}: Stored Question = {parsed_expected!r} | Displayed Question = {displayed_q!r} | Status = {match_status}", flush=True)
            print("===================================\n", flush=True)
        except Exception as _val_err:
            logger.warning("Exact match validation check failed: %s", _val_err, exc_info=True)

        _trace(f"ReportGenerator -> final report (overall {report.overall_score}/10; outcome: {report.interview_outcome})")
        return {
            **state,
            "report": report_row.report_json,
            "interview_complete": True,
            "next_question": "",
        }

    def evaluate_answer_for_glamis(self, session_id: str, answer: str, interview_type: InterviewType) -> dict[str, Any]:
        question = self.memory.get_latest_question(session_id)

        # If this answer is to a follow-up question, resolve the parent (original) question,
        # answer, and evaluation so a specialized agent can score the follow-up as a
        # continuation of the same story instead of judging it alone. Agents that don't look
        # for these kwargs simply ignore them (all declare **kwargs) — no effect for other types.
        followup_kwargs: dict[str, Any] = {}
        if getattr(question, "is_follow_up", False):
            try:
                prev_questions = self.memory.get_recent_questions(session_id, limit=2)
                if len(prev_questions) >= 2:
                    parent_question = prev_questions[1]
                    parent_answer = next(
                        (a for a in self.memory.get_recent_answers(session_id, limit=5)
                         if a.question_id == parent_question.id),
                        None,
                    )
                    if parent_answer is not None:
                        followup_kwargs = {
                            "is_follow_up": True,
                            "parent_question_id": parent_question.id,
                            "parent_question": parent_question.question,
                            "parent_answer": parent_answer.answer,
                            "parent_evaluation": parent_answer.evaluation_json or {},
                        }
            except Exception:
                logger.warning("Failed to resolve follow-up parent context", exc_info=True)

        # Recover the agent-specific scenario_type tagged at question-generation time (see
        # store_generated_question / tag_question_scenario) so evaluation can be scored with
        # the right rubric instead of always falling back to a generic default.
        try:
            scenario_type = self.memory.get_question_scenario(session_id, question.id)
            if scenario_type:
                followup_kwargs.setdefault("scenario_type", scenario_type)
        except Exception:
            pass

        # Psychometric scoring must never trust client-submitted option data
        # (a candidate could otherwise self-report their own score) — always
        # resolve the pillar/response_type/options this question was actually
        # generated with from the server-side side-car tagged at question-
        # generation time (see store_generated_question below).
        try:
            psychometric_meta = self.memory.get_question_psychometric_meta(session_id, question.id)
            if psychometric_meta:
                followup_kwargs.setdefault("pillar", psychometric_meta.get("pillar"))
                followup_kwargs.setdefault("response_type", psychometric_meta.get("response_type"))
                followup_kwargs.setdefault("options", psychometric_meta.get("options"))
        except Exception:
            pass

        # Route to the specialized agent so type-specific tracking fields
        # (e.g. topic_covered for subject, scenario_type for verbal) are
        # stored in MongoDB and available to the next question generator.
        specialized_agent_map = {
            InterviewType.SUBJECT: self.subject_agent,
            InterviewType.VERBAL: self.verbal_agent,
            InterviewType.WRITTEN: self.written_agent,
            InterviewType.COMPANY: self.company_agent,
            InterviewType.HR: self.hr_agent,
            InterviewType.SYSTEM_DESIGN: self.system_design_agent,
            InterviewType.SVAR: self.svar_agent,
            InterviewType.PSYCHOMETRIC: self.psychometric_agent,
        }
        agent = specialized_agent_map.get(interview_type)
        if agent is not None:
            try:
                specialized_result = agent.evaluate(session_id, question.question, answer, **followup_kwargs)
                eval_dict = specialized_result.to_base_dict()
                self.memory.store_answer(session_id, question.id, answer, eval_dict)
                return eval_dict
            except Exception:
                logger.warning(
                    "Specialized evaluation failed for %s, falling back to generic",
                    interview_type.value, exc_info=True
                )

        expected_answer = None
        rubric = None
        try:
            rag_history = self.memory.get_rag_history(session_id)
            if rag_history:
                latest_turn = rag_history[-1]
                expected_answer = latest_turn.get("expected_answer")
                rubric = latest_turn.get("evaluation_rubric")
        except Exception:
            pass

        evaluation_result = self.answer_evaluator.evaluate(
            session_id,
            question.question,
            answer,
            interview_type.value,
            expected_answer=expected_answer,
            rubric=rubric
        )
        eval_dict = evaluation_result.model_dump()
        # Surface a model answer for the report: prefer the turn's authoritative
        # expected answer; otherwise fall back to the one the evaluator generated.
        eval_dict["expected_answer"] = expected_answer or eval_dict.get("expected_answer") or ""
        if expected_answer or rubric:
            eval_dict["rag_metadata"] = {
                "expected_answer": expected_answer,
                "evaluation_rubric": rubric
            }

        self.memory.store_answer(session_id, question.id, answer, eval_dict)
        return eval_dict

    def adjust_difficulty_for_glamis(self, session_id: str, score: int) -> str:
        session = self.memory.get_session(session_id)
        adjusted = self.difficulty_agent.adjust(session_id, {"overall_score": score}, session.difficulty)
        session.difficulty = adjusted.difficulty.value
        if self.memory.use_mongo:
            self.memory.col_sessions.update_one(
                {"_id": session_id},
                {"$set": {"difficulty": adjusted.difficulty.value}}
            )
        else:
            self.db.commit()
        return session.difficulty

    def generate_first_question(self, session_id: str, interview_type: InterviewType, **kwargs) -> QuestionGenerationResult:
        session = self.memory.get_session(session_id)
        subject = session.subject if interview_type == InterviewType.SUBJECT else None
        return self.generate_rag_question(session_id, interview_type.value, subject=subject, **kwargs)

    def generate_next_question(self, session_id: str, interview_type: InterviewType, **kwargs) -> QuestionGenerationResult:
        return self.generate_first_question(session_id, interview_type, **kwargs)

    def generate_followup_question(self, session_id: str) -> QuestionGenerationResult:
        return self.generate_rag_followup(session_id)

    def store_generated_question(self, session_id: str, result: QuestionGenerationResult, is_follow_up: bool = False) -> str:
        stored = self.memory.store_question(
            session_id,
            result.question,
            result.category.value,
            result.difficulty.value,
            is_follow_up,
        )
        if getattr(result, "scenario_type", None):
            try:
                self.memory.tag_question_scenario(session_id, stored.id, result.scenario_type)
            except Exception:
                logger.warning("Failed to tag question scenario_type", exc_info=True)
        if getattr(result, "psychometric_pillar", None):
            try:
                self.memory.tag_question_psychometric_meta(session_id, stored.id, {
                    "pillar": result.psychometric_pillar,
                    "response_type": result.psychometric_response_type,
                    "options": result.psychometric_options,
                    "scenario_context": result.psychometric_scenario_context,
                })
            except Exception:
                logger.warning("Failed to tag question psychometric meta", exc_info=True)
        return stored.question

    def route_from_context(self, state: dict[str, Any]) -> str:
        return "evaluate_answer" if state.get("candidate_answer") else "generate_question"

    def route_after_adjustment(self, state: dict[str, Any]) -> str:
        session = self.memory.get_session(state["session_id"])
        evaluation = state.get("evaluation", {})
        # A coding round changes the session's real total question budget beyond
        # the global default - but ONLY when coding_count is actually set, so every
        # session created before this field existed keeps its exact prior behavior
        # (interview_max_questions, regardless of its own easy/medium/hard sum).
        coding_total = (getattr(session, "coding_count", None) or 0) if _has_fixed_difficulty_schedule(session) else 0
        if coding_total > 0:
            effective_max = (session.easy_count or 0) + (session.medium_count or 0) + (session.hard_count or 0) + coding_total
        else:
            effective_max = self.settings.interview_max_questions
        if session.questions_asked >= effective_max:
            return "generate_report"
        if state.get("is_coding_turn"):
            return "generate_coding_question"
        # Never follow up on a follow-up — prevents cascading on the same topic
        try:
            current_q = self.memory.get_latest_question(state["session_id"])
            already_followup = getattr(current_q, "is_follow_up", False)
        except Exception:
            already_followup = False
        # A follow-up only makes sense when there's something real to probe
        # deeper into - a partial/weak-but-genuine answer. A flat 0 (blank,
        # off-topic, or gibberish) has nothing to drill into; following up on
        # it just re-asks the SAME topic in different words instead of moving
        # on, which is what made back-to-back questions look repetitive
        # (e.g. two microservices questions in a row, then two REST API ones).
        # Move straight to a fresh topic instead when the candidate showed no
        # real engagement at all.
        # Company/JD interviews never follow up (see the matching gate in
        # InterviewTypeRouter.should_include_follow_up, which covers the
        # GLAMIS avatar path - this graph-based path is the separate avatar-
        # studio start-interview/submit-answer flow, which doesn't go through
        # that gate at all, so it needs its own check). A follow-up would
        # re-probe the same topic outside the mandatory per-turn JD-skill
        # rotation instead of moving on to the next assigned skill.
        itype = self._session_interview_type(state["session_id"]) or "subject"
        if itype == "company":
            return "generate_question"
        score = evaluation.get("overall_score", 0)
        if not already_followup and score > 0 and (
            evaluation.get("follow_up_needed")
            or score < self.settings.interview_success_threshold
        ):
            return "generate_followup"
        return "generate_question"

    def generate_glamis_question(
        self,
        interview_type: str,
        difficulty: str,
        conversation_history: list[dict[str, str]] | list[Any],
        **kwargs,
    ) -> dict[str, Any]:
        if self.openai_service is None:
            raise RuntimeError("OpenAI service is not configured; set OPENAI_API_KEY")
        if interview_type == "raw":
            return {
                "question": self.openai_service.generate_completion(
                    system_instruction=kwargs.get("system_instruction") or "You are a helpful assistant.",
                    user_prompt=kwargs.get("prompt") or "",
                    model=kwargs.get("model"),
                    max_tokens=kwargs.get("max_tokens"),
                ),
                "source": "llm",
                "difficulty": difficulty
            }
        
        import time as _time
        _t_gen = _time.time()
        result = self.generate_rag_question(
            session_id=kwargs.get("interviewId") or "",
            interview_type=interview_type,
            difficulty=difficulty,
            conversation_history=conversation_history,
            **kwargs
        )
        logger.info(
            "[LATENCY] generate_glamis_question type=%s web_search=%s: %.0fms",
            interview_type, bool(kwargs.get("web_search_enabled")), (_time.time() - _t_gen) * 1000,
        )
        logger.info(
            "Question generated: type=%s subject=%s company=%s difficulty=%s web_search=%s -> %r",
            interview_type,
            kwargs.get("subject"),
            kwargs.get("company") or kwargs.get("selected_company"),
            difficulty,
            bool(kwargs.get("web_search_enabled")),
            result.question,
        )
        return {
            "question": result.question,
            "source": getattr(result, "source", "llm") or "llm",
            "difficulty": result.difficulty.value if hasattr(result.difficulty, "value") else str(result.difficulty),
            "pdf_name": getattr(result, "pdf_name", None),
            "chunk_id": getattr(result, "chunk_id", None),
            "question_bank_id": getattr(result, "question_bank_id", None),
            "similarity": getattr(result, "similarity", 0.0),
            # None/[] for every other type - only PsychometricAgent sets these.
            # The frontend needs the actual option list to render its answer
            # controls, unlike every other type here which only needs question text.
            "pillar": getattr(result, "psychometric_pillar", None),
            "response_type": getattr(result, "psychometric_response_type", None),
            "options": getattr(result, "psychometric_options", None) or [],
            "scenario_context": getattr(result, "psychometric_scenario_context", None),
        }

    def evaluate_glamis_answer(
        self,
        question: str,
        answer: str,
        interview_type: str,
        difficulty: str | None = None,
        **kwargs,
    ) -> str:
        # A blank / whitespace-only answer ("didn't speak anything") has nothing
        # to grade. Sending it to the LLM anyway made the model floor every
        # score at ~10 instead of 0 (its few-shot examples anchor plausible
        # non-zero numbers), so the report showed Grammar/Vocabulary 10 for a
        # candidate who never answered. Score it deterministically as 0 instead
        # — same principle as the empty-code-submission path.
        #
        # Also treat Node's STT-failure sentinel (interview.middleware.js's
        # UNAVAILABLE_ANSWER, substituted whenever transcription fails or no
        # audio was uploaded) the same way. It's non-blank, so it used to slip
        # past this guard straight to the LLM, which would then invent
        # plausible-sounding Pros/Cons critique of an answer that was never
        # actually given - exactly the hallucinated-evidence failure mode this
        # function exists to prevent for real blank answers.
        _normalized_answer = (answer or "").strip().lower().rstrip(".")
        if not _normalized_answer or _normalized_answer in ("not available", "n/a", "na"):
            return json.dumps(_empty_glamis_eval(interview_type, question))
        # Route to the glamis-specific eval prompts that produce the camelCase
        # schema with Pros/Cons objects and 0-100 scores that the Node.js
        # backend expects. The GLAMIS stateful flow uses specialized agents
        # instead (evaluate_answer_for_glamis), so this path is only hit by
        # the stateless /api/v1/interview/evaluate endpoint.
        # Psychometric scoring is deterministic (an options lookup) for every
        # response type except open_ended, so unlike every other branch below
        # it does not require an OpenAI key to function, and never uses the
        # glamis_eval_* prompt templates - it returns PsychometricEvaluationResult's
        # own shape (pillar_scores/overall_score/...) via to_base_dict()
        # instead of the Pros/Cons camelCase shape those prompts produce.
        if interview_type == "psychometric":
            eval_result = self.psychometric_agent.evaluate(
                "",
                question,
                answer,
                pillar=kwargs.get("pillar") or "communication",
                response_type=kwargs.get("response_type") or "likert",
                options=kwargs.get("options") or [],
            )
            return json.dumps(eval_result.to_base_dict())

        if self.openai_service is None:
            raise RuntimeError("OpenAI service is not configured; set OPENAI_API_KEY")
        if interview_type == "svar":
            return self.openai_service.generate_text(
                "glamis_eval_svar",
                {"question": question, "answer": answer, "difficulty": difficulty or "Medium"},
            )
        if interview_type == "written":
            return self.openai_service.generate_text(
                "glamis_eval_written",
                {"question": question, "answer": answer},
            )
        if interview_type == "hr":
            return self.openai_service.generate_text(
                "glamis_eval_hr",
                {"question": question, "answer": answer},
            )
        if interview_type in ("subject", "verbal", "company"):
            return self.openai_service.generate_text(
                "glamis_eval_subject",
                {"question": question, "answer": answer},
            )
        # Fallback for unknown types — return the internal schema as-is
        eval_result = self.answer_evaluator.evaluate_from_context(
            question=question,
            answer=answer,
            interview_type=interview_type,
            difficulty=difficulty,
            context_dict=kwargs,
            expected_answer=kwargs.get("expected_answer"),
            rubric=kwargs.get("rubric") or kwargs.get("evaluation_rubric"),
        )
        return json.dumps(eval_result.model_dump())

    def generate_coding_question(
        self,
        domain_context: str,
        difficulty: str,
        conversation_history: list[dict[str, Any]] | list[Any],
        jd_details: str = "",
        session_id: str | None = None,
    ) -> CodingQuestionResult:
        """Generate a fresh LeetCode-style coding problem. There is no
        admin-authored coding question bank, so this bypasses RAG entirely -
        but it does reuse the interview_engine's near-duplicate detector (see
        NearDuplicateDetector below), since the prompt's own "never repeat"
        instruction and the category/scenario rotation are not reliably
        enough on their own to stop consecutive coding turns from producing
        the same or a near-identical problem."""
        if self.openai_service is None:
            raise RuntimeError("OpenAI service is not configured; set OPENAI_API_KEY")
        previous_question_texts = [
            h.get("question", "") for h in (conversation_history or []) if isinstance(h, dict) and h.get("question")
        ]
        previous_questions = "\n".join(previous_question_texts)

        # Ground the coding problem in a specific JD skill too, not just a
        # generic category/scenario hint - mirrors the fix applied to
        # CompanyAgent's verbal questions, so the coding round also spreads
        # across the JD's requirement areas instead of only varying by
        # DSA/SQL/frontend category (which stays constant across an entire
        # interview scheduled against the same JD).
        try:
            jd_skills_list = _extract_jd_skills_llm(jd_details, domain_context, self.openai_service)
        except Exception:
            jd_skills_list = []
        previous_questions_lower = previous_questions.lower()
        uncovered_skills = [s for s in jd_skills_list if s.lower() not in previous_questions_lower]
        skill_rotation_pool = uncovered_skills or jd_skills_list

        # jd_details folded in alongside domain_context - a JD can clearly be
        # agent-engineering work ("LangGraph", "tool-calling", "autonomous
        # agents") even when domain_context is just a generic job_title like
        # "Software Engineer".
        domain_lower = f"{domain_context or ''} {jd_details or ''}".lower()
        is_agent_domain = any(kw in domain_lower for kw in ("ai agent", "agent engineer", "agentic", "langgraph", "crewai", "autonomous agent", "multi-agent", "llm orchestration", "tool-calling", "tool calling"))
        if is_agent_domain:
            category_pool = _CODING_AGENT_CATEGORY_POOL
        elif any(kw in domain_lower for kw in ("sql", "database", "data engineer", "dba")):
            category_pool = _CODING_SQL_CATEGORY_POOL
        elif any(kw in domain_lower for kw in ("frontend", "front-end", "react", "javascript", "ui developer", "web developer")):
            category_pool = _CODING_FRONTEND_CATEGORY_POOL
        else:
            category_pool = _CODING_CATEGORY_POOL
        scenario_pool = _CODING_AGENT_SCENARIO_POOL if is_agent_domain else _CODING_SCENARIO_POOL
        # Rotate deterministically by how many questions this session has already
        # asked, instead of a plain random.choice - two coding turns back-to-back
        # in the same session (the round is a consecutive block at the end of the
        # interview) were landing on the same hint often enough to produce
        # near-identical problems, since domain_context alone rarely differs
        # between them. But turn_index alone starts every fresh interview at 0,
        # so two different interviews scheduled against the same JD landed on the
        # exact same category+scenario for their first coding question (and every
        # one after, since both walk the same pool from the same start). Offset
        # the starting point by a per-interview seed so that no longer collides.
        turn_index = len(previous_question_texts)
        cat_offset = random.Random(f"{session_id or ''}|cat").randrange(len(category_pool))
        scen_offset = random.Random(f"{session_id or ''}|scen").randrange(len(scenario_pool))
        category_hint = category_pool[(turn_index + cat_offset) % len(category_pool)]
        scenario_hint = scenario_pool[(turn_index + scen_offset) % len(scenario_pool)]
        skill_offset = (
            random.Random(f"{session_id or ''}|skill").randrange(len(skill_rotation_pool))
            if skill_rotation_pool else 0
        )
        target_skill = (
            skill_rotation_pool[(turn_index + skill_offset) % len(skill_rotation_pool)]
            if skill_rotation_pool else ""
        )

        # Check against the SHARED per-JD/domain coding-dedup registry (every
        # candidate on this JD, not just this session), falling back to a
        # local session-only detector when there's no real JD text to key on
        # (e.g. a subject-round coding question). Real OpenAI embeddings, not
        # the default dependency-free hashing embedder: a coding round is a
        # handful of questions per candidate, so the extra embedding calls
        # are cheap, and the hashing embedder's bag-of-words cosine missed
        # cross-language near-duplicates in testing (e.g. the same "dispatch
        # by request-type string, return a status string" agent problem
        # restated in Python then JavaScript scored well below the semantic
        # threshold despite being the same problem). Wrapped in
        # CachingEmbedder so re-seeding never re-fetches an unchanged
        # question's embedding from the API.
        coding_jd_key = _jd_dedup_key(f"coding:{domain_context}", jd_details) if (jd_details or "").strip() else None
        detector = None
        if coding_jd_key is None:
            embedder = None
            if _OpenAIEmbedder is not None and self.openai_service is not None:
                embedder = _OpenAIEmbedder(self.openai_service)
                if _CachingEmbedder is not None:
                    embedder = _CachingEmbedder(embedder)
            detector = _NearDuplicateDetector(embedder) if _NearDuplicateDetector is not None else None
            if detector is not None:
                for q in previous_question_texts:
                    detector.add(q)

        def _check_coding_candidate(question_text: str):
            if coding_jd_key is not None:
                return _register_or_reject_shared(coding_jd_key, question_text, self.openai_service)
            if detector is not None:
                h = detector.check(question_text)
                if not h.is_duplicate:
                    detector.add(question_text, h.vec)
                return h
            return None

        # A fully-colliding turn used to always run every regular regen (up to
        # 4 LLM calls) PLUS the forced-diversification call below (a 5th) -
        # at ~5s/call under concurrent load that is exactly the ~25-27s spikes
        # seen in load testing. Budget the wall clock instead of always
        # exhausting every attempt: same "stop retrying once this long is
        # spent" pattern already proven in the adaptive engine's own regen
        # loop (interview_engine/engine.py's regen_budget_ms).
        import time as _time
        _loop_start = _time.perf_counter()
        # Must stay comfortably above a single call's OWN latency under real
        # concurrent load (observed ~8s/call with 10 candidates sharing one
        # JD), or the budget triggers before even ONE regen can run - which
        # is what silently reopened within-session coding duplicates the
        # first time this was set to 10000: nearly every turn's first
        # attempt alone already ate the whole budget, so a collision just
        # got shipped instead of retried.
        _REGEN_BUDGET_MS = 18000

        max_regens = 3
        result: CodingQuestionResult | None = None
        force_diversify_notice = ""
        hit = None
        for attempt in range(max_regens + 1):
            if attempt > 0 and (_time.perf_counter() - _loop_start) * 1000 > _REGEN_BUDGET_MS:
                logger.info(
                    "[CODING] regen budget %dms hit after %d regen(s) - accepting last candidate "
                    "instead of exhausting all %d attempts",
                    _REGEN_BUDGET_MS, attempt, max_regens,
                )
                return result
            result = self.openai_service.generate_structured(
                "coding_question",
                {
                    "domain_context": domain_context,
                    "jd_details": jd_details or "",
                    "difficulty": difficulty,
                    "previous_questions": previous_questions or "(none yet)",
                    "category_hint": category_hint,
                    "scenario_hint": scenario_hint,
                    "target_skill": target_skill or "(no unresolved JD skill - use your judgement)",
                    "force_diversify_notice": force_diversify_notice,
                },
                CodingQuestionResult,
            )
            hit = _check_coding_candidate(result.question)
            if hit is None or not hit.is_duplicate:
                return result
            logger.info(
                "[CODING] regen %d: candidate collided with a prior coding question (%s sim=%.2f)",
                attempt + 1, hit.kind, hit.score,
            )
            # Move to the next category/scenario/skill hint so the regenerated
            # candidate isn't drawn from the same starting point that just
            # produced a near-duplicate.
            category_hint = category_pool[(turn_index + cat_offset + attempt + 1) % len(category_pool)]
            scenario_hint = scenario_pool[(turn_index + scen_offset + attempt + 1) % len(scenario_pool)]
            if skill_rotation_pool:
                target_skill = skill_rotation_pool[(turn_index + skill_offset + attempt + 1) % len(skill_rotation_pool)]

        # Regular loop finished all 4 attempts still colliding, without
        # hitting the budget - the forced-diversification call below is a
        # 5th call, so only attempt it if there's still real budget left,
        # otherwise ship the last (still-colliding, but not worth another
        # 5-6s for) candidate now.
        if (_time.perf_counter() - _loop_start) * 1000 > _REGEN_BUDGET_MS:
            logger.info("[CODING] regen budget exhausted after all regular attempts - skipping forced-diversification call")
            return result

        # Exhausted every regular regen and every one still collided (the
        # model's own bias for this domain/session was stronger than rotating
        # hints within the SAME domain-specific pool - e.g. every agent-domain
        # hint still reads as "some kind of tool-calling/orchestration
        # problem" to the model). One last forced-diversification attempt:
        # jump to the generic, domain-agnostic pool (pure DSA-style
        # categories share nothing structurally with the agent-specific one)
        # and explicitly name what to avoid, instead of quietly shipping a
        # candidate we already know collided.
        logger.info(
            "[CODING] regular regen budget exhausted, still colliding (%s sim=%.2f) - forcing a "
            "domain-agnostic category as a last resort",
            hit.kind if hit else "?", hit.score if hit else 0.0,
        )
        forced_category = _CODING_CATEGORY_POOL[(turn_index + cat_offset + max_regens + 5) % len(_CODING_CATEGORY_POOL)]
        forced_scenario = _CODING_SCENARIO_POOL[(turn_index + scen_offset + max_regens + 5) % len(_CODING_SCENARIO_POOL)]
        force_diversify_notice = (
            f'CRITICAL: every previous attempt for this turn collided with an already-asked '
            f'question ("{(hit.matched or "")[:100]}" among others). Whatever general shape that '
            f'was (e.g. a tool-calling/retry/orchestration/dispatch-by-type problem), do NOT write '
            f'anything in that shape again. Solve a self-contained "{forced_category}" problem '
            f'instead, wrapped in "{forced_scenario}" if it fits, or a generic version if it does not.'
        )
        result = self.openai_service.generate_structured(
            "coding_question",
            {
                "domain_context": domain_context,
                "jd_details": jd_details or "",
                "difficulty": difficulty,
                "previous_questions": previous_questions or "(none yet)",
                "category_hint": forced_category,
                "scenario_hint": forced_scenario,
                "target_skill": target_skill or "(no unresolved JD skill - use your judgement)",
                "force_diversify_notice": force_diversify_notice,
            },
            CodingQuestionResult,
        )
        final_hit = _check_coding_candidate(result.question)
        if final_hit is not None and final_hit.is_duplicate:
            logger.warning(
                "[CODING] forced-diversification attempt STILL collided (%s sim=%.2f) - shipping "
                "it anyway, cannot retry indefinitely",
                final_hit.kind, final_hit.score,
            )
        return result

    def evaluate_code_answer(self, question: str, code: str, difficulty: str) -> CodeEvaluationResult:
        """Grade a code submission by having the LLM read it - logic and
        structure only, the code is never executed. See evaluate_code.txt for
        the explicit no-execution instruction."""
        if not (code or "").strip():
            # A blank submission has nothing to grade. Previously this still
            # went to the LLM as the literal string "(no code submitted)" -
            # evaluate_code.txt has no rule telling it to zero this out, and
            # its own few-shot JSON example anchors every score field at a
            # plausible-looking 60-90, which the model tended to echo instead
            # of reasoning "there is no code here, so this is a 0." Score it
            # deterministically instead of leaving that to chance.
            return self._empty_code_submission_result(question, difficulty)
        if self.openai_service is None:
            raise RuntimeError("OpenAI service is not configured; set OPENAI_API_KEY")
        result = self.openai_service.generate_structured(
            "evaluate_code",
            {
                "question": question,
                "code": code,
                "difficulty": difficulty or "Medium",
            },
            CodeEvaluationResult,
        )
        # The report must always show an Optimal Solution for a coding question.
        # The grader supplies one in the normal case, but occasionally omits the
        # field; backfill it from the question so the report never renders a
        # coding answer without a reference solution.
        return self._ensure_optimal_solution(result, question, difficulty)

    def _optimal_solution_for(self, question: str, difficulty: str, language: str | None = None) -> dict[str, str]:
        """Generate a reference optimal solution for a coding problem on its own,
        independent of any candidate submission. This is what lets the report
        always show an Optimal Solution — including blank submissions and the
        rare case where the grader drops the field. Returns {} on any failure,
        which simply leaves the section hidden exactly as it was before."""
        if self.openai_service is None or not (question or "").strip():
            return {}
        lang = (language or "").strip()
        lang = "" if lang.lower() in ("", "none") else lang
        preferred = lang or "Python"
        try:
            raw = self.openai_service.generate_completion(
                system_instruction=(
                    "You are an expert coding interviewer. Given a coding problem, return the "
                    "single OPTIMAL reference solution. Respond as JSON with exactly these keys: "
                    '"solution" (complete, runnable, idiomatic code as a plain string — no markdown '
                    'fences, no commentary), "language" (the language you wrote it in), '
                    '"time_complexity" and "space_complexity" (Big-O notation only, e.g. "O(n)"). '
                    f"Prefer {preferred} unless the problem itself dictates another language "
                    "(e.g. SQL for a query problem)."
                ),
                user_prompt=f"TARGET DIFFICULTY: {difficulty or 'Medium'}\n\nPROBLEM:\n{question}",
                response_format={"type": "json_object"},
            )
            data = json.loads(raw) if raw else {}
        except Exception:
            logger.warning("optimal-solution backfill failed", exc_info=True)
            return {}
        solution = str(data.get("solution") or "").strip()
        if not solution:
            return {}
        return {
            "solution": solution,
            "language": str(data.get("language") or preferred).strip(),
            "time_complexity": str(data.get("time_complexity") or "").strip(),
            "space_complexity": str(data.get("space_complexity") or "").strip(),
        }

    def _ensure_optimal_solution(self, result: CodeEvaluationResult, question: str, difficulty: str) -> CodeEvaluationResult:
        """Guarantee result.detailed_feedback carries an optimal solution. No-op
        when the grader already supplied one."""
        df = result.detailed_feedback
        if df is None or (df.optimal_solution or "").strip():
            return result
        opt = self._optimal_solution_for(question, difficulty, language=df.language)
        if not opt:
            return result
        df.optimal_solution = opt["solution"]
        if opt.get("time_complexity") and not (df.optimal_time_complexity or "").strip():
            df.optimal_time_complexity = opt["time_complexity"]
        if opt.get("space_complexity") and not (df.optimal_space_complexity or "").strip():
            df.optimal_space_complexity = opt["space_complexity"]
        # A blank submission has no candidate language; label the reference block
        # with the solution's own language so it renders and highlights correctly.
        if (df.language or "").strip().lower() in ("", "none") and opt.get("language"):
            df.language = opt["language"]
        return result

    def _empty_code_submission_result(self, question: str, difficulty: str) -> CodeEvaluationResult:
        zero_param = lambda reason: CodingScoringParameter(score=0, reason=reason, confidence="High")
        no_code_reason = "No code was submitted for this question."
        result = CodeEvaluationResult(
            overall_score=0,
            correctness_score=0,
            structure_score=0,
            pros="",
            cons="No code was submitted, so there is nothing to evaluate.",
            expected_approach="",
            detailed_feedback=CodingEvaluationFeedback(
                overall_summary="The candidate did not submit any code for this question.",
                interview_readiness="No submission was made, so readiness cannot be assessed from this question.",
                difficulty_assessment=f"No attempt was made at this {difficulty or 'Medium'}-difficulty problem.",
                final_verdict="Not Ready",
                language="None",
                strengths=[],
                areas_of_improvement=[
                    "Issue: No code was submitted -> Reason: An empty submission cannot demonstrate "
                    "problem-solving or coding ability -> How to improve: Attempt the problem even "
                    "partially, in pseudocode if needed -> Recommended Practice: Practice writing "
                    "at least a rough outline of an approach under time pressure."
                ],
            ),
            scoring_parameters=CodingScoringParameters(
                problem_understanding=zero_param(no_code_reason),
                logic=zero_param(no_code_reason),
                algorithm=zero_param(no_code_reason),
                optimization=zero_param(no_code_reason),
                code_structure=zero_param(no_code_reason),
                readability=zero_param(no_code_reason),
                maintainability=zero_param(no_code_reason),
                edge_cases=zero_param(no_code_reason),
                complexity=zero_param(no_code_reason),
                debugging=zero_param(no_code_reason),
                interview_readiness=zero_param(no_code_reason),
                overall_coding_ability=zero_param(no_code_reason),
            ),
        )
        # Nothing was graded, but the report should still show the reference
        # solution for this problem — backfill it from the question alone.
        return self._ensure_optimal_solution(result, question, difficulty)

    def _generate_from_context_deduped(
        self,
        interview_type: str,
        context_dict: dict[str, Any],
        conversation_history: list[dict[str, Any]] | list[Any] | None,
        max_regens: int = 2,
        **kwargs,
    ) -> QuestionGenerationResult:
        """question_agent.generate_from_context, with a near-duplicate
        check-and-regenerate loop.

        Testing a real 20-question JD interview surfaced the prompt's
        MANDATORY-skill directive (a different JD skill assigned turn by
        turn) being followed correctly for the first several turns, then
        silently ignored for the rest of the interview: the model locked
        onto whichever topic had accumulated the most text in the
        "previously asked questions" block a couple of turns back and kept
        re-asking variations of it regardless of what the directive said
        each subsequent turn. A textual instruction alone was not reliable
        enough, so this rejects a colliding candidate and regenerates with
        an explicit notice naming what it collided with.

        When a JD is present, this checks against the SHARED per-JD registry
        (every candidate on this JD, not just this session) instead of a
        fresh per-request detector seeded only from conversation_history -
        load-testing 10 concurrent candidates on one JD found 0 within-session
        duplicates but ~3.5% cross-session ones, since each session's skill
        rotation only offsets where it starts in the same shared pool. Falls
        back to a local, session-only detector for interview types with no
        meaningful JD text (subject/written/hr/svar/system_design)."""
        jd_text = context_dict.get("jd_details") or context_dict.get("jd") or ""
        role = context_dict.get("role") or context_dict.get("job_title") or ""
        jd_key = _jd_dedup_key(role, jd_text) if jd_text.strip() else None

        # Mirrors question_generator.py's own resume_focus_directive condition
        # exactly, so this only forces a retry on the turn that was actually
        # designated resume-grounded - never on the other 4-in-5 turns, which
        # are deliberately instructed to stay resume-free.
        resume_text_val = (context_dict.get("resume_text") or "").strip()
        resume_q_number = len(context_dict.get("recent_questions") or []) + 1
        is_resume_turn = (
            interview_type == "company" and bool(resume_text_val) and resume_q_number % 5 == 0
        )

        import time as _time
        _seed_start = _time.perf_counter()
        local_detector = None
        if jd_key is None and _NearDuplicateDetector is not None:
            prior_texts = [
                h.get("question", "") for h in (conversation_history or [])
                if isinstance(h, dict) and h.get("question")
            ]
            embedder = None
            if _OpenAIEmbedder is not None and self.openai_service is not None:
                embedder = _OpenAIEmbedder(self.openai_service)
                if _CachingEmbedder is not None:
                    embedder = _CachingEmbedder(embedder)
            local_detector = _NearDuplicateDetector(embedder)
            if interview_type == "hr":
                from interview_agents.agents.question_generator import _strip_hr_ack_prefix
                prior_texts = [_strip_hr_ack_prefix(q) for q in prior_texts]
            for q in prior_texts:
                local_detector.add(q)
            _seed_ms = (_time.perf_counter() - _seed_start) * 1000
            if _seed_ms > 200:
                logger.info(
                    "[LATENCY] dedup-detector seeding: %d prior question(s), %.0fms (interview_type=%s)",
                    len(prior_texts), _seed_ms, interview_type,
                )

        _loop_start = _time.perf_counter()
        _REGEN_BUDGET_MS = 14000  # same rationale as generate_coding_question's budget

        result = None
        working_context = dict(context_dict)
        for attempt in range(max_regens + 1):
            if attempt > 0 and (_time.perf_counter() - _loop_start) * 1000 > _REGEN_BUDGET_MS:
                logger.info(
                    "[QA-DEDUP] regen budget %dms hit after %d regen(s) - accepting last candidate",
                    _REGEN_BUDGET_MS, attempt,
                )
                return result
            _gen_start = _time.perf_counter()
            result = self.question_agent.generate_from_context(interview_type, working_context, **kwargs)
            _gen_ms = (_time.perf_counter() - _gen_start) * 1000
            logger.info("[LATENCY] generate_from_context attempt=%d: %.0fms (interview_type=%s)", attempt + 1, _gen_ms, interview_type)
            _check_start = _time.perf_counter()
            # HR responses now open with a short recruiter acknowledgement
            # ("Got it, ...", "I see, ...") that the structural dedup check would
            # otherwise weigh heavily, since those openers share the same function
            # words across turns almost by construction. Compare on the substantive
            # part of the question only; the candidate still sees the full text.
            dedup_text = result.question
            if interview_type == "hr":
                from interview_agents.agents.question_generator import _strip_hr_ack_prefix
                dedup_text = _strip_hr_ack_prefix(result.question)
            if jd_key is not None:
                hit = _register_or_reject_shared(jd_key, dedup_text, self.openai_service)
            elif local_detector is not None:
                hit = local_detector.check(dedup_text)
                if not hit.is_duplicate:
                    local_detector.add(dedup_text, hit.vec)
            else:
                hit = None
            _check_ms = (_time.perf_counter() - _check_start) * 1000
            if _check_ms > 100:
                logger.info("[LATENCY] dedup check(): %.0fms (interview_type=%s)", _check_ms, interview_type)
            if hit is not None and hit.is_duplicate:
                logger.info(
                    "[QA-DEDUP] regen %d: %s candidate collided (%s sim=%.2f) with %r",
                    attempt + 1, interview_type, hit.kind, hit.score, (hit.matched or "")[:80],
                )
                working_context["regen_notice"] = (
                    f'Your previous attempt for this turn was rejected as a near-duplicate of a '
                    f'recently asked question ("{(hit.matched or "")[:100]}"). Choose a different '
                    f'JD skill entirely and take a genuinely different angle - do not just reword it.'
                )
                continue
            if is_resume_turn and not _resume_referenced(result.question, resume_text_val):
                logger.info(
                    "[QA-RESUME] regen %d: designated resume turn produced no resume "
                    "reference - forcing a stronger retry",
                    attempt + 1,
                )
                working_context["regen_notice"] = (
                    'Your previous attempt for this turn did NOT reference the CANDIDATE RESUME '
                    'at all, even though this turn is specifically designated for resume '
                    'grounding. Regenerate it: name an actual project, technology, or employer '
                    'from the resume explicitly in the question text (e.g. "In your work on '
                    '[resume project/employer], ...") - a generic JD-only question is not '
                    'acceptable for this turn.'
                )
                continue
            return result
        return result

    def _generate_psychometric_question(self, session_id: str, kwargs: dict[str, Any]) -> QuestionGenerationResult:
        """Wraps PsychometricAgent's rich PsychometricQuestionResult into the
        shared QuestionGenerationResult envelope so it flows through the same
        storage/response pipeline every other interview type uses, carrying
        its extra structured payload in the envelope's psychometric_* fields
        (see store_generated_question, which side-car tags them by question
        id, and interview_routes.py, which surfaces them into the API
        response's metadata for the frontend to render option controls)."""
        result = self.psychometric_agent.generate_question(
            session_id,
            bank_question=kwargs.get("bank_question"),
            pillar=kwargs.get("pillar"),
            response_type=kwargs.get("response_type"),
            question_number=kwargs.get("next_question_no") or kwargs.get("question_number"),
            conversation_history=kwargs.get("conversation_history"),
            candidate_name=kwargs.get("candidate_name"),
            seed=kwargs.get("seed"),
        )
        return QuestionGenerationResult(
            question=result.question,
            category=QuestionCategory.PSYCHOMETRIC,
            difficulty=DifficultyLevel.MEDIUM,
            rationale=result.rationale,
            source=result.source,
            psychometric_pillar=result.pillar.value,
            psychometric_response_type=result.response_type.value,
            psychometric_options=[opt.model_dump() for opt in result.options],
            psychometric_scenario_context=result.scenario_context,
        )

    def generate_rag_question(self, session_id: str, interview_type: str, subject: Optional[str] = None, **kwargs) -> QuestionGenerationResult:
        # Psychometric never has a vector store to retrieve from — its
        # ephemeral per-batch admin bank is looked up by the Node backend and
        # passed in as `bank_question`, not retrieved here — and it works
        # whether or not a session exists (see PsychometricAgent, which
        # degrades gracefully without one). Dispatched before any RAG/session
        # branching below, unlike every other type, because unlike them it
        # never needs either.
        if interview_type == "psychometric":
            return self._generate_psychometric_question(session_id, kwargs)

        # HR never benefits from vector retrieval (there's no HR question bank to
        # retrieve from the way subject/company have JD/technical ones), and the
        # RAG-enabled fallback path builds its context dict under a different key
        # ("resume" instead of "resume_text") than generate_from_context reads,
        # which silently dropped resume grounding for every HR question. Route HR
        # straight to the same specialized-agent/context-dict path used when RAG
        # is disabled, regardless of the global rag_enabled setting.
        if not self.rag_enabled or interview_type == "hr":
            # Visibility: a RAG-selecting interview (i.e. NOT hr, which is
            # intentionally non-RAG) reaching this branch means retrieval was
            # skipped. Surface it with the reason. The routing/fallback below is
            # unchanged — the interview still runs on the LLM/specialized path.
            if not self.rag_enabled and interview_type != "hr":
                logger.warning(
                    "RAG FALLBACK: interview_type=%s session=%s produced a question WITHOUT "
                    "retrieval (reason: %s) — served from the LLM/specialized-agent path.",
                    interview_type, session_id or "stateless",
                    self.rag_disabled_reason or "RAG_ENABLED=false",
                )
            _trace(f"RAG disabled — routing {interview_type} to specialized agent")
            is_stateless = not session_id or session_id.startswith("temp-") or not self._session_exists(session_id)
            if not is_stateless:
                session = self.memory.get_session(session_id)
                if interview_type == "subject":
                    return self.subject_agent.generate_question(
                        session_id, subject=subject or session.subject,
                        web_search_enabled=kwargs.get("web_search_enabled"),
                    )
                if interview_type == "verbal":
                    return self.verbal_agent.generate_question(
                        session_id, web_search_enabled=kwargs.get("web_search_enabled")
                    )
                if interview_type == "written":
                    return self.written_agent.generate_question(session_id, subject=subject or session.subject)
                if interview_type == "company":
                    return self.company_agent.generate_question(
                        session_id,
                        company=session.company,
                        job_title=session.job_title,
                        jd_details=session.jd_details,
                        web_search_enabled=kwargs.get("web_search_enabled"),
                    )
                if interview_type == "hr":
                    return self.hr_agent.generate_question(
                        session_id,
                        # Optional grounding context forwarded from the Node.js request.
                        # Falls back to session fields (set at GLAMIS start-interview time)
                        # if the stateless payload doesn't carry them.
                        company=kwargs.get("company") or getattr(session, "company", None),
                        position=kwargs.get("position") or getattr(session, "job_title", None),
                        jd_details=kwargs.get("job_description") or getattr(session, "jd_details", None),
                        resume_text=kwargs.get("resume_text") or "",
                    )
                if interview_type == "svar":
                    return self.svar_agent.generate_question(session_id, svar_type=session.svar_type or "reading")
                if interview_type == "system_design":
                    return self.system_design_agent.generate_question(session_id)
            # Stateless or unknown type — use context-dict path (no DB session required)
            context_dict = {
                "candidate_name": kwargs.get("candidate_name") or "Candidate",
                # HR's stateless route only ever sends "position" (never "role"/"job_title"),
                # so without this fallback every HR candidate's Role context silently
                # defaulted to "Software Engineer" regardless of the admin-configured position.
                "role": kwargs.get("role") or kwargs.get("job_title") or kwargs.get("position") or "Software Engineer",
                "experience": kwargs.get("experience") or "0-2 years",
                "skills": kwargs.get("skills") or [],
                "difficulty": kwargs.get("difficulty") or "Medium",
                "subject": subject or kwargs.get("subject") or "",
                "company": kwargs.get("company") or kwargs.get("selected_company") or "",
                "job_title": kwargs.get("job_title") or "",
                "position": kwargs.get("position") or kwargs.get("job_title") or "",
                "jd_details": kwargs.get("jd_details") or "",
                "job_description": kwargs.get("job_description") or kwargs.get("jd_details") or "",
                "svar_type": kwargs.get("svar_type") or "",
                "resume_text": kwargs.get("resume_text") or "",
                "answer": kwargs.get("answer") or "",
                "recent_questions": [
                    m.get("question") if "question" in m else m.get("content", "")
                    for m in (kwargs.get("conversation_history") or [])
                    if m.get("question") or m.get("content")
                ],
                # Raw turn-by-turn history (question/answer/score) - HR's adaptive
                # follow-up logic reads the last turn's score+answer straight from
                # here (already present, no new query); other types simply ignore it.
                "conversation_history": kwargs.get("conversation_history") or [],
                # Needed by _build_jd_payload's JD-skill coverage guarantee: without
                # knowing how many turns are left, it can't tell whether it's still
                # safe to leave coverage to advisory steering or must force this turn.
                "next_question_no": kwargs.get("next_question_no"),
                "total_questions": kwargs.get("total_questions"),
            }
            return self._generate_from_context_deduped(
                interview_type, context_dict, kwargs.get("conversation_history"),
                subject=subject,
                web_search_enabled=kwargs.get("web_search_enabled"),
                session_id=session_id,
                source=kwargs.get("source"),
                jd_details=context_dict.get("jd_details") or kwargs.get("jd_details") or "",
            )


        # RAG is enabled — assert all required pipeline components are initialized
        assert self.retriever is not None, "RAG retriever not initialized when rag_enabled=True"
        assert self.question_selector is not None, "Question selector not initialized when rag_enabled=True"
        assert self.context_manager is not None, "Context manager not initialized when rag_enabled=True"
        assert self.llm_adapter is not None, "LLM adapter not initialized when rag_enabled=True"
        is_stateless = not session_id or session_id.startswith("temp-") or not self._session_exists(session_id)
        conversation_history = kwargs.get("conversation_history") or []
        
        # Read QB parameters from kwargs or session
        question_bank_id = kwargs.get("question_bank_id")
        question_bank_ratio = float(kwargs.get("question_bank_ratio") or 0.0)
        interview_mode = kwargs.get("interview_mode") or "default"
        
        session: Any = None
        if not is_stateless:
            session = self.memory.get_session(session_id)
            if not question_bank_id:
                question_bank_id = getattr(session, "question_bank_id", None)
            if not question_bank_ratio:
                # getattr's default only applies when the attribute is missing -
                # every session has this column but it defaults to None (never
                # explicitly set), so getattr returns None here and float(None)
                # raised TypeError, crashing every avatar question turn once RAG
                # was actually enabled (this path was previously unreachable).
                question_bank_ratio = float(getattr(session, "question_bank_ratio", 0.0) or 0.0)
            if interview_mode == "default":
                interview_mode = getattr(session, "interview_mode", "default")
                
        # Determine next question turn number (1-based index)
        asked_count = sum(1 for m in conversation_history if m.get("question") or (m.get("role") == "assistant" and m.get("content")))
        next_question_no = asked_count + 1
        
        # Determine total questions to space out sources
        total_questions = len(conversation_history) + 5
        if not is_stateless and hasattr(session, "total_questions") and session.total_questions:
            total_questions = session.total_questions
            
        # Determine turn source using the deterministic QuestionSourceRouter
        # Use the module-level shim; fall back to "llm" if the router is unavailable.
        _Router = _QuestionSourceRouter
        if _Router is None:
            try:
                from interview_agents.services.question_source_router import QuestionSourceRouter as _Router  # type: ignore[assignment]
            except Exception:
                _Router = None
        if _Router is not None:
            source = _Router.determine_source(
                turn_no=next_question_no,
                total_questions=total_questions,
                interview_mode=interview_mode,
                question_bank_id=question_bank_id,
                interview_type=interview_type,
                session_id=session_id if not is_stateless else None,
            )
        else:
            source = "llm"
        _trace(f"Source Router: Turn {next_question_no} -> allocated source={source} (QB_ID={question_bank_id})")

        # Keep a snapshot of the router-assigned source so behavioural-turn
        # detection below is not fooled by the "llm" fallback reassignment.
        _original_source = source

        # Dynamically set web search override — "behavioral" source also uses LLM (no web).
        # AND respect the session-level opt-out: never force web on when the user/admin
        # disabled it, otherwise the router's ~15-25% web allocation triggers billable
        # Tavily calls the user opted out of.
        kwargs["web_search_enabled"] = (source == "web") and bool(kwargs.get("web_search_enabled"))
        kwargs["source"] = source  # propagated into generate_from_context for category routing

        if is_stateless:
            role = kwargs.get("role") or kwargs.get("job_title") or "Software Engineer"
            company = kwargs.get("company") or kwargs.get("selected_company") or "Generic"
            difficulty = kwargs.get("difficulty") or "Medium"
            skills = kwargs.get("skills") or []
            experience = kwargs.get("experience") or ""
            jd = kwargs.get("jd_details") or kwargs.get("jd") or ""
            resume = kwargs.get("resume_text") or kwargs.get("resume") or ""
            
            recent_questions = []
            if conversation_history:
                recent_questions = [
                    msg.get("question") if "question" in msg else msg.get("content", "")
                    for msg in conversation_history
                    if msg.get("question") or msg.get("content")
                ]
                
            # Extract JD skill graph for this session
            try:
                jd_skills_list = _extract_jd_skills_llm(jd, role, self.openai_service)
            except Exception:
                jd_skills_list = []

            retrieval_context = {
                "session_id": session_id or "temp-session",
                "role": role,
                "company": company,
                "subject": subject or "",
                "difficulty": difficulty,
                "interview_type": interview_type,
                "weak_skills": [],
                "strong_skills": [],
                "recent_questions": recent_questions,
                "recent_answers": [],
                "question_number": next_question_no,
                # _build_jd_payload (question_generator.py) reads "next_question_no"
                # and "total_questions", not "question_number" - without these two
                # keys it always fell back to len(recent_questions)+1, which is
                # usually equal but made the "authoritative" turn number silently
                # never reach the skill-rotation directive.
                "next_question_no": next_question_no,
                "total_questions": total_questions,
                "jd": jd,
                "jd_details": jd,
                "jd_skills": jd_skills_list,
                # Both keys point at the same text: the RAG retriever/query
                # builder reads "resume" (query_builder.py, retrieval_strategy.py)
                # while generate_from_context reads "resume_text" - the same
                # mismatch already fixed for HR, which was silently dropping
                # resume grounding for every non-HR RAG-fallback question too
                # (company included) since only "resume" was ever set here.
                "resume": resume,
                "resume_text": resume,
                "skills": skills,
                "experience": experience,
                "question_bank_id": question_bank_id if source == "qb" else None
            }
            target_diff = difficulty
        else:
            session = self.memory.get_session(session_id)
            context = self.memory.get_recent_context(session_id)
            weak_areas = self.memory.get_weak_areas(session_id)
            strong_areas = self.memory.get_strong_areas(session_id)
            
            role = kwargs.get("role") or session.role
            company = kwargs.get("company") or session.company or "Generic"
            jd = kwargs.get("jd_details") or session.jd_details or ""
            resume = kwargs.get("resume_text") or ""
            skills = kwargs.get("skills") or session.skills_json or []
            experience = kwargs.get("experience") or session.experience or ""

            # Extract JD skill graph for this session
            try:
                jd_skills_list = _extract_jd_skills_llm(jd, role, self.openai_service)
            except Exception:
                jd_skills_list = []

            # Build covered_topics list from RAG history so ChromaDB targets uncovered topics
            covered_topics_list = []
            try:
                rag_hist = self.memory.get_rag_history(session_id)
                for turn in rag_hist:
                    exp = turn.get("expected_answer") or turn.get("knowledge_asset") or ""
                    if exp:
                        covered_topics_list.append(exp[:60])
            except Exception:
                pass

            retrieval_context = {
                "session_id": session_id,
                "role": role,
                "company": company,
                "subject": subject or session.subject or "",
                "difficulty": session.difficulty or "Medium",
                "interview_type": interview_type,
                "weak_skills": list(weak_areas.keys()),
                "strong_skills": list(strong_areas.keys()),
                "recent_questions": context.get("recent_questions", []),
                "recent_answers": context.get("recent_answers", []),
                "question_number": next_question_no,
                # See the matching comment in the is_stateless branch above.
                "next_question_no": next_question_no,
                "total_questions": total_questions,
                "jd": jd,
                "jd_details": jd,
                "jd_skills": jd_skills_list,
                "covered_topics": covered_topics_list,
                # See the matching comment in the is_stateless branch above -
                # both keys must be set for the same reason.
                "resume": resume,
                "resume_text": resume,
                "skills": skills,
                "experience": experience,
                "question_bank_id": question_bank_id if source == "qb" else None
            }
            target_diff = session.difficulty or "Medium"

        ret_res = {}
        selected = None
        selector_res = {}
        question_source = "RETRIEVED"
        is_retrieved = True
        is_generated = False

        if source == "qb" and self.qb_service:
            history_dicts = []
            if conversation_history:
                history_dicts.extend(conversation_history)
            if not is_stateless:
                try:
                    db_questions = self.memory.get_recent_questions(session_id, limit=100)
                    for q in db_questions:
                        history_dicts.append({
                            "question": getattr(q, "question", ""),
                            "chunk_id": getattr(q, "chunk_id", "")
                        })
                    rag_history = self.memory.get_rag_history(session_id)
                    for turn in rag_history:
                        history_dicts.append({
                            "question": turn.get("question") or turn.get("expected_answer") or "",
                            "chunk_id": turn.get("chunk_id") or turn.get("retrieval_id") or ""
                        })
                except Exception as db_exc:
                    logger.warning(f"Failed to load recent questions from db for QB duplicate checking: {db_exc}")

            # Unlike the non-qb retrieval branch below, this call was never
            # wrapped in a try/except - a transient failure inside it (e.g. an
            # embedding cache miss, which is expected/recoverable and already
            # handled gracefully everywhere else) propagated all the way up
            # and crashed the whole request with a 500 instead of falling
            # through to fallback question generation like every other
            # retrieval failure does.
            try:
                qb_res = self.qb_service.retrieve_exact_question(
                    retriever=self.retriever,
                    context=retrieval_context,
                    conversation_history=history_dicts
                )
            except Exception as e:
                logger.warning(f"Question bank retrieval failed, using fallback: {e}")
                qb_res = None
            if qb_res:
                selected_question_text = qb_res["question"]
                question_source = "QB"
                is_retrieved = True
                is_generated = False
                selected = {
                    "id": qb_res["chunk_id"],
                    "document": qb_res["expected_answer"],
                    "score": qb_res["similarity"],
                    "metadata": qb_res["metadata"]
                }
                selector_res = {
                    "selected_question": selected,
                    "selection_reason": "Exact Question Bank retrieval without LLM rewrite",
                    "selection_confidence": qb_res["similarity"]
                }
            else:
                selected = None

        if source != "qb":
            candidates = []
            # self.retriever.retrieve() embeds the query via a live OpenAI call
            # before it ever touches ChromaDB - on an empty knowledge-base
            # collection that embed is guaranteed wasted work (there is
            # nothing to match against), and it ran on every single non-qb
            # turn regardless. collection count is a local ChromaDB call (no
            # API round trip), so checking it fresh here to skip the embed
            # entirely costs nothing and can't go stale the way a cached
            # flag would once a QB gets uploaded mid-process.
            _kb_has_content = True
            try:
                _kb_has_content = bool(self.retriever.retrieval_service.collection_stats().get("total_items"))
            except Exception:
                pass  # unknown state - fall through and let retrieve() itself fail safe
            if _kb_has_content:
                try:
                    ret_res = self.retriever.retrieve(retrieval_context, limit=5)
                    candidates = ret_res.get("candidates") or []
                    target_diff = ret_res.get("target_difficulty") or target_diff
                except Exception as e:
                    logger.warning(f"RAG retrieval failed, using fallback: {e}")
                    candidates = []
            else:
                _trace("Knowledge base collection is empty - skipped retrieval embed/query")

            covered_topics = set(self.retriever.session.covered_topics)
            covered_skills = set(self.retriever.session.covered_skills)
            covered_companies = set(self.retriever.session.covered_companies)
            asked_questions = set(self.retriever.session.asked_questions)
            
            if conversation_history:
                for msg in conversation_history:
                    text = msg.get("content") or msg.get("question") or ""
                    if text:
                        q_hash = self.retriever.session.get_hash(text)
                        asked_questions.add(q_hash)
                        self.retriever.session.question_hashes.add(q_hash)
                        
            if not is_stateless:
                try:
                    db_questions = self.memory.get_recent_questions(session_id, limit=100)
                    for q in db_questions:
                        q_text = getattr(q, "question", None)
                        if q_text:
                            q_hash = self.retriever.session.get_hash(q_text)
                            asked_questions.add(q_hash)
                            self.retriever.session.question_hashes.add(q_hash)
                    
                    rag_history = self.memory.get_rag_history(session_id)
                    for turn in rag_history:
                        c_id = turn.get("chunk_id")
                        ret_id = turn.get("retrieval_id")
                        exp_ans = turn.get("expected_answer")
                        if c_id:
                            asked_questions.add(c_id)
                        if ret_id:
                            asked_questions.add(ret_id)
                        if exp_ans:
                            h = self.retriever.session.get_hash(exp_ans)
                            asked_questions.add(h)
                            self.retriever.session.question_hashes.add(h)
                except Exception as db_exc:
                    logger.warning(f"Failed to load past questions from database: {db_exc}")

            selector_res = self.question_selector.select_question(
                candidates=candidates,
                current_difficulty=target_diff,
                covered_topics=covered_topics,
                covered_skills=covered_skills,
                covered_companies=covered_companies,
                asked_questions=asked_questions
            )
            
            selected = selector_res.get("selected_question")

            if selected:
                # ranking_score (hybrid_ranker's composite) is the meaningful quality
                # signal - "score" is the raw vector-store distance converted to
                # 1-distance, which is negative for nearly every real candidate in
                # this store, so `or` (negative numbers are truthy) was always
                # picking it first and treating every retrieval as low-confidence
                # regardless of actual match quality.
                raw_score = selected.get("ranking_score")
                if raw_score is None:
                    raw_score = selected.get("score") or 0
                if raw_score < 0:
                    _trace(f"RAG retrieval confidence low (score={raw_score:.3f}) — treating as fallback")
                    selected = None

            question_source = "RETRIEVED"
            is_retrieved = True
            is_generated = False

        if not selected:
            question_source = "GENERATED"
            is_retrieved = False
            is_generated = True
            source = "llm"
            # NOTE: _original_source still holds the router-assigned source value
            # (e.g. "behavioral") and is used below for behavioural-turn detection
            # instead of `source` which has been overwritten to "llm" here.

            _trace("Retrieval confidence low/no candidates, executing fallback question generation")

            # For all known interview types with a real session, delegate to the specialized agent.
            # This ensures type-specific question logic (topic progression, company context, SVAR
            # sub-types, etc.) is preserved even when RAG retrieval confidence is low.
            generated_question_text = None
            if not is_stateless:
                try:
                    session = self.memory.get_session(session_id)
                    if interview_type == "subject":
                        agent_result = self.subject_agent.generate_question(
                            session_id, subject=subject or session.subject,
                            web_search_enabled=kwargs.get("web_search_enabled"),
                        )
                    elif interview_type == "verbal":
                        agent_result = self.verbal_agent.generate_question(session_id)
                    elif interview_type == "written":
                        agent_result = self.written_agent.generate_question(session_id, subject=subject or session.subject)
                    elif interview_type == "company":
                        agent_result = self.company_agent.generate_question(
                            session_id, company=session.company, job_title=session.job_title, jd_details=session.jd_details,
                            web_search_enabled=kwargs.get("web_search_enabled"),
                        )
                    elif interview_type == "hr":
                        agent_result = self.hr_agent.generate_question(session_id)
                    elif interview_type == "svar":
                        agent_result = self.svar_agent.generate_question(session_id, svar_type=session.svar_type or "reading")
                    elif interview_type == "system_design":
                        agent_result = self.system_design_agent.generate_question(session_id)
                    else:
                        agent_result = None
                    if agent_result:
                        generated_question_text = agent_result.question
                        _trace(f"{interview_type} agent RAG-fallback -> [{agent_result.difficulty.value}] {generated_question_text[:80]}...")
                except Exception:
                    logger.warning("Specialized agent RAG-fallback failed for type=%s, using generic LLM", interview_type, exc_info=True)

            if not generated_question_text:
                # Delegate to the exact same path the RAG-disabled branch above
                # (and every other caller) already uses instead of hand-rolling a
                # second, parallel prompt here. This block used to build its own
                # system_instruction/user_prompt from scratch, duplicating JD
                # grounding, behavioral-cap logic, and web-search grounding that
                # generate_from_context() already does - which is exactly why it
                # needed the Easy-tier fix and the Medium/Hard-tier fix applied to
                # it separately, twice, instead of once in the shared templates.
                agent_result = self._generate_from_context_deduped(
                    interview_type, retrieval_context, conversation_history, subject=subject,
                    web_search_enabled=kwargs.get("web_search_enabled"),
                    session_id=session_id, source=_original_source,
                )
                generated_question_text = agent_result.question
            
            selected = {
                "id": "generated_fallback",
                "document": f"Question: {generated_question_text} Answer: Discuss core concepts.",
                "metadata": {
                    "company": retrieval_context["company"],
                    "role": retrieval_context["role"],
                    "subject": subject or retrieval_context["subject"] or "Technical",
                    "topic": "General",
                    "difficulty": target_diff,
                    "chunk_id": "generated_fallback",
                    "source_file": "LLM Generator"
                }
            }
            selected_question_text = generated_question_text
        else:
            if source == "qb":
                meta = selected.get("metadata") or {}
                original_q = meta.get("original_question")
                if not original_q:
                    doc = selected.get("document") or ""
                    for sep in ("\n\nExpected:", "Expected:", "\n\nAnswer:", "Answer:", "Question:"):
                        if sep in doc:
                            doc = doc.split(sep)[0].strip()
                    original_q = doc.replace("Question:", "").strip()
                selected_question_text = original_q
            else:
                try:
                    rag_context = self.context_manager.build_context(
                        selected,
                        retrieval_context,
                        selector_res.get("selection_reason", "")
                    )
                    selected_question_text = self.llm_adapter.rewrite_question(rag_context)
                except Exception as _rw_exc:
                    logger.warning("RAG rewrite_question failed (%s) — using raw retrieved question", _rw_exc)
                    doc = selected.get("document") or ""
                    selected_question_text = doc.split("Answer:")[0].replace("Question:", "").strip() or doc

        metadata = selected.get("metadata") or {}

        # RAG influence tracking — measure how much retrieved context
        # actually reached the prompt vs. a pure LLM generation fallback.
        _context_text = ret_res.get("context") or ""
        if not isinstance(_context_text, str):
            _context_text = json.dumps(_context_text)
        _context_tokens = len(_context_text.split()) if _context_text else 0
        # Rough prompt token estimate: context + role + difficulty hint (~50 words)
        _prompt_tokens_est = max(_context_tokens + 50, 1)
        _rag_utilization_pct = round(
            (_context_tokens / _prompt_tokens_est) * 100, 1
        ) if is_retrieved and _context_tokens else 0.0

        rag_data = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "retrieval_id": selected.get("id") or metadata.get("chunk_id") or "",
            "chunk_id": metadata.get("chunk_id") or selected.get("id") or "",
            # Store the document field (expected answer / knowledge base content) always.
            # For generated fallbacks the dummy chunk document already contains 'Discuss core concepts'.
            "expected_answer": selected.get("document", ""),
            "evaluation_rubric": metadata.get("evaluation_rubric") or metadata.get("rubric") or "",
            "knowledge_asset": metadata.get("source_file") or metadata.get("asset_id") or "Knowledge Base",
            "retrieval_strategy": interview_type,
            "retrieval_similarity": selected.get("score") or 0.8,
            "selection_confidence": selector_res.get("selection_confidence") or 0.8,
            "selection_reason": selector_res.get("selection_reason") or "Selected best match",
            "difficulty_reason": f"Adaptive scaling target: {target_diff}",
            "question_source": question_source,
            "is_retrieved": is_retrieved,
            "is_generated": is_generated,
            "followup_source": metadata.get("follow_up_suggestions") or "",
            # RAG influence metrics
            "retrieval_tokens_injected": _context_tokens,
            "retrieval_utilization_pct": _rag_utilization_pct,
            "rag_selected": is_retrieved,
            "question": selected_question_text,
            "pdf_name": metadata.get("pdf_name") or metadata.get("source_file") or "",
            "question_bank_id": metadata.get("question_bank_id") or ""
        }
        _trace(
            f"RAG influence: tokens_injected={_context_tokens} "
            f"utilization={_rag_utilization_pct}% "
            f"rag_selected={is_retrieved}"
        )
        try:
            _record_rag_turn(is_retrieved, _rag_utilization_pct)
        except Exception:
            pass
        
        if "Answer:" in rag_data["expected_answer"]:
            try:
                rag_data["expected_answer"] = rag_data["expected_answer"].split("Answer:")[1].strip()
            except Exception:
                pass
                
        if not is_stateless:
            self.memory.log_rag_turn(session_id, rag_data)
            self.retriever.session.register_asked_question(rag_data["chunk_id"], metadata, selected_question_text)
            
        # QuestionGenerationResult and enums are imported at the top of this module
        cat_str = metadata.get("question_type") or "TECHNICAL"
        try:
            category = QuestionCategory(cat_str.lower())
        except Exception:
            category = QuestionCategory.TECHNICAL

        try:
            difficulty_enum = DifficultyLevel((target_diff or "Medium").capitalize())
        except Exception:
            difficulty_enum = DifficultyLevel.MEDIUM

        # Determine final source attribution if selected
        if selected and not is_generated:
            is_qb = selected.get("metadata", {}).get("question_bank_id") is not None
            source = "qb" if is_qb else "web" if kwargs.get("web_search_enabled") else "llm"

        # Explicit parentheses to avoid operator-precedence ambiguity:
        # `X or Y or "" if cond else None` parses as `X or Y or ("" if cond else None)`
        # NOT as `(X or Y or "") if cond else None`.
        _is_qb = source == "qb"
        return QuestionGenerationResult(
            question=selected_question_text,
            category=category,
            difficulty=difficulty_enum,
            rationale=selector_res.get("selection_reason", ""),
            source=source,
            pdf_name=(metadata.get("pdf_name") or metadata.get("source_file") or "") if _is_qb else None,
            chunk_id=(metadata.get("chunk_id") or selected.get("id") or "") if _is_qb else None,
            question_bank_id=metadata.get("question_bank_id") if _is_qb else None,
            similarity=float(selected.get("score") or 0.8) if (_is_qb and selected) else 0.0,
        )

    def generate_rag_followup(self, session_id: str) -> QuestionGenerationResult:
        # HR/behavioral follow-ups need STAR-aware phrasing (a content-specific probe or a
        # STAR-gap question), not the generic RAG/technical question-bank path below, which
        # has no notion of STAR structure and falls back to DSA/OS/TCP-style questions.
        session = self.memory.get_session(session_id)
        interview_type = (getattr(session, "interview_type", None) or "").strip().lower()
        if interview_type == InterviewType.HR.value:
            try:
                latest_q = self.memory.get_latest_question(session_id)
                recent_ans = self.memory.get_recent_answers(session_id, limit=1)
                question_text = latest_q.question if latest_q else ""
                answer_text = recent_ans[0].answer if recent_ans else ""
                evaluation = recent_ans[0].evaluation_json if recent_ans else {}
                hr_result = self.hr_agent.generate_followup(session_id, question_text, answer_text, evaluation)
                if hr_result is not None:
                    return hr_result
            except Exception:
                logger.warning("HRBehavioralAgent.generate_followup failed, falling back to generic follow-up", exc_info=True)

        if not self.rag_enabled:
            _trace("RAG disabled — routing follow-up to FollowUpQuestionGeneratorAgent")
            latest_q = self.memory.get_latest_question(session_id)
            recent_ans = self.memory.get_recent_answers(session_id, limit=1)
            question_text = latest_q.question if latest_q else ""
            answer_text = recent_ans[0].answer if recent_ans else ""
            evaluation = recent_ans[0].evaluation_json if recent_ans else {}
            _fu = self.followup_agent.generate(session_id, question_text, answer_text, evaluation)
            return QuestionGenerationResult(**_fu.model_dump())

        # RAG is enabled — assert required pipeline components are initialized
        assert self.retriever is not None, "RAG retriever not initialized when rag_enabled=True"
        assert self.followup_manager is not None, "Follow-up manager not initialized when rag_enabled=True"
        latest_question = self.memory.get_latest_question(session_id)
        recent_answers = self.memory.get_recent_answers(session_id, limit=1)
        last_answer = recent_answers[0].answer if recent_answers else ""
        evaluation = recent_answers[0].evaluation_json if recent_answers else {}

        question_text = latest_question.question if latest_question else ""

        # Quick quality probe: check if RAG embeddings are meaningful (scores < 0 = mock/test vectors)
        _use_rag_followup = False
        if self.rag_enabled:
            try:
                _probe_ctx = {"role": "", "subject": "", "company": "", "interview_type": "subject",
                              "difficulty": "Medium", "skills": [], "experience": "", "jd": ""}
                _probe_res = self.retriever.retrieve(_probe_ctx, limit=1)
                _candidates = _probe_res.get("candidates") or []
                _top = _candidates[0] if _candidates else None
                _score = (_top.get("score") or _top.get("ranking_score") or 0) if _top else -1
                _use_rag_followup = _score >= 0
            except Exception:
                _use_rag_followup = False

        if not _use_rag_followup:
            _trace("RAG follow-up confidence too low — routing to FollowUpQuestionGeneratorAgent")
            _fu = self.followup_agent.generate(session_id, question_text, last_answer, evaluation)
            return QuestionGenerationResult(**_fu.model_dump())

        try:
            session = self.memory.get_session(session_id)
            context = self.memory.get_recent_context(session_id)
            weak_areas = self.memory.get_weak_areas(session_id)
            strong_areas = self.memory.get_strong_areas(session_id)

            session_context = {
                "session_id": session_id,
                "role": session.role,
                "company": session.company or "Generic",
                "subject": session.subject or "",
                "difficulty": session.difficulty or "Medium",
                "interview_type": session.interview_type or "technical",
                "weak_skills": list(weak_areas.keys()),
                "strong_skills": list(strong_areas.keys()),
                "recent_questions": context.get("recent_questions", []),
                "recent_answers": context.get("recent_answers", []),
                "question_number": session.questions_asked + 1,
                "jd": session.jd_details or "",
                "skills": session.skills_json or [],
                "experience": session.experience or ""
            }

            followup_res = self.followup_manager.generate_followup(
                previous_question=question_text,
                candidate_answer=last_answer,
                evaluation=evaluation,
                session_context=session_context
            )
        except Exception as _rag_fu_exc:
            logger.warning(
                "RAG follow-up generation failed (%s) — falling back to FollowUpQuestionGeneratorAgent",
                _rag_fu_exc,
            )
            _fu = self.followup_agent.generate(session_id, question_text, last_answer, evaluation)
            return QuestionGenerationResult(**_fu.model_dump())
        
        conversational_followup = followup_res["follow_up_question"]
        selected = followup_res["selected_candidate"]
        
        metadata = selected.get("metadata") or {}
        if not metadata:
            metadata = selected
        # RAG influence metrics for follow-up
        _context_text = selected.get("document") or ""
        _context_tokens = len(_context_text.split()) if _context_text else 0
        _prompt_tokens_est = max(_context_tokens + 50, 1)
        _rag_utilization_pct = round(
            (_context_tokens / _prompt_tokens_est) * 100, 1
        ) if _context_tokens else 0.0

        rag_data = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "retrieval_id": selected.get("id") or metadata.get("chunk_id") or selected.get("retrieval_id") or "",
            "chunk_id": metadata.get("chunk_id") or selected.get("id") or selected.get("retrieval_id") or "",
            "expected_answer": selected.get("expected_answer") or selected.get("document", ""),
            "evaluation_rubric": metadata.get("evaluation_rubric") or metadata.get("rubric") or "",
            "knowledge_asset": metadata.get("source_file") or metadata.get("asset_id") or metadata.get("source_asset") or "Knowledge Base",
            "retrieval_strategy": "followup",
            "retrieval_similarity": selected.get("score") or 0.8,
            "selection_confidence": followup_res.get("confidence") or 0.8,
            "selection_reason": followup_res.get("reason") or "Selected follow-up match",
            "difficulty_reason": f"Followup scaling: {session.difficulty}",
            "question_source": "RETRIEVED",
            "is_retrieved": True,
            "is_generated": False,
            "followup_source": latest_question.question,
            # RAG influence metrics
            "retrieval_tokens_injected": _context_tokens,
            "retrieval_utilization_pct": _rag_utilization_pct,
            "rag_selected": True,
        }
        
        try:
            _record_rag_turn(True, _rag_utilization_pct)
        except Exception:
            pass
        
        if "Answer:" in rag_data["expected_answer"]:
            try:
                rag_data["expected_answer"] = rag_data["expected_answer"].split("Answer:")[1].strip()
            except Exception:
                pass

        self.memory.log_rag_turn(session_id, rag_data)
        self.retriever.session.register_asked_question(rag_data["chunk_id"], metadata, conversational_followup)
        
        # QuestionGenerationResult and enums are imported at the top of this module
        
        try:
            difficulty_enum = DifficultyLevel(session.difficulty.capitalize())
        except Exception:
            difficulty_enum = DifficultyLevel.MEDIUM

        return QuestionGenerationResult(
            question=conversational_followup,
            category=QuestionCategory.TECHNICAL,
            difficulty=difficulty_enum,
            rationale=followup_res.get("reason", "")
        )

    def _session_exists(self, session_id: str) -> bool:
        try:
            self.memory.get_session(session_id)
            return True
        except Exception:
            return False
