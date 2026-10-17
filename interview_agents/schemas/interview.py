from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from interview_agents.utils.enums import DifficultyLevel, QuestionCategory


class StartInterviewRequest(BaseModel):
    candidate_name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    experience: str = Field(min_length=1, max_length=120)
    skills: list[str] = Field(default_factory=list)
    # Optional hints from external clients (e.g. the Avatar Interviews studio).
    # interview_type biases question generation toward a focus area; difficulty
    # sets the starting level. Both are additive — existing callers are unaffected.
    interview_type: Optional[str] = Field(default=None, max_length=64)
    difficulty: Optional[str] = Field(default=None, max_length=32)
    resume_text: Optional[str] = Field(default=None, description="Parsed resume text for context-aware questioning")
    student_id: Optional[str] = Field(default=None, description="Student identifier for cross-session memory")
    # Needed so company/JD avatar interviews can actually ground questions in
    # the real JD instead of the agent's generic placeholder - previously
    # dropped here, so company_agent.py never saw a real company/jd_details.
    subject: Optional[str] = Field(default=None, max_length=255)
    company: Optional[str] = Field(default=None, max_length=255)
    job_title: Optional[str] = Field(default=None, max_length=255)
    jd_details: Optional[str] = Field(default=None, max_length=8000)
    # When an admin schedules an interview with a fixed easy/medium/hard
    # question mix, these carry that mix so avatar sessions follow the same
    # position-based difficulty schedule the non-avatar flow already uses,
    # instead of the adaptive difficulty controller. All three omitted (the
    # self-serve / non-admin-scheduled case) preserves today's adaptive
    # difficulty behavior unchanged.
    easy_count: Optional[int] = Field(default=None, ge=0)
    medium_count: Optional[int] = Field(default=None, ge=0)
    hard_count: Optional[int] = Field(default=None, ge=0)
    # Appended after easy/medium/hard are exhausted - see adjust_difficulty/
    # route_after_adjustment in interview_service.py.
    coding_count: Optional[int] = Field(default=None, ge=0)
    # Same toggle as the text-interview flow's web_search_enabled - grounds
    # fallback question generation in live Tavily search results for this
    # session's role/round-type. Persisted on the session since avatar
    # interviews are multi-turn (one flag at start, reused every turn).
    web_search_enabled: bool = Field(default=False)
    # Admin-configured question bank, if any - lets avatar sessions retrieve
    # from it the same way non-avatar interviews already do. Persisted on the
    # session (like easy/medium/hard_count above) since it's set once at
    # start and reused on every subsequent turn.
    question_bank_id: Optional[str] = Field(default=None, max_length=64)
    question_bank_ratio: float = Field(default=0.0, ge=0.0, le=1.0)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, value: list[str]) -> list[str]:
        return [skill.strip() for skill in value if skill and skill.strip()]


class StartInterviewResponse(BaseModel):
    session_id: str
    first_question: str
    audio_url: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    session_id: str = Field(min_length=1)
    answer: str = Field(min_length=1)


class SubmitAnswerResponse(BaseModel):
    evaluation: dict[str, Any]
    next_question: str
    difficulty: str
    interview_complete: bool = False
    audio_url: Optional[str] = None
    # 'coding' when next_question is the coding round (write code in an editor,
    # not spoken) - 'qa' (default) for the normal voice flow.
    question_type: str = "qa"


class InterviewReportResponse(BaseModel):
    session_id: str
    report: dict[str, Any]


class HealthResponse(BaseModel):
    status: Literal["healthy"] = "healthy"


class QuestionGenerationResult(BaseModel):
    question: str = Field(min_length=1)
    category: QuestionCategory
    difficulty: DifficultyLevel
    rationale: str = Field(default="")
    source: Optional[str] = Field(default="llm")
    pdf_name: Optional[str] = Field(default=None)
    chunk_id: Optional[str] = Field(default=None)
    question_bank_id: Optional[str] = Field(default=None)
    similarity: Optional[float] = Field(default=0.0)
    scenario_type: Optional[str] = Field(
        default=None,
        description="Agent-specific sub-category (e.g. HR scenario type) used to route "
                    "evaluation and rotation. Unused by agents that don't set it.",
    )
    # Psychometric-only structured payload the frontend needs to render its
    # 13 response-type UI controls (Likert slider, SJT cards, ranking list,
    # etc.) — every other agent leaves these None/empty, so this is purely
    # additive and does not change behavior for any existing interview type.
    psychometric_pillar: Optional[str] = Field(default=None)
    psychometric_response_type: Optional[str] = Field(default=None)
    psychometric_options: list[dict] = Field(default_factory=list)
    psychometric_scenario_context: Optional[str] = Field(default=None)

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip().capitalize()
            if val in ("Easy", "Medium", "Hard"):
                return val
        return v

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip()
            if val.upper() == "HR":
                return "HR"
            if val.upper() == "SVAR":
                return "SVAR"
            if val.lower() in ("problem solving", "problem-solving"):
                return "Problem Solving"
            return val.title()
        return v


