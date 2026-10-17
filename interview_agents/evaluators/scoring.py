from __future__ import annotations

import re
from collections.abc import Iterable

from interview_agents.config.settings import get_settings
from interview_agents.schemas.interview import AnswerEvaluationResult, DifficultyAdjustmentResult
from interview_agents.utils.enums import DifficultyLevel

settings = get_settings()


def _tokenize(text: str) -> set[str]:
    return {token.lower() for token in re.findall(r"[A-Za-z0-9_]+", text)}


def _clamp_score(value: float) -> int:
    return max(0, min(10, int(round(value))))


def heuristic_evaluate_answer(
    question: str,
    answer: str,
    role: str,
    skills: Iterable[str],
    experience: str,
) -> AnswerEvaluationResult:
    """Fallback evaluator used when the OpenAI service is unavailable or returns invalid output."""

    answer_tokens = _tokenize(answer)
    question_tokens = _tokenize(question)
    skill_tokens = {skill.lower() for skill in skills}
    overlap = len(answer_tokens & (question_tokens | skill_tokens))

    length_score = 2 if len(answer.split()) < 12 else 4 if len(answer.split()) < 40 else 6
    technical_score = _clamp_score(3 + overlap + (2 if any(skill.lower() in answer.lower() for skill in skills) else 0))
    communication_score = _clamp_score(length_score + (2 if any(marker in answer.lower() for marker in ["because", "for example", "in short", "first", "second"]) else 0))
    relevance_score = _clamp_score(4 + min(overlap, 4) + (1 if role.lower() in answer.lower() else 0))
    problem_solving_score = _clamp_score(3 + (2 if any(word in answer.lower() for word in ["trade-off", "approach", "step", "logic", "reasoning", "example"]) else 0) + min(overlap, 3))
    completeness_score = _clamp_score(3 + (4 if len(answer.split()) >= 20 else 2) + (1 if any(word in answer.lower() for word in ["however", "also", "furthermore", "because"]) else 0))

    overall_score = _clamp_score(
        (
            technical_score * 0.25
            + communication_score * 0.15
            + relevance_score * 0.20
            + problem_solving_score * 0.20
            + completeness_score * 0.20
        )
    )

    strengths = []
    weaknesses = []
    if technical_score >= 7:
        strengths.append("Demonstrates solid technical grounding")
    else:
        weaknesses.append("Technical explanation needs more precision")
    if communication_score >= 7:
        strengths.append("Communicates clearly and in a structured way")
    else:
        weaknesses.append("Communication could be more structured")
    if completeness_score < 6:
        weaknesses.append("Answer is incomplete or lacks detail")
    if relevance_score >= 7:
        strengths.append("Stays on topic and answers the asked question")
    if problem_solving_score >= 7:
        strengths.append("Shows practical reasoning and problem-solving intent")

    feedback = (
        f"Fallback evaluation for {experience} candidate applying for {role}. "
        f"The answer appears {'strong' if overall_score >= settings.interview_success_threshold else 'needs improvement'} "
        f"with an overall score of {overall_score}/10."
    )

    follow_up_needed = overall_score < settings.interview_success_threshold or completeness_score < 6
    if follow_up_needed and not weaknesses:
        weaknesses.append("The answer would benefit from a deeper explanation")

    return AnswerEvaluationResult(
        technical_score=technical_score,
        communication_score=communication_score,
        relevance_score=relevance_score,
        problem_solving_score=problem_solving_score,
        completeness_score=completeness_score,
        overall_score=overall_score,
        feedback=feedback,
        strengths=strengths,
        weaknesses=weaknesses,
        follow_up_needed=follow_up_needed,
    )


def heuristic_difficulty_adjustment(current_difficulty: str, overall_score: int) -> DifficultyAdjustmentResult:
    """Fallback difficulty controller when the LLM cannot be used."""

    current = current_difficulty.capitalize()
    normalized_score = float(overall_score)
    if normalized_score > 10:
        normalized_score = min(10.0, normalized_score / 10.0)

    if normalized_score >= settings.hard_score_threshold:
        next_level = DifficultyLevel.HARD if current != DifficultyLevel.HARD.value else DifficultyLevel.HARD
        action = "increase" if current != DifficultyLevel.HARD.value else "maintain"
        reason = "Candidate is performing strongly, so the interview should become more challenging."
    elif normalized_score <= settings.easy_score_threshold:
        next_level = DifficultyLevel.EASY
        action = "decrease" if current != DifficultyLevel.EASY.value else "maintain"
        reason = "Candidate is struggling, so the next question should be easier and more focused."
    else:
        next_level = DifficultyLevel.MEDIUM
        action = "maintain"
        reason = "Candidate is in the expected range, so keep the current difficulty steady."

    return DifficultyAdjustmentResult(difficulty=next_level, action=action, reason=reason)
