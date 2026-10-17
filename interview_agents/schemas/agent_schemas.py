"""
Agent-specific schemas for each interview type.
Each agent returns its own typed evaluation result which gets stored in evaluation_json.
All results are backward-compatible with the base AnswerEvaluationResult via to_base().
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from interview_agents.utils.enums import PsychometricPillar, PsychometricResponseType


def _clamp(v: Any) -> int:
    if isinstance(v, (int, float)):
        return max(0, min(10, int(round(v))))
    if isinstance(v, str):
        try:
            return max(0, min(10, int(round(float(v)))))
        except ValueError:
            pass
    return 0


# ─────────────────────────────────────────────
# SUBJECT AGENT SCHEMAS
# ─────────────────────────────────────────────

class SubjectQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    topic: str = Field(default="")
    category: str = Field(default="Technical")
    difficulty: str = Field(default="Medium")
    company_level: str = Field(default="Accenture/HCL")
    rationale: str = Field(default="")
    expected_keywords: list[str] = Field(default_factory=list)

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Medium"
        return "Medium"

    @field_validator("category", mode="before")
    @classmethod
    def norm_cat(cls, v: Any) -> str:
        mapping = {
            "technical": "Technical", "behavioral": "Behavioral",
            "problem solving": "Problem Solving", "hr": "HR",
        }
        return mapping.get(str(v).strip().lower(), "Technical") if v else "Technical"


class SubjectEvaluationResult(BaseModel):
    conceptual_accuracy: int = Field(ge=0, le=10)
    depth_of_explanation: int = Field(ge=0, le=10)
    example_quality: int = Field(ge=0, le=10)
    edge_case_awareness: int = Field(ge=0, le=10)
    practical_application: int = Field(ge=0, le=10)
    communication_clarity: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = False
    topic_covered: str = Field(default="")
    company_readiness: str = Field(default="")

    @field_validator(
        "conceptual_accuracy", "depth_of_explanation", "example_quality",
        "edge_case_awareness", "practical_application", "communication_clarity",
        "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.conceptual_accuracy,
            "communication_score": self.communication_clarity,
            "relevance_score": self.practical_application,
            "problem_solving_score": self.edge_case_awareness,
            "completeness_score": self.depth_of_explanation,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": self.follow_up_needed,
            # Extended subject fields
            "conceptual_accuracy": self.conceptual_accuracy,
            "depth_of_explanation": self.depth_of_explanation,
            "example_quality": self.example_quality,
            "edge_case_awareness": self.edge_case_awareness,
            "practical_application": self.practical_application,
            "communication_clarity": self.communication_clarity,
            "topic_covered": self.topic_covered,
            "company_readiness": self.company_readiness,
        }


# ─────────────────────────────────────────────
# VERBAL AGENT SCHEMAS
# ─────────────────────────────────────────────

class VerbalQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    prompt_type: str = Field(default="situational")
    difficulty: str = Field(default="Medium")
    rationale: str = Field(default="")
    vocabulary_focus: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Medium"
        return "Medium"


class VerbalEvaluationResult(BaseModel):
    grammar_accuracy: int = Field(ge=0, le=10)
    vocabulary_richness: int = Field(ge=0, le=10)
    fluency: int = Field(ge=0, le=10)
    coherence: int = Field(ge=0, le=10)
    response_completeness: int = Field(ge=0, le=10)
    confidence_signal: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = False
    improvement_tip: str = Field(default="")

    @field_validator(
        "grammar_accuracy", "vocabulary_richness", "fluency", "coherence",
        "response_completeness", "confidence_signal", "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.coherence,
            "communication_score": self.fluency,
            "relevance_score": self.response_completeness,
            "problem_solving_score": self.confidence_signal,
            "completeness_score": self.response_completeness,
            "grammar_score": self.grammar_accuracy,
            "vocabulary_score": self.vocabulary_richness,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": self.follow_up_needed,
            # Extended verbal fields
            "grammar_accuracy": self.grammar_accuracy,
            "vocabulary_richness": self.vocabulary_richness,
            "fluency": self.fluency,
            "coherence": self.coherence,
            "confidence_signal": self.confidence_signal,
            "improvement_tip": self.improvement_tip,
        }


# ─────────────────────────────────────────────
# WRITTEN AGENT SCHEMAS
# ─────────────────────────────────────────────

class WrittenQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    task_type: str = Field(default="paragraph")
    difficulty: str = Field(default="Medium")
    rationale: str = Field(default="")
    word_limit: int = Field(default=150)

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Medium"
        return "Medium"


class WrittenEvaluationResult(BaseModel):
    grammar_spelling: int = Field(ge=0, le=10)
    structure_organization: int = Field(ge=0, le=10)
    clarity_expression: int = Field(ge=0, le=10)
    vocabulary_usage: int = Field(ge=0, le=10)
    argument_strength: int = Field(ge=0, le=10)
    conciseness: int = Field(ge=0, le=10)
    task_completion: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = True
    corrected_sample: str = Field(default="")

    @field_validator(
        "grammar_spelling", "structure_organization", "clarity_expression",
        "vocabulary_usage", "argument_strength", "conciseness",
        "task_completion", "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.task_completion,
            "communication_score": self.clarity_expression,
            "relevance_score": self.task_completion,
            "problem_solving_score": self.argument_strength,
            "completeness_score": self.structure_organization,
            "grammar_score": self.grammar_spelling,
            "vocabulary_score": self.vocabulary_usage,
            "content_structure_score": self.structure_organization,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": self.follow_up_needed,
            # Extended written fields
            "grammar_spelling": self.grammar_spelling,
            "structure_organization": self.structure_organization,
            "clarity_expression": self.clarity_expression,
            "vocabulary_usage": self.vocabulary_usage,
            "argument_strength": self.argument_strength,
            "conciseness": self.conciseness,
            "task_completion": self.task_completion,
            "corrected_sample": self.corrected_sample,
        }


# ─────────────────────────────────────────────
# COMPANY / JD AGENT SCHEMAS
# ─────────────────────────────────────────────

class CompanyQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    question_type: str = Field(default="behavioral")
    jd_keyword_targeted: str = Field(default="")
    difficulty: str = Field(default="Medium")
    rationale: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Medium"
        return "Medium"


class CompanyEvaluationResult(BaseModel):
    jd_alignment: int = Field(ge=0, le=10)
    behavioral_fit: int = Field(ge=0, le=10)
    technical_relevance: int = Field(ge=0, le=10)
    cultural_signal: int = Field(ge=0, le=10)
    problem_solving_approach: int = Field(ge=0, le=10)
    role_readiness: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = False
    company_fit_summary: str = Field(default="")

    @field_validator(
        "jd_alignment", "behavioral_fit", "technical_relevance", "cultural_signal",
        "problem_solving_approach", "role_readiness", "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.technical_relevance,
            "communication_score": self.cultural_signal,
            "relevance_score": self.jd_alignment,
            "problem_solving_score": self.problem_solving_approach,
            "completeness_score": self.role_readiness,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": self.follow_up_needed,
            # Extended company fields
            "jd_alignment": self.jd_alignment,
            "behavioral_fit": self.behavioral_fit,
            "technical_relevance": self.technical_relevance,
            "cultural_signal": self.cultural_signal,
            "problem_solving_approach": self.problem_solving_approach,
            "role_readiness": self.role_readiness,
            "company_fit_summary": self.company_fit_summary,
        }


# ─────────────────────────────────────────────
# SVAR AGENT SCHEMAS
# ─────────────────────────────────────────────

class SVARQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    svar_type: str = Field(default="short_question")
    passage: str = Field(default="")
    expected_answer: str = Field(default="")
    difficulty: str = Field(default="Medium")
    rationale: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Medium"
        return "Medium"


class SVAREvaluationResult(BaseModel):
    pronunciation_accuracy: int = Field(ge=0, le=10)
    grammar_correctness: int = Field(ge=0, le=10)
    vocabulary_match: int = Field(ge=0, le=10)
    response_appropriateness: int = Field(ge=0, le=10)
    comprehension_accuracy: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = False
    correction: str = Field(default="")

    @field_validator(
        "pronunciation_accuracy", "grammar_correctness", "vocabulary_match",
        "response_appropriateness", "comprehension_accuracy", "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.comprehension_accuracy,
            "communication_score": self.pronunciation_accuracy,
            "relevance_score": self.response_appropriateness,
            "problem_solving_score": self.vocabulary_match,
            "completeness_score": self.grammar_correctness,
            "pronunciation_score": self.pronunciation_accuracy,
            "correctness_score": self.vocabulary_match,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": False,
            # Extended SVAR fields
            "pronunciation_accuracy": self.pronunciation_accuracy,
            "grammar_correctness": self.grammar_correctness,
            "vocabulary_match": self.vocabulary_match,
            "response_appropriateness": self.response_appropriateness,
            "comprehension_accuracy": self.comprehension_accuracy,
            "correction": self.correction,
        }


# ─────────────────────────────────────────────
# HR / BEHAVIORAL AGENT SCHEMAS
# ─────────────────────────────────────────────

class HRQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    scenario_type: str = Field(default="general")
    star_focus: str = Field(default="All")
    difficulty: str = Field(default="Medium")
    rationale: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Medium"
        return "Medium"


class HREvaluationResult(BaseModel):
    situation_clarity: int = Field(ge=0, le=10)
    task_definition: int = Field(ge=0, le=10)
    action_specificity: int = Field(ge=0, le=10)
    result_quantification: int = Field(ge=0, le=10)
    self_awareness: int = Field(ge=0, le=10)
    communication_structure: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = False
    star_completeness: str = Field(default="")
    improvement_tip: str = Field(default="")
    probe_target: str = Field(
        default="",
        description="A specific, content-grounded follow-up question drawn from a concrete "
                    "detail in the candidate's own answer (a tool, number, decision, person, "
                    "deadline). Empty when nothing specific enough was mentioned.",
    )
    supersedes_question_id: int | None = Field(
        default=None,
        description="Set only when this evaluation merges a follow-up answer with its parent "
                    "STAR story; the parent question's own standalone evaluation should then be "
                    "excluded from score aggregation in favor of this merged one.",
    )
    red_flags: list[str] = Field(
        default_factory=list,
        description="Each entry is a concrete issue plus why it was flagged, e.g. "
                    "'Very short answer (9 words) — too brief to assess STAR components'.",
    )

    @field_validator(
        "situation_clarity", "task_definition", "action_specificity",
        "result_quantification", "self_awareness", "communication_structure",
        "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.task_definition,
            "communication_score": self.communication_structure,
            "relevance_score": self.situation_clarity,
            "problem_solving_score": self.action_specificity,
            "completeness_score": self.result_quantification,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": self.follow_up_needed,
            # Extended HR fields
            "situation_clarity": self.situation_clarity,
            "task_definition": self.task_definition,
            "action_specificity": self.action_specificity,
            "result_quantification": self.result_quantification,
            "self_awareness": self.self_awareness,
            "communication_structure": self.communication_structure,
            "star_completeness": self.star_completeness,
            "improvement_tip": self.improvement_tip,
            "probe_target": self.probe_target,
            "supersedes_question_id": self.supersedes_question_id,
            "red_flags": self.red_flags,
        }


# ─────────────────────────────────────────────
# SYSTEM DESIGN AGENT SCHEMAS
# ─────────────────────────────────────────────

class SystemDesignQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    design_scope: str = Field(default="high_level")
    system_type: str = Field(default="web_service")
    difficulty: str = Field(default="Hard")
    rationale: str = Field(default="")
    drill_down_hint: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def norm_diff(cls, v: Any) -> str:
        if isinstance(v, str):
            c = v.strip().capitalize()
            return c if c in ("Easy", "Medium", "Hard") else "Hard"
        return "Hard"


class SystemDesignEvaluationResult(BaseModel):
    requirements_gathering: int = Field(ge=0, le=10)
    architecture_correctness: int = Field(ge=0, le=10)
    scalability_thinking: int = Field(ge=0, le=10)
    component_knowledge: int = Field(ge=0, le=10)
    trade_off_awareness: int = Field(ge=0, le=10)
    communication_of_design: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    follow_up_needed: bool = True
    drill_down_focus: str = Field(default="")

    @field_validator(
        "requirements_gathering", "architecture_correctness", "scalability_thinking",
        "component_knowledge", "trade_off_awareness", "communication_of_design",
        "overall_score", mode="before"
    )
    @classmethod
    def coerce(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        return {
            "technical_score": self.architecture_correctness,
            "communication_score": self.communication_of_design,
            "relevance_score": self.requirements_gathering,
            "problem_solving_score": self.scalability_thinking,
            "completeness_score": self.component_knowledge,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "follow_up_needed": True,
            # Extended system design fields
            "requirements_gathering": self.requirements_gathering,
            "architecture_correctness": self.architecture_correctness,
            "scalability_thinking": self.scalability_thinking,
            "component_knowledge": self.component_knowledge,
            "trade_off_awareness": self.trade_off_awareness,
            "communication_of_design": self.communication_of_design,
            "drill_down_focus": self.drill_down_focus,
        }


# ─────────────────────────────────────────────
# PSYCHOMETRIC AGENT SCHEMAS
# ─────────────────────────────────────────────

class PsychometricOption(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    # Scored response types (Likert/SJT/MCQ/etc.): 0-10 contribution toward
    # the question's tagged pillar(s) if this option is chosen.
    # Ranking type only: reused as the ideal rank position (1 = most
    # preferred) so scoring can compare the candidate's order against it.
    score: int = Field(default=0, ge=0, le=10)


class PsychometricQuestionResult(BaseModel):
    question: str = Field(min_length=1)
    pillar: PsychometricPillar
    secondary_pillars: list[PsychometricPillar] = Field(default_factory=list)
    response_type: PsychometricResponseType
    # Empty for open_ended, which takes free text instead of a fixed option set.
    options: list[PsychometricOption] = Field(default_factory=list)
    scenario_context: str = Field(default="")
    rationale: str = Field(default="")
    # "bank" when served from an admin-uploaded ephemeral batch bank,
    # "llm" when generated live. Mirrors QuestionGenerationResult.source.
    source: str = Field(default="llm")


class PsychometricOpenEndedJudgment(BaseModel):
    """LLM judgment for the one response type (open_ended) that isn't scored
    deterministically from an options list."""
    score: int = Field(ge=0, le=10)
    feedback: str = Field(default="")

    @field_validator("score", mode="before")
    @classmethod
    def coerce_score(cls, v: Any) -> int:
        return _clamp(v)


class PsychometricEvaluationResult(BaseModel):
    # Sparse: only the pillar(s) this particular question actually touched.
    pillar_scores: dict[str, int] = Field(default_factory=dict)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(default="")
    # Feeds the report's Authenticity Meter: true when this response looks
    # inconsistent with the candidate's earlier answers on the same pillar.
    consistency_flag: bool = False
    follow_up_needed: bool = False

    @field_validator("pillar_scores", mode="before")
    @classmethod
    def clamp_scores(cls, v: Any) -> dict[str, int]:
        if not isinstance(v, dict):
            return {}
        return {str(k): _clamp(val) for k, val in v.items()}

    @field_validator("overall_score", mode="before")
    @classmethod
    def coerce_overall(cls, v: Any) -> int:
        return _clamp(v)

    def to_base_dict(self) -> dict[str, Any]:
        # Psychometric scoring is trait-based rather than skill-based, so
        # this is a best-effort bridge onto the generic report pipeline's
        # base fields, not a precise semantic match.
        return {
            "technical_score": self.pillar_scores.get("problem_solving", self.overall_score),
            "communication_score": self.pillar_scores.get("communication", self.overall_score),
            "relevance_score": self.overall_score,
            "problem_solving_score": self.pillar_scores.get("decision_making", self.overall_score),
            "completeness_score": self.overall_score,
            "overall_score": self.overall_score,
            "feedback": self.feedback,
            "strengths": [],
            "weaknesses": [],
            "follow_up_needed": False,
            # Extended psychometric fields
            "pillar_scores": self.pillar_scores,
            "consistency_flag": self.consistency_flag,
        }
