"""Adaptive interview orchestrator.

Runs a full interview by composing the six fixes and persisting a transcript
(question, answer, dimensional score, extracted topics, difficulty decision,
follow-up) so generation is response-conditioned rather than positional. Every
question is stamped with its audit record: source, blueprint bucket, difficulty
level, and any web query issued.

Answers are supplied by an injected provider callable, which is the interview API
turn loop in production and a scripted double in the end-to-end test.
"""
from __future__ import annotations

import dataclasses
import logging
import time
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from interview_agents.interview_engine.blueprint import Blueprint, build_blueprint
from interview_agents.interview_engine.dedup import NearDuplicateDetector
from interview_agents.interview_engine.difficulty import AdaptiveDifficulty
from interview_agents.interview_engine.evaluator import DiscriminatingEvaluator
from interview_agents.interview_engine.followup import FollowUpGenerator
from interview_agents.interview_engine.generator import QuestionWriter
from interview_agents.interview_engine.protocols import (
    Embedder,
    Evaluation,
    LLMClient,
    QuestionMeta,
    RunReport,
    Turn,
    WebSearchClient,
)
from interview_agents.interview_engine.routing import SourceRouter
from interview_agents.interview_engine.web_grounding import WebGrounder

try:
    from interview_agents.utils.metrics_tracker import record_generation as _record_generation
except Exception:  # pragma: no cover
    def _record_generation(*_a, **_kw): pass  # type: ignore[misc]

logger = logging.getLogger(__name__)

# (index, question, bucket, difficulty) -> candidate answer text
AnswerProvider = Callable[[int, str, str, str], str]


@dataclass
class EngineConfig:
    interview_id: str
    role: str
    company: str = ""
    jd: str = ""
    resume: str = ""
    total_questions: int = 20
    interview_type: str = "company"
    interview_mode: str = "default"
    # None, not "seed" - a truthy placeholder here makes has_qb true and
    # allocates a real "qb" quota (filled from the hardcoded seed_bank) even
    # when no admin question bank was ever uploaded for this interview.
    question_bank_id: Optional[str] = None
    start_difficulty: str = "Medium"
    dedup_regen_cap: int = 3
    regen_budget_ms: int = 3000   # Fix 3: stop retrying once the regen loop has spent this long
    web_available: bool = True