class CodingQuestionResult(BaseModel):
    """A LeetCode-style coding problem, generated fresh (no admin-authored bank
    for this tier). difficulty is the problem's own Easy/Medium/Hard rating -
    the coding round always asks for Medium or Hard, chosen by the caller."""

    question: str = Field(min_length=1)
    difficulty: DifficultyLevel
    rationale: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip().capitalize()
            if val in ("Easy", "Medium", "Hard"):
                return val
        return v


class CodingScoringParameter(BaseModel):
    score: int = Field(ge=0, le=10)
    reason: str = Field(default="")
    confidence: str = Field(default="High") # High | Medium | Low


class CodingScoringParameters(BaseModel):
    problem_understanding: CodingScoringParameter
    logic: CodingScoringParameter
    algorithm: CodingScoringParameter
    optimization: CodingScoringParameter
    code_structure: CodingScoringParameter
    readability: CodingScoringParameter
    maintainability: CodingScoringParameter
    edge_cases: CodingScoringParameter
    complexity: CodingScoringParameter
    debugging: CodingScoringParameter
    interview_readiness: CodingScoringParameter
    overall_coding_ability: CodingScoringParameter


class CodingEvaluationFeedback(BaseModel):
    overall_summary: str = Field(default="")
    problem_understanding: str = Field(default="")
    logic_evaluation: str = Field(default="")
    algorithm_selection: str = Field(default="")
    code_structure: str = Field(default="")
    optimization: str = Field(default="")
    time_complexity: str = Field(default="")
    space_complexity: str = Field(default="")
    edge_case_handling: str = Field(default="")
    code_quality: str = Field(default="")
    debugging_readiness: str = Field(default="")
    interview_readiness: str = Field(default="")
    strengths: list[str] = Field(default_factory=list)
    areas_of_improvement: list[str] = Field(default_factory=list)
    learning_recommendations: str = Field(default="")
    recruiter_feedback: str = Field(default="")
    difficulty_assessment: str = Field(default="")
    confidence_assessment: str = Field(default="")
    final_verdict: str = Field(default="")
    language: str = Field(default="")
    best_practices: str = Field(default="")
    robustness: str = Field(default="")
    error_handling: str = Field(default="")
    # The report shows the candidate's code beside a reference solution, so the
    # evaluator has to emit real code here - expected_approach above is deliberately
    # prose ("without code") and cannot fill that panel.
    optimal_solution: str = Field(default="")
    optimal_time_complexity: str = Field(default="")
    optimal_space_complexity: str = Field(default="")
    # edge_case_handling above is one prose blob. The report splits it into what the
    # candidate actually covered vs what they missed, which needs two real lists.
    edge_cases_handled: list[str] = Field(default_factory=list)
    edge_cases_missed: list[str] = Field(default_factory=list)
    # A walk through what the submitted code actually does, step by step.
    execution_steps: list[str] = Field(default_factory=list)

    # Several of the prose fields are described to the model with the word "List"
    # ("List all missing edge cases…"), so it sometimes answers with a JSON array
    # instead of a string — which used to fail validation and lose the ENTIRE
    # evaluation, not just that field. Accept either shape.
    @field_validator(
        "overall_summary", "problem_understanding", "logic_evaluation", "algorithm_selection",
        "code_structure", "optimization", "time_complexity", "space_complexity",
        "edge_case_handling", "code_quality", "debugging_readiness", "interview_readiness",
        "learning_recommendations", "recruiter_feedback", "difficulty_assessment",
        "confidence_assessment", "final_verdict", "best_practices", "robustness",
        "error_handling", "optimal_solution",
        mode="before",
    )
    @classmethod
    def _join_list_prose(cls, v: Any) -> Any:
        if isinstance(v, list):
            return "\n".join(str(x) for x in v if str(x).strip())
        return v


class CodeEvaluationResult(BaseModel):
    """Code-submission grading, read-only - the code is never executed. Scores
    are 0-100 to match the camelCase GLAMIS eval contract Node.js expects
    (see evaluate_code.txt / the /interview/evaluate-code route)."""

    overall_score: int = Field(ge=0, le=100)
    correctness_score: int = Field(ge=0, le=100)
    structure_score: int = Field(ge=0, le=100)
    pros: str = Field(default="")
    cons: str = Field(default="")
    expected_approach: str = Field(default="")
    detailed_feedback: Optional[CodingEvaluationFeedback] = None
    scoring_parameters: Optional[CodingScoringParameters] = None

    @field_validator("overall_score", "correctness_score", "structure_score", mode="before")
    @classmethod
    def coerce_to_int(cls, v: Any) -> int:
        if isinstance(v, (int, float)):
            return int(round(v))
        if isinstance(v, str):
            try:
                return int(round(float(v)))
            except ValueError:
                pass
        return v


