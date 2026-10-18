"""
System Design Interview Agent — multi-round, drill-down architecture evaluation.
Always generates follow-up questions to probe deeper into components.
Starts with high-level design, then systematically drills into DB, cache, scale, APIs, failure.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.schemas.agent_schemas import SystemDesignEvaluationResult, SystemDesignQuestionResult
from interview_agents.schemas.interview import DifficultyAdjustmentResult, QuestionGenerationResult
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)

DRILL_DOWN_ORDER = [
    "high_level", "database", "caching", "scalability",
    "api", "failure", "security", "queue",
]

SYSTEM_STARTERS: dict[str, list[str]] = {
    "Easy": [
        "Design a URL shortener (like bit.ly).",
        "Design a basic chat application for two users.",
        "Design a simple notification service for a mobile app.",
    ],
    "Medium": [
        "Design a rate limiter for an API gateway.",
        "Design the backend for a social media news feed.",
        "Design a ride-sharing service backend (like Ola or Uber).",
    ],
    "Hard": [
        "Design a distributed database that can handle 10 million writes per day with 99.9% uptime.",
        "Design a video streaming platform like Netflix that serves 100 million concurrent users globally.",
        "Design a global payment processing system that handles 50,000 transactions per second.",
    ],
}


class SystemDesignAgent(BaseChildAgent):
    """System design interview agent with progressive drill-down questioning."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=10)
        difficulty = context.get("difficulty", "Medium")
        questions_asked = int(context.get("questions_asked", 0))

        # Determine current design scope from prior evaluations
        recent_answers = self.memory.get_recent_answers(session_id, limit=10)
        # Scopes are drilled in DRILL_DOWN_ORDER sequence (one per turn), so the
        # first `questions_asked` scopes have been covered. The old code parsed
        # free-form drill_down_focus prose with split(":"), which never matched a
        # scope token - leaving the tracker stuck on high_level every turn (and the
        # fallback path repeating the database drill).
        components_discussed = list(DRILL_DOWN_ORDER[:questions_asked])

        # Determine current system topic from prior drill-down. get_recent_answers
        # returns newest-first, so iterate directly (not reversed) to pick the LATEST
        # system_type - reversed() was selecting the oldest topic.
        current_design_topic = ""
        for a in recent_answers:
            if a.evaluation_json and a.evaluation_json.get("system_type"):
                current_design_topic = a.evaluation_json.get("system_type", "")
                break

        # Determine next drill-down scope
        drill_scope = "high_level"
        if questions_asked > 0:
            for scope in DRILL_DOWN_ORDER:
                if scope not in components_discussed:
                    drill_scope = scope
                    break

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "difficulty": difficulty,
            "current_design_topic": current_design_topic,
            "components_discussed": ", ".join(components_discussed) if components_discussed else "none yet",
            "recent_questions": safe_json_dumps(recent_questions),
            "drill_scope_hint": drill_scope,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "system_design_question",
                    prompt_payload,
                    SystemDesignQuestionResult,
                    subdirectory="agents",
                )
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return QuestionGenerationResult(
                        question=result.question,
                        category=QuestionCategory.PROBLEM_SOLVING,
                        difficulty=DifficultyLevel(result.difficulty),
                        rationale=result.rationale,
                    )
            except Exception:
                logger.warning("SystemDesignAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(
            difficulty, questions_asked, current_design_topic, components_discussed, session_id=session_id,
        )
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> SystemDesignEvaluationResult:
        context = self.memory.get_recent_context(session_id)
        recent_answers = self.memory.get_recent_answers(session_id, limit=3)
        current_system = kwargs.get("system_type", "")
        if not current_system:
            # newest-first, so iterate directly to get the LATEST system_type
            for a in recent_answers:
                if a.evaluation_json and a.evaluation_json.get("system_type"):
                    current_system = a.evaluation_json.get("system_type", "")
                    break

        design_scope = kwargs.get("design_scope", "high_level")

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "difficulty": context.get("difficulty", "Hard"),
            "design_scope": design_scope,
            "system_type": current_system or "general system",
            "question": question,
            "answer": answer,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "system_design_evaluate",
                    prompt_payload,
                    SystemDesignEvaluationResult,
                    subdirectory="agents",
                )
                # System design always follows up
                result.follow_up_needed = True
                self._track_performance(session_id, result)
                return result
            except Exception:
                logger.warning("SystemDesignAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(question, answer, context)

    def should_follow_up(self, evaluation_result: SystemDesignEvaluationResult) -> bool:
        # System design ALWAYS drills deeper
        return True

    def generate_followup(self, session_id: str, question: str, answer: str, evaluation: dict[str, Any], **kwargs) -> QuestionGenerationResult | None:
        drill_focus = evaluation.get("drill_down_focus", "")
        if drill_focus:
            return QuestionGenerationResult(
                question=drill_focus if "?" in drill_focus else f"Let's go deeper: {drill_focus}",
                category=QuestionCategory.PROBLEM_SOLVING,
                difficulty=DifficultyLevel(evaluation.get("difficulty", "Hard")),
                rationale="System design drill-down follow-up",
            )
        # If no specific drill focus, move to scalability
        return QuestionGenerationResult(
            question="How would your design change if the system needed to handle 100x the current load? What would you scale first?",
            category=QuestionCategory.PROBLEM_SOLVING,
            difficulty=DifficultyLevel("Hard"),
            rationale="Scalability drill-down",
        )

    def adjust_difficulty(self, session_id: str, evaluation: dict[str, Any], current_difficulty: str) -> DifficultyAdjustmentResult:
        # System design stays at Hard — it's always challenging
        from interview_agents.schemas.interview import DifficultyAdjustmentResult
        from interview_agents.utils.enums import DifficultyLevel
        return DifficultyAdjustmentResult(
            difficulty=DifficultyLevel.HARD,
            action="maintain",
            reason="System design interviews always remain at Hard difficulty to simulate real interviews.",
        )

    def _track_performance(self, session_id: str, result: SystemDesignEvaluationResult) -> None:
        try:
            if result.scalability_thinking < 6:
                self.memory.update_weak_areas(session_id, "Scalability")
            if result.requirements_gathering < 6:
                self.memory.update_weak_areas(session_id, "Requirements Gathering")
            if result.trade_off_awareness < 6:
                self.memory.update_weak_areas(session_id, "Trade-off Analysis")
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, "System Design")
        except Exception:
            pass

    def _fallback_question(
        self,
        difficulty: str,
        questions_asked: int,
        current_topic: str,
        components_discussed: list[str],
        session_id: str | None = None,
    ) -> QuestionGenerationResult:
        if questions_asked == 0 or not current_topic:
            options = SYSTEM_STARTERS.get(difficulty, SYSTEM_STARTERS["Medium"])
            # Per-session offset - see the matching comment in verbal_agent.py.
            # Without it every fresh session's fallback starter was always
            # options[0] (e.g. always "Design a rate limiter..." at Medium).
            offset = hash(session_id) if session_id else 0
            question = options[offset % len(options)]
        else:
            drill_questions = {
                "database": f"What database would you use for {current_topic} and why? How would you design the schema?",
                "caching": f"Where would you add caching in {current_topic}? What cache eviction strategy would you choose?",
                "scalability": f"How would you scale {current_topic} to handle 10x the current load?",
                "api": f"Define the key REST API endpoints for {current_topic}. What would the request and response look like?",
                "failure": f"What happens if the primary server in {current_topic} goes down? How do you handle failover?",
                "security": f"What security mechanisms would you implement in {current_topic}?",
                "queue": f"Where would message queues help in {current_topic}? Which queue technology would you choose?",
            }
            for scope in DRILL_DOWN_ORDER:
                if scope not in components_discussed and scope in drill_questions:
                    question = drill_questions[scope]
                    break
            else:
                question = f"What are the key trade-offs in your design for {current_topic}?"

        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.PROBLEM_SOLVING,
            difficulty=DifficultyLevel("Hard"),
            rationale="Fallback system design question",
        )

    def _fallback_evaluate(self, question: str, answer: str, context: dict[str, Any]) -> SystemDesignEvaluationResult:
        answer_lower = answer.lower()
        word_count = len(answer.split())

        req_keywords = ["requirement", "scale", "users", "traffic", "constraint", "assumption"]
        arch_keywords = ["server", "database", "api", "service", "component", "layer", "microservice"]
        scale_keywords = ["scale", "load balancer", "horizontal", "vertical", "sharding", "replica", "cdn"]
        tradeoff_keywords = ["trade-off", "alternatively", "however", "because", "versus", "pros", "cons"]

        requirements_gathering = 7 if any(k in answer_lower for k in req_keywords) else 3
        architecture_correctness = 7 if any(k in answer_lower for k in arch_keywords) else 4
        scalability_thinking = 7 if any(k in answer_lower for k in scale_keywords) else 3
        component_knowledge = 6 if word_count > 50 else 3
        trade_off_awareness = 7 if any(k in answer_lower for k in tradeoff_keywords) else 3
        communication_of_design = 6 if word_count > 80 else 3

        overall = int(round((
            requirements_gathering + architecture_correctness + scalability_thinking +
            component_knowledge + trade_off_awareness + communication_of_design
        ) / 6))

        return SystemDesignEvaluationResult(
            requirements_gathering=requirements_gathering,
            architecture_correctness=architecture_correctness,
            scalability_thinking=scalability_thinking,
            component_knowledge=component_knowledge,
            trade_off_awareness=trade_off_awareness,
            communication_of_design=communication_of_design,
            overall_score=overall,
            feedback="Always start by clarifying requirements and scale before jumping into architecture.",
            strengths=["Mentioned architecture components"] if architecture_correctness >= 6 else [],
            weaknesses=["Did not clarify requirements before designing"] if requirements_gathering < 5 else [],
            follow_up_needed=True,
            drill_down_focus="How would your design handle failures? What is your redundancy strategy?",
        )