class InterviewEngine:
    def __init__(
        self,
        config: EngineConfig,
        llm: Optional[LLMClient] = None,
        web: Optional[WebSearchClient] = None,
        embedder: Optional[Embedder] = None,
    ) -> None:
        self.cfg = config
        self.blueprint: Blueprint = build_blueprint(
            role=config.role, jd=config.jd, resume=config.resume, total=config.total_questions
        )
        self.router = SourceRouter(
            total_questions=config.total_questions,
            interview_type=config.interview_type,
            interview_mode=config.interview_mode,
            question_bank_id=config.question_bank_id,
            session_id=config.interview_id,
            web_available=config.web_available,
        )
        self.grounder = WebGrounder(web if config.web_available else None, config.company, config.role)
        self.writer = QuestionWriter(llm)
        self.evaluator = DiscriminatingEvaluator(llm)
        self.followup = FollowUpGenerator(llm)
        self.difficulty = AdaptiveDifficulty(config.start_difficulty)
        self.dedup = NearDuplicateDetector(embedder)
        self._asked: List[str] = []
        self.turns: List[Turn] = []      # persisted transcript (drives per-turn HTTP use)

    def _generate_unique(self, bucket: str, subtopic: str, difficulty: str, grounding: str, turn_no: int = 0):
        regens = 0
        candidate = ""
        _llm_ms = 0.0
        _dedup_ms = 0.0
        _loop_start = time.perf_counter()  # Fix 3: regen latency budget
        for attempt in range(self.cfg.dedup_regen_cap + 1):
            # Fix 3: after the first attempt, stop retrying once the loop has already
            # spent its budget. A stubborn collision then ships a slightly-less-unique
            # question instead of compounding into a multi-second latency spike.
            if attempt > 0 and (time.perf_counter() - _loop_start) * 1000 > self.cfg.regen_budget_ms:
                logger.info("[ENGINE] regen budget %dms hit after %d regen(s); accepting last candidate", self.cfg.regen_budget_ms, regens)
                break
            _t = time.perf_counter()
            candidate = self.writer.write(
                bucket=bucket, subtopic=subtopic, difficulty=difficulty,
                company=self.cfg.company, role=self.cfg.role,
                web_grounding=grounding, avoid=self._asked, turn_no=turn_no,
            )
            _llm_ms += (time.perf_counter() - _t) * 1000
            _t = time.perf_counter()
            hit = self.dedup.check(candidate)
            if not hit.is_duplicate:
                self.dedup.add(candidate, hit.vec)
                _dedup_ms += (time.perf_counter() - _t) * 1000
                self._prof_llm_ms, self._prof_dedup_ms = _llm_ms, _dedup_ms
                return candidate, regens
            _dedup_ms += (time.perf_counter() - _t) * 1000
            regens += 1
            logger.info("[ENGINE] regen %d: candidate collided (%s)", regens, hit.kind)
        # Exhausted retries: accept the last candidate but keep the regen count.
        _t = time.perf_counter()
        self.dedup.add(candidate, hit.vec)
        _dedup_ms += (time.perf_counter() - _t) * 1000
        self._prof_llm_ms, self._prof_dedup_ms = _llm_ms, _dedup_ms
        return candidate, regens

    # ── per-turn API (drives the live turn-by-turn HTTP flow) ──────────────────
    def produce_question(self, i: int) -> Turn:
        """Generate the question for turn i (0-based) and stash a pending Turn.

        Idempotent: calling it twice for the same index returns the already
        produced turn (a retried HTTP generate call must not double-advance the
        blueprint or the router)."""
        if i < len(self.turns):
            return self.turns[i]

        _t0 = time.perf_counter()
        self._prof_llm_ms = 0.0
        self._prof_dedup_ms = 0.0
        bucket = self.blueprint.next_bucket()
        subtopic = self.blueprint.next_subtopic(bucket)
        difficulty = self.difficulty.level              # response-conditioned (fix 1)

        resolution = self.router.resolve(i + 1, bucket, subtopic, difficulty)
        _t_route = time.perf_counter()
        web_query = None
        grounding_text = ""
        if resolution.needs_web:
            g = self.grounder.for_slot(subtopic)         # per-subtopic query (fix 3)
            web_query, grounding_text = g.query, g.snippets
        _t_web = time.perf_counter()
        source = resolution.source
        fallback_reason = resolution.fallback_reason
        if resolution.source == "bank" and resolution.bank_question:
            # A curated bank question can still collide with something already
            # asked from another source. Dedup it too; on a collision drop to
            # generation and record that the bank slot fell back (never silently
            # ship a near-duplicate just because it came from the bank).
            _bank_hit = self.dedup.check(resolution.bank_question)
            if not _bank_hit.is_duplicate:
                question = resolution.bank_question
                self.dedup.add(question, _bank_hit.vec)   # Fix 2: reuse embedding from check()
                regens = 0
            else:
                logger.info("[ENGINE] bank question collided; regenerating slot %d", i)
                question, regens = self._generate_unique(bucket, subtopic, difficulty, grounding_text, turn_no=i)
                source = "llm"
                fallback_reason = "bank duplicate"
        else:
            question, regens = self._generate_unique(bucket, subtopic, difficulty, grounding_text)

        _t_gen = time.perf_counter()
        # Permanent lightweight per-turn latency signal (kept after the latency
        # investigation) so a future regression is visible without re-instrumenting.
        # Also fed to /metrics, where it aggregates into p50/p95 alongside the
        # request-level latency the middleware already records.
        _record_generation(
            (_t_gen - _t0) * 1000, self._prof_llm_ms, self._prof_dedup_ms, regens
        )
        logger.info(
            "[gen-latency] turn=%d src=%s bucket=%s regens=%d asked=%d | total=%.0f route=%.0f web=%.0f gen=%.0f (llm=%.0f dedup=%.0f)",
            i, source, bucket, regens, len(self._asked),
            (_t_gen - _t0) * 1000, (_t_route - _t0) * 1000, (_t_web - _t_route) * 1000,
            (_t_gen - _t_web) * 1000, self._prof_llm_ms, self._prof_dedup_ms,
        )
        meta = QuestionMeta(
            index=i, bucket=bucket, source=source,
            planned_source=resolution.planned_source, difficulty=difficulty,
            web_query=web_query, source_fallback_reason=fallback_reason,
            dedup_regens=regens, subtopic=subtopic,
        )
        # Commit the blueprint allocation at generation time, not at answer time:
        # the live client defers evaluation, so the next question is often produced
        # before the previous one is recorded. Marking here keeps coverage advancing
        # (buckets rotate) regardless of when answers come back.
        self.blueprint.mark_filled(bucket)
        self._asked.append(question)
        turn = Turn(meta=meta, question=question)
        self.turns.append(turn)
        return turn

    def record_answer(self, i: int, answer: str) -> Turn:
        """Evaluate turn i's answer, update difficulty for the NEXT turn, and
        conditionally attach a follow-up. Safe to call once per turn."""
        turn = self.turns[i]
        if turn.evaluation is not None:
            return turn                                   # already recorded
        turn.answer = answer
        turn.evaluation = self.evaluator.evaluate(turn.question, answer)      # dimensional (fix 6)
        decision = self.difficulty.update(turn.evaluation.total)             # next difficulty (fix 1)
        turn.difficulty_decision = dataclasses.asdict(decision)
        # Follow-ups are explicitly disabled for company/JD interviews (this
        # engine's only interview_type) - the mandatory per-turn JD-skill
        # rotation already decides what every question assesses, and a
        # follow-up would re-probe the same topic outside that schedule.
        turn.follow_up = None
        return turn

    def build_report(self) -> RunReport:
        report = RunReport(
            interview_id=self.cfg.interview_id, role=self.cfg.role,
            company=self.cfg.company, total_questions=self.cfg.total_questions,
            blueprint_quota=dict(self.blueprint.quota),
            blueprint_filled=dict(self.blueprint.filled),
        )
        report.turns = list(self.turns)
        return report

    def run(self, answer_provider: AnswerProvider) -> RunReport:
        """Batch driver (tests / offline replay): compose the per-turn API."""
        for i in range(self.cfg.total_questions):
            turn = self.produce_question(i)
            answer = answer_provider(i, turn.question, turn.meta.bucket, turn.meta.difficulty)
            self.record_answer(i, answer)
        report = self.build_report()
        logger.info(
            "[ENGINE] done: source_mix=%s buckets=%s score_var=%.1f",
            report.source_mix(), report.blueprint_filled, report.score_variance(),
        )
        return report
