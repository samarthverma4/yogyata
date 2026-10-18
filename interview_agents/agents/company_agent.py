"""
Company / JD Interview Agent — generates and evaluates questions aligned to a specific
company's interview style and job description keywords.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.config.settings import get_settings
from interview_agents.schemas.agent_schemas import CompanyEvaluationResult, CompanyQuestionResult
from interview_agents.schemas.interview import QuestionGenerationResult
from interview_agents.services.web_search_service import WebSearchService, build_grounding_block
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps
from interview_agents.utils.question_style import depth_specific_rules, question_style_directive

logger = logging.getLogger(__name__)
_web_search_service = WebSearchService(get_settings())

QUESTION_TYPE_ROTATION = ["behavioral", "technical", "cultural", "role_readiness"]


class CompanyAgent(BaseChildAgent):
    """Company/JD-aligned interview agent for placement company-specific prep."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        # Coverage tracking needs the WHOLE session's questions, not just the
        # last 5 - on a 15+ question interview a skill asked about early was
        # scrolling out of a 5-question window and being treated as
        # "uncovered" again, which is part of why the interview kept circling
        # back to the same handful of skills instead of spreading across the
        # JD. The prompt's own "do not repeat" display still only shows the
        # recent tail, so it doesn't balloon with the full history.
        all_asked_questions = self.memory.get_previous_question_texts(session_id, limit=50)
        recent_questions = all_asked_questions[-5:]

        company = getattr(session, "company", None) or kwargs.get("company", "the target company")
        job_title = getattr(session, "job_title", None) or context.get("role", "")
        jd_details = getattr(session, "jd_details", None) or ""

        # JD skill-graph extraction - mirrors question_generator.py's
        # _build_jd_payload() for the non-avatar flow (company.txt), which this
        # agent never had at all: it only ever saw the raw JD text with no
        # structured tracking of which skills had already been asked about, so
        # coverage across a session was left entirely to the LLM's own memory
        # of the conversation instead of an explicit uncovered-skills list.
        # No session-tracked "covered topics" list exists for company sessions
        # (CompanyEvaluationResult never populates one), so a skill counts as
        # covered if its keyword already appears in a previously asked question.
        try:
            from services.retrieval.jd_skill_extractor import extract_jd_skills_llm
            jd_skills_list = extract_jd_skills_llm(jd_details, job_title or context.get("role", ""), self.openai_service)
        except Exception:
            jd_skills_list = []
        recent_questions_text = " ".join(all_asked_questions).lower()
        uncovered_skills = [s for s in jd_skills_list if s.lower() not in recent_questions_text]
        # Uncapped - see the matching comment in question_generator.py's
        # _build_jd_payload. A truncated view meant part of the extracted JD
        # skill graph never reached the model regardless of rotation.
        jd_skills_str = ", ".join(jd_skills_list) if jd_skills_list else ""
        uncovered_skills_str = ", ".join(uncovered_skills) if uncovered_skills else ""

        questions_asked = int(context.get("questions_asked", 0))
        # Per-session offset - see the matching comment in verbal_agent.py.
        # Without it every fresh session's turn 1 always got "behavioral".
        offset = hash(session_id)
        if questions_asked == 0:
            # The opening question must establish company/role grounding - this
            # interview is billed as "Company / JD", so it can't open on an
            # off-topic behavioral prompt. Rotation (incl. behavioral) resumes
            # from turn 2 onward.
            question_type = "technical"
        else:
            question_type = QUESTION_TYPE_ROTATION[(questions_asked + offset) % len(QUESTION_TYPE_ROTATION)]

        # Force ONE specific skill onto this turn instead of handing the model
        # the whole uncovered list and trusting it to "prefer" a fresh one -
        # that soft framing is exactly what let the model keep gravitating to
        # whichever skill it found most salient every turn, fixating the
        # interview on one theme instead of spreading across the JD's
        # requirement areas. Round-robin deterministically by turn index so
        # each turn's mandatory target is different from the last, independent
        # of question_type (a Hard-tier turn gets the same enforcement as
        # every other tier).
        skill_rotation_pool = uncovered_skills or jd_skills_list
        target_skill = (
            skill_rotation_pool[(questions_asked + offset) % len(skill_rotation_pool)]
            if skill_rotation_pool else ""
        )

        # Pace company-specific questions to ~1 in 3 - mirrors question_generator.py's
        # company_focus_directive for the non-avatar flow. The LLM can't reliably
        # self-regulate this ratio (it drifts to all-or-none), so it's decided here
        # by position and handed down as one clear directive per turn.
        q_number = questions_asked + 1
        if q_number % 3 == 0:
            company_focus_directive = (
                f"THIS IS QUESTION {q_number} — make it an EXPLICIT {company} question: "
                f"about the clients, industries, delivery model, scale, or ways of working at "
                f"{company}, while still assessing a genuine skill of the role. Name "
                f"{company} in the question."
            )
        else:
            company_focus_directive = (
                f"THIS IS QUESTION {q_number} — make it a COMPANY-NEUTRAL role question: a strong, "
                f"standard question for this role that does NOT mention {company} at all."
            )

        # When the admin required a resume, the student's parsed resume arrives here.
        # Truncated: the JD and the conversation still have to fit in the prompt.
        resume_text = (kwargs.get("resume_text") or "").strip()
        resume_context = (
            f"CANDIDATE RESUME (ground roughly 1 in 5 questions - 20% of the interview - in this "
            f"real experience; name a specific project, technology, or employer from it. The other "
            f"80% stay pure JD questions regardless):\n{resume_text[:3000]}"
            if resume_text
            else "No resume was provided for this candidate - this interview must be 100% "
                 "JD-grounded with no resume slice at all."
        )

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "job_title": job_title,
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "company": company,
            "resume_context": resume_context,
            "jd_details": jd_details or "General software engineering / IT role",
            "jd_skills": jd_skills_str,
            "uncovered_jd_skills": uncovered_skills_str,
            "target_skill": target_skill or "(no unresolved JD skill - use your judgement)",
            "difficulty": context["difficulty"],
            "recent_questions": safe_json_dumps(recent_questions),
            "question_type_hint": question_type,
            "company_focus_directive": company_focus_directive,
            "question_style_directive": question_style_directive(
                questions_asked + 1, context.get("difficulty"),
                seed=f"{session_id}|{company}",
                recent_questions=recent_questions,
            ),
            "depth_specific_rules": depth_specific_rules(context.get("difficulty"), question_type_variety=True),
            "web_context": build_grounding_block(
                _web_search_service,
                "company",
                company=company,
                role=context["role"],
                web_search_enabled=bool(kwargs.get("web_search_enabled")),
                blocking=False,
            ),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "company_question",
                    prompt_payload,
                    CompanyQuestionResult,
                    subdirectory="agents",
                )
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    category = (
                        QuestionCategory.BEHAVIORAL
                        if result.question_type in ("behavioral", "cultural")
                        else QuestionCategory.TECHNICAL
                    )
                    return QuestionGenerationResult(
                        question=result.question,
                        category=category,
                        difficulty=DifficultyLevel(result.difficulty),
                        rationale=result.rationale,
                    )
            except Exception:
                logger.warning("CompanyAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(company, context, questions_asked, session_id=session_id)
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> CompanyEvaluationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)

        company = getattr(session, "company", None) or "the target company"
        job_title = getattr(session, "job_title", None) or context.get("role", "")
        jd_details = getattr(session, "jd_details", None) or ""

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "job_title": job_title,
            "experience": context["experience"],
            "company": company,
            "jd_details": jd_details or "General software engineering / IT role",
            "difficulty": context["difficulty"],
            "question": question,
            "answer": answer,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "company_evaluate",
                    prompt_payload,
                    CompanyEvaluationResult,
                    subdirectory="agents",
                )
                self._track_performance(session_id, result)
                return result
            except Exception:
                logger.warning("CompanyAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(question, answer, context)

    def should_follow_up(self, evaluation_result: CompanyEvaluationResult) -> bool:
        return evaluation_result.follow_up_needed or evaluation_result.overall_score < 7

    def _track_performance(self, session_id: str, result: CompanyEvaluationResult) -> None:
        try:
            if result.behavioral_fit < 6:
                self.memory.update_weak_areas(session_id, "Behavioral Fit")
            if result.jd_alignment < 6:
                self.memory.update_weak_areas(session_id, "JD Alignment")
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, "Company Fit")
        except Exception:
            pass

    def _fallback_question(
        self, company: str, context: dict[str, Any], questions_asked: int, session_id: str | None = None,
    ) -> QuestionGenerationResult:
        role = context.get("role", "Software Engineer")
        difficulty = context.get("difficulty", "Medium")
        fallbacks = [
            f"Tell me about a time when you had to learn a new technology quickly. What was your approach and what was the result?",
            f"Why do you want to work at {company}, and how does this role align with your career goals?",
            f"Describe a project where you demonstrated problem-solving skills relevant to the {role} role.",
            f"How do you handle working under pressure or tight deadlines? Give a specific example.",
        ]
        # Per-session offset - see the matching comment in verbal_agent.py.
        offset = hash(session_id) if session_id else 0
        question = fallbacks[(questions_asked + offset) % len(fallbacks)]
        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.BEHAVIORAL,
            difficulty=DifficultyLevel(difficulty),
            rationale="Fallback company interview question",
        )

    def _fallback_evaluate(self, question: str, answer: str, context: dict[str, Any]) -> CompanyEvaluationResult:
        from interview_agents.evaluators.scoring import heuristic_evaluate_answer
        base = heuristic_evaluate_answer(question, answer, context["role"], context["skills"], context["experience"])
        return CompanyEvaluationResult(
            jd_alignment=base.relevance_score,
            behavioral_fit=base.communication_score,
            technical_relevance=base.technical_score,
            cultural_signal=max(0, base.communication_score - 1),
            problem_solving_approach=base.problem_solving_score,
            role_readiness=base.overall_score,
            overall_score=base.overall_score,
            feedback=base.feedback,
            strengths=base.strengths,
            weaknesses=base.weaknesses,
            follow_up_needed=base.follow_up_needed,
            company_fit_summary="Requires more company-specific detail for accurate fit assessment.",
        )
