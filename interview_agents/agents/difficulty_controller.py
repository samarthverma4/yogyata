from __future__ import annotations

import logging

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.evaluators.scoring import heuristic_difficulty_adjustment
from interview_agents.schemas.interview import DifficultyAdjustmentResult
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)


class DifficultyControllerAgent(BaseInterviewAgent):
    """Adjusts interview difficulty based on recent candidate performance."""

    def adjust(self, session_id: str, evaluation: dict, current_difficulty: str) -> DifficultyAdjustmentResult:
        context = self.memory.get_recent_context(session_id)
        prompt_payload = {
            "current_difficulty": current_difficulty,
            "evaluation": safe_json_dumps(evaluation),
            "session_context": safe_json_dumps(context),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "difficulty_controller.txt",
                    prompt_payload,
                    DifficultyAdjustmentResult,
                )
                return result
            except Exception:
                logger.warning("LLM difficulty adjustment failed, falling back to heuristic adjustment", exc_info=True)

        return heuristic_difficulty_adjustment(current_difficulty, evaluation.get("overall_score", 0))
