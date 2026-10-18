from __future__ import annotations

import logging
from statistics import mean
from datetime import datetime, timezone
from typing import Any

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.config.settings import get_settings
from interview_agents.schemas.interview import FinalReportResult
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)
settings = get_settings()

_COMPANY_THRESHOLDS: dict[str, int] = {
    "TCS": 50, "Infosys": 50, "Wipro": 50, "Cognizant": 55,
    "Accenture": 65, "Capgemini": 62, "HCL": 60, "Tech Mahindra": 58,
    "KPIT": 68, "Amazon": 80, "Microsoft": 82, "Google": 85,
}


class ReportGeneratorAgent(BaseInterviewAgent):
    """Builds the final interview report from stored session data."""

    def generate(self, session_id: str) -> FinalReportResult:
        context = self.memory.get_recent_context(session_id, limit=20)
        summary = self.memory.get_evaluation_summary(session_id)
        evaluations = summary["evaluations"]
        session = self.memory.get_session(session_id)

        weak_areas = self.memory.get_weak_areas(session_id, top_n=5)
        strong_areas = self.memory.get_strong_areas(session_id, top_n=5)

        # Compute duration
        duration = 0
        if session.completed_at and session.created_at:
            completed_at_val = session.completed_at
            created_at_val = session.created_at
            if completed_at_val.tzinfo is None:
                completed_at_val = completed_at_val.replace(tzinfo=timezone.utc)
            if created_at_val.tzinfo is None:
                created_at_val = created_at_val.replace(tzinfo=timezone.utc)
            duration = int((completed_at_val - created_at_val).total_seconds())
        elif session.created_at:
            created_at_val = session.created_at
            if created_at_val.tzinfo is None:
                created_at_val = created_at_val.replace(tzinfo=timezone.utc)
            duration = int((datetime.now(timezone.utc) - created_at_val).total_seconds())

        # Compute question statistics
        if evaluations:
            scores_list = [item.get("overall_score", 0) for item in evaluations]
            avg_score = mean(scores_list)
            min_score = min(scores_list)
            max_score = max(scores_list)
            question_stats = {
                "count": len(evaluations),
                "average": float(avg_score),
                "min": int(min_score),
                "max": int(max_score)
            }
        else:
            question_stats = {"count": 0, "average": 0.0, "min": 0, "max": 0}

        # Build feedback string by concatenating answer feedbacks
        feedback_list = [eval_item.get("feedback", "") for eval_item in evaluations if eval_item.get("feedback")]
        feedback = "\n".join(feedback_list) if feedback_list else "No feedback available."

        prompt_payload = {
            "candidate_name": session.candidate_name,
            "role": session.role,
            "experience": session.experience,
            "skills": ", ".join(session.skills_json or []),
            "interview_type": getattr(session, "interview_type", "subject"),
            "session_summary": safe_json_dumps(summary | {"context": context}),
            "evaluations": safe_json_dumps(evaluations),
            "weak_areas": ", ".join(weak_areas.keys()) if weak_areas else "none identified",
            "strong_areas": ", ".join(strong_areas.keys()) if strong_areas else "none identified",
        }

        rag_history = []
        try:
            rag_history = self.memory.get_rag_history(session_id)
        except Exception:
            pass

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "report_generator.txt",
                    prompt_payload,
                    FinalReportResult,
                )
                result.duration = duration
                result.question_statistics = question_stats
                result.rag_history = rag_history
                if not result.feedback:
                    result.feedback = feedback
                # Ensure company_fit always has all 12 benchmark companies
                readiness = result.placement_readiness_percent or min(100, result.overall_score * 10)
                for company, threshold in _COMPANY_THRESHOLDS.items():
                    if company not in result.company_fit:
                        result.company_fit[company] = 1 if readiness >= threshold else 0
                return result
            except Exception:
                logger.warning("LLM report generation failed, falling back to heuristic report", exc_info=True)

        fb_result = self._fallback_report(session_id, duration, question_stats, feedback)
        fb_result.rag_history = rag_history
        return fb_result

    def _fallback_report(self, session_id: str, duration: int = 0, question_stats: dict[str, Any] = None, feedback: str = "") -> FinalReportResult:
        session = self.memory.get_session(session_id)
        summary_data = self.memory.get_evaluation_summary(session_id)
        evaluations = summary_data["evaluations"]
        if evaluations:
            technical_score = int(round(mean(item.get("technical_score", 0) for item in evaluations)))
            communication_score = int(round(mean(item.get("communication_score", 0) for item in evaluations)))
            problem_solving_score = int(round(mean(item.get("problem_solving_score", 0) for item in evaluations)))
            overall_score = int(round(mean(item.get("overall_score", 0) for item in evaluations)))
            strengths = summary_data["strengths"]
            weaknesses = summary_data["weaknesses"]
        else:
            technical_score = communication_score = problem_solving_score = overall_score = 0
            strengths = []
            weaknesses = ["No interview answers were evaluated."]

        recommendations = []
        if technical_score < settings.interview_success_threshold:
            recommendations.append("Reinforce core technical concepts and practice explaining implementation details.")
        if communication_score < settings.interview_success_threshold:
            recommendations.append("Practice answering in a more structured and concise way.")
        if problem_solving_score < settings.interview_success_threshold:
            recommendations.append("Use step-by-step reasoning and explain trade-offs more clearly.")
        if not recommendations:
            recommendations.append("Continue practicing with more advanced scenario-based questions.")

        outcome = "Strong hire signal" if overall_score >= settings.hard_score_threshold else "Needs more preparation" if overall_score < settings.interview_success_threshold else "Potential hire with follow-up"
        summary_text = (
            f"The candidate completed a mock interview for the {session.role} role. "
            f"Performance was {'strong' if overall_score >= settings.interview_success_threshold else 'mixed'} across the evaluated dimensions."
        )

        # F8 — placement readiness and company fit
        placement_readiness_percent = min(100, overall_score * 10)
        company_fit = {
            c: 1 if placement_readiness_percent >= t else 0
            for c, t in _COMPANY_THRESHOLDS.items()
        }
        weak_areas = self.memory.get_weak_areas(session_id, top_n=3)
        focus_areas = list(weak_areas.keys()) if weak_areas else weaknesses[:3]
        next_rec = (
            f"Focus on {focus_areas[0]} before the next session."
            if focus_areas else "Continue with varied practice questions."
        )

        # Red flags — heuristic detection
        red_flags: list[str] = []
        if evaluations:
            low_score_topics = [
                ev.get("topic_covered", "")
                for ev in evaluations
                if ev.get("overall_score", 10) < 4 and ev.get("topic_covered")
            ]
            if len(low_score_topics) >= 2:
                red_flags.append(f"Consistently low scores on: {', '.join(set(low_score_topics))}")
            if communication_score < 4:
                red_flags.append("Poor communication clarity across multiple answers")
            if technical_score < 4:
                red_flags.append("Unable to explain basic technical concepts")
            non_answer_count = sum(
                1 for ev in evaluations
                if ev.get("overall_score", 10) == 0
            )
            if non_answer_count >= 2:
                red_flags.append(f"Submitted {non_answer_count} blank or non-answers")

        # Cultural fit — heuristic based on communication + engagement
        cultural_fit_score = min(10, max(0, int(round((communication_score + problem_solving_score) / 2))))
        if cultural_fit_score >= 8:
            cultural_fit_assessment = "Candidate communicated clearly and engaged well with all questions."
        elif cultural_fit_score >= 5:
            cultural_fit_assessment = "Candidate showed reasonable engagement but communication can be more structured."
        else:
            cultural_fit_assessment = "Candidate struggled with clear communication and structured responses."

        return FinalReportResult(
            candidate_name=session.candidate_name,
            role=session.role,
            technical_score=technical_score,
            communication_score=communication_score,
            problem_solving_score=problem_solving_score,
            overall_score=overall_score,
            strengths=strengths,
            weaknesses=weaknesses,
            recommendations=recommendations,
            summary=summary_text,
            interview_outcome=outcome,
            feedback=feedback,
            duration=duration,
            question_statistics=question_stats or {},
            placement_readiness_percent=placement_readiness_percent,
            company_fit=company_fit,
            focus_areas=focus_areas,
            next_session_recommendation=next_rec,
            red_flags=red_flags,
            cultural_fit_score=cultural_fit_score,
            cultural_fit_assessment=cultural_fit_assessment,
        )