class AnswerEvaluationResult(BaseModel):
    technical_score: int = Field(ge=0, le=10)
    communication_score: int = Field(ge=0, le=10)
    relevance_score: int = Field(ge=0, le=10)
    problem_solving_score: int = Field(ge=0, le=10)
    completeness_score: int = Field(ge=0, le=10)
    grammar_score: int = Field(ge=0, le=10, default=0)
    vocabulary_score: int = Field(ge=0, le=10, default=0)
    content_structure_score: int = Field(ge=0, le=10, default=0)
    pronunciation_score: int = Field(ge=0, le=10, default=0)
    correctness_score: int = Field(ge=0, le=10, default=0)
    accuracy_score: int = Field(ge=0, le=10, default=0)
    overall_score: int = Field(ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    # A short model/reference answer for the question, so the report can show an
    # "Expected Answer" even when no authoritative answer was supplied upfront.
    expected_answer: str = Field(default="")
    follow_up_needed: bool = False

    @field_validator(
        "technical_score",
        "communication_score",
        "relevance_score",
        "problem_solving_score",
        "completeness_score",
        "grammar_score",
        "vocabulary_score",
        "content_structure_score",
        "pronunciation_score",
        "correctness_score",
        "accuracy_score",
        "overall_score",
        mode="before"
    )
    @classmethod
    def coerce_to_int(cls, v: Any) -> int:
        if isinstance(v, (int, float)):
            return int(round(v))
        if isinstance(v, str):
            try:
                return int(round(float(v)))
            except ValueError:
                pass
        return v


class FollowUpGenerationResult(BaseModel):
    question: str = Field(min_length=1)
    category: QuestionCategory
    difficulty: DifficultyLevel
    rationale: str = Field(default="")

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip().capitalize()
            if val in ("Easy", "Medium", "Hard"):
                return val
        return v

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip()
            if val.upper() == "HR":
                return "HR"
            if val.upper() == "SVAR":
                return "SVAR"
            if val.lower() in ("problem solving", "problem-solving"):
                return "Problem Solving"
            return val.title()
        return v


class DifficultyAdjustmentResult(BaseModel):
    difficulty: DifficultyLevel
    action: Literal["increase", "maintain", "decrease"]
    reason: str = Field(min_length=1)

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip().capitalize()
            if val in ("Easy", "Medium", "Hard"):
                return val
        return v

    @field_validator("action", mode="before")
    @classmethod
    def normalize_action(cls, v: Any) -> str:
        if isinstance(v, str):
            val = v.strip().lower()
            if val in ("increase", "maintain", "decrease"):
                return val
        return v


class FinalReportResult(BaseModel):
    candidate_name: str
    role: str
    technical_score: int = Field(ge=0, le=10)
    communication_score: int = Field(ge=0, le=10)
    problem_solving_score: int = Field(ge=0, le=10)
    overall_score: int = Field(ge=0, le=10)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    summary: str = Field(default="")
    interview_outcome: str = Field(default="")
    feedback: str = Field(default="")
    duration: int = Field(default=0)
    question_statistics: dict[str, Any] = Field(default_factory=dict)
    rag_history: list[dict[str, Any]] = Field(default_factory=list)
    # F8 — actionable placement report fields
    placement_readiness_percent: int = Field(default=0, ge=0, le=100)
    company_fit: dict[str, int] = Field(default_factory=dict)
    focus_areas: list[str] = Field(default_factory=list)
    next_session_recommendation: str = Field(default="")
    # Admin Summary Agent — Red Flags + Cultural Fit
    red_flags: list[str] = Field(default_factory=list)
    cultural_fit_score: int = Field(default=0, ge=0, le=10)
    cultural_fit_assessment: str = Field(default="")
    model_config = ConfigDict(use_enum_values=True)

    @field_validator(
        "technical_score",
        "communication_score",
        "problem_solving_score",
        "overall_score",
        "placement_readiness_percent",
        "cultural_fit_score",
        mode="before"
    )
    @classmethod
    def coerce_to_int(cls, v: Any) -> int:
        if isinstance(v, (int, float)):
            return int(round(v))
        if isinstance(v, str):
            try:
                return int(round(float(v)))
            except ValueError:
                pass
        return v


class SubmitVoiceAnswerResponse(BaseModel):
    transcript: str
    evaluation: dict[str, Any]
    next_question: str
    difficulty: str
    interview_complete: bool = False
    audio_url: Optional[str] = None


class SpeechGenerationRequest(BaseModel):
    text: str = Field(min_length=1)


class SpeechGenerationResponse(BaseModel):
    audio_url: str

