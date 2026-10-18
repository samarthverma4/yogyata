from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import os
import re
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from interview_agents.adapters.glamis_adapter import GLAMISAdapter
from interview_agents.api.deps import get_interview_orchestrator
from interview_agents.schemas.glamis import GLAMISRequest, GLAMISResponse
from interview_agents.schemas.interview import (
    HealthResponse,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    SubmitVoiceAnswerResponse,
)
from interview_agents.config.settings import get_settings
from interview_agents.services.interview_service import InterviewOrchestrator
from interview_agents.services.speech_to_text_service import get_stt_service, SpeechToTextService
from interview_agents.services.text_to_speech_service import get_tts_service, TextToSpeechService
from interview_agents.services.web_search_service import WebSearchService, prefetch_grounding
from interview_agents.services.question_source_router import QuestionSourceRouter

_prefetch_web_search_service = WebSearchService(get_settings())

router = APIRouter(tags=["interview"])


def _response_metadata_for(base_metadata: dict[str, Any] | None, question_result: Any) -> dict[str, Any]:
    """Every existing interview type only ever echoes the request's own
    metadata back untouched. Psychometric is the first type where the
    frontend needs structured data it didn't already have — the option
    list/pillar/response_type to render its 13 answer controls — so this
    merges that payload in under a "psychometric" key when present.
    QuestionGenerationResult leaves psychometric_pillar as None for every
    other agent, so this is a no-op for all non-psychometric responses."""
    metadata = dict(base_metadata or {})
    if getattr(question_result, "psychometric_pillar", None):
        metadata["psychometric"] = {
            "pillar": question_result.psychometric_pillar,
            "response_type": question_result.psychometric_response_type,
            "options": question_result.psychometric_options,
            "scenario_context": question_result.psychometric_scenario_context,
            "source": question_result.source,
        }
    return metadata


class QuestionRequest(BaseModel):
    prompt: Optional[str] = None
    system_instruction: Optional[str] = "You are a helpful assistant."
    model: Optional[str] = "gpt-4o-mini"
    max_tokens: Optional[int] = 1000


class EvaluateRequest(BaseModel):
    question: str
    answer: str
    interview_type: Optional[str] = "subject"
    difficulty: Optional[str] = "Medium"
    prompt: Optional[str] = None
    system_instruction: Optional[str] = None
    # Psychometric only — the option list (with scores) the question was
    # actually generated with, so scoring is a deterministic lookup rather
    # than an LLM judgment. None/[] for every other type.
    pillar: Optional[str] = None
    response_type: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None


class FollowupRequest(BaseModel):
    session_id: str


class ResumeQuestionRequest(BaseModel):
    resume_text: str
    difficulty: str
    conversation_history: List[Dict[str, Any]]


class JDQuestionRequest(BaseModel):
    selected_company: str
    job_title: str
    jd_details: str
    difficulty: str
    conversation_history: List[Dict[str, Any]]
    web_search_enabled: bool = False
    # Set when the admin required (or the student supplied) a resume, so company
    # questions can be grounded in the candidate's real experience.
    resume_text: Optional[str] = None
    question_bank_id: Optional[str] = None
    question_bank_ratio: float = 0.0
    next_question_no: Optional[int] = None
    # Without this, two interviews scheduled against the same JD have an
    # identical turn-1 prompt (same company/role/JD, empty history) and no
    # per-interview seed to rotate the question style against - the model
    # regenerates the same opening question every time the JD is reused.
    interview_id: Optional[str] = None
    # Total questions in this interview - needed to know how many turns remain
    # so the JD-skill coverage guarantee can tell whether it must force an
    # uncovered skill onto this turn or can still leave it to advisory steering.
    total_questions: Optional[int] = None


class SubjectQuestionRequest(BaseModel):
    subject: str
    difficulty: str
    conversation_history: List[Dict[str, Any]]
    web_search_enabled: bool = False
    question_bank_id: Optional[str] = None
    question_bank_ratio: float = 0.0
    next_question_no: Optional[int] = None


class CodingQuestionRequest(BaseModel):
    domain_context: str
    jd_details: str = ""
    difficulty: str = "Medium"
    conversation_history: List[Dict[str, Any]] = []
    # Without this, the category/scenario picked for a coding question is a
    # pure function of how many questions this turn is (turn_index % pool
    # length) - every interview scheduled against the same JD lands on the
    # exact same category/scenario for its first coding question.
    interview_id: Optional[str] = None


class CodeEvaluationRequest(BaseModel):
    question: str
    code: str
    difficulty: Optional[str] = "Medium"


class BankSkillGapRequest(BaseModel):
    job_title: str = ""
    jd_details: str = ""
    bank_text: str = ""


class PrefetchContextRequest(BaseModel):
    interview_type: str = "subject"
    subject: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    web_search_enabled: bool = False


class AdaptiveNextRequest(BaseModel):
    """One turn of the adaptive engine (blueprint + router + dedup + response-
    conditioned difficulty). Difficulty is decided by the engine, not the caller."""
    interview_id: str
    question_no: int
    role: str = "Software Engineer"
    company: str = ""
    jd_details: str = ""
    resume_text: str = ""
    total_questions: int = 20
    interview_type: str = "company"
    question_bank_id: Optional[str] = "seed"
    web_search_enabled: bool = True


class AdaptiveEvaluateRequest(BaseModel):
    interview_id: str
    question_no: int
    question: str = ""
    answer: str


class VerbalQuestionRequest(BaseModel):
    difficulty: str
    conversation_history: List[Dict[str, Any]]
    answer: str


class HrQuestionRequest(BaseModel):
    difficulty: str
    conversation_history: List[Dict[str, Any]]
    answer: str
    resume_text: str = ""
    # Optional grounding context forwarded from the admin-scheduled interview doc.
    # When present they are used to ask company- and role-specific behavioral questions
    # instead of generic HR questions.  Missing / null = backward-compatible generic mode.
    company: Optional[str] = None
    position: Optional[str] = None
    job_description: Optional[str] = None
    # Drives the adaptive HR interview arc (Introduction -> ... -> Closing) as a
    # percentage of completion rather than a fixed question number. Missing/null
    # = the stage engine falls back to the original flat rotation (backward compatible).
    total_questions: Optional[int] = None
    # Real candidate name for the opening greeting; missing/null falls back to
    # the existing generic "Candidate" placeholder (backward compatible).
    candidate_name: Optional[str] = None


class WrittenQuestionRequest(BaseModel):
    subject: str
    difficulty: str
    conversation_history: List[Dict[str, Any]]


class SvarQuestionRequest(BaseModel):
    difficulty: str
    conversation_history: List[Dict[str, Any]]


class PsychometricQuestionRequest(BaseModel):
    difficulty: str = "Medium"
    conversation_history: List[Dict[str, Any]] = []
    candidate_name: Optional[str] = None
    # Node's ephemeral per-batch admin bank lookup result, if any (see
    # psychometricQuestionBank.models.js) — None/absent falls through to LLM
    # generation. When present, this is served as-is with zero LLM calls.
    bank_question: Optional[Dict[str, Any]] = None
    pillar: Optional[str] = None
    response_type: Optional[str] = None
    next_question_no: Optional[int] = None
    # Random per-attempt value Node generates once at join time (see
    # createInterviewByPsychometricAdmin) — offsets the pillar/response_type
    # round-robin and nudges LLM phrasing so retaking the same interview, or
    # different candidates on different drives, don't all see the exact same
    # question 1 (the round-robin is otherwise 100% deterministic from
    # question_number alone). None falls back to the old fixed sequence.
    seed: Optional[int] = None


class PrefetchNextQuestionRequest(BaseModel):
    interview_id: Optional[str] = None
    interview_type: str
    difficulty: str
    conversation_history: List[Dict[str, Any]]
    question_bank_id: Optional[str] = None
    question_bank_ratio: float = 0.0
    interview_mode: str = "default"
    next_question_no: int
    subject: Optional[str] = None
    selected_company: Optional[str] = None
    job_title: Optional[str] = None
    jd_details: Optional[str] = None
    # Missing here meant every prefetched question (which the admin-scheduled
    # flow now serves for most turns - see generateQuestionForJDAdmin's
    # prefetch cache) was silently generated with NO resume grounding, even
    # for a candidate whose resume was on file, since this request never
    # carried it through to generate_glamis_question below.
    resume_text: Optional[str] = None


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


class ResumeParseRequest(BaseModel):
    resume_text: str


@router.post("/resume/parse")
def parse_resume_endpoint(payload: ResumeParseRequest) -> dict:
    import sys
    from pathlib import Path
    pkg_path = str(Path(__file__).resolve().parents[2] / "yogyata-ai" / "src")
    if pkg_path not in sys.path:
        sys.path.insert(0, pkg_path)
    from yogyata_ai.resume_intelligence.parser import parse_resume
    parsed = parse_resume(payload.resume_text)
    return {
        "status": "success",
        "skills": [s.name for s in parsed.skills],
        "experience": [e.model_dump() for e in parsed.experience],
        "education": [ed.model_dump() for ed in parsed.education],
        "projects": [p.model_dump() for p in parsed.projects],
    }


@router.post("/start-interview", response_model=StartInterviewResponse)
@router.post("/interview/start", response_model=StartInterviewResponse)
def start_interview(
    payload: StartInterviewRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
    tts_service: TextToSpeechService = Depends(get_tts_service),
) -> StartInterviewResponse:
    try:
        response = orchestrator.start_interview(payload)
        audio_url = tts_service.generate_audio_async(response.first_question)
        return StartInterviewResponse(
            session_id=response.session_id,
            first_question=response.first_question,
            audio_url=audio_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/submit-answer", response_model=SubmitAnswerResponse)
@router.post("/interview/answer", response_model=SubmitAnswerResponse)
def submit_answer(
    payload: SubmitAnswerRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
    tts_service: TextToSpeechService = Depends(get_tts_service),
) -> SubmitAnswerResponse:
    try:
        response = orchestrator.submit_answer(payload)
        audio_url = tts_service.generate_audio_async(response.next_question)
        return SubmitAnswerResponse(
            evaluation=response.evaluation,
            next_question=response.next_question,
            difficulty=response.difficulty,
            interview_complete=response.interview_complete,
            audio_url=audio_url,
            question_type=response.question_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/submit-voice-answer", response_model=SubmitVoiceAnswerResponse)
def submit_voice_answer(
    session_id: str = Form(...),
    audio_file: UploadFile = File(...),
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
    stt_service: SpeechToTextService = Depends(get_stt_service),
    tts_service: TextToSpeechService = Depends(get_tts_service),
) -> SubmitVoiceAnswerResponse:
    if not audio_file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No audio file uploaded.")

    ext = os.path.splitext(audio_file.filename)[1].lower()
    allowed_extensions = {".mp3", ".wav", ".m4a", ".webm"}
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format. Supported formats are: {', '.join(sorted(allowed_extensions))}"
        )

    fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            while chunk := audio_file.file.read(1024 * 1024):
                temp_file.write(chunk)

        try:
            stt_service.validate_audio(temp_path)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        try:
            transcript = stt_service.transcribe(temp_path)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to transcribe audio file: {exc}"
            ) from exc

        if not transcript.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio transcription produced no text. Please answer clearly."
            )

        submit_payload = SubmitAnswerRequest(session_id=session_id, answer=transcript)
        try:
            session_response = orchestrator.submit_answer(submit_payload)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

        audio_url = tts_service.generate_audio(session_response.next_question)

        return SubmitVoiceAnswerResponse(
            transcript=transcript,
            evaluation=session_response.evaluation,
            next_question=session_response.next_question,
            difficulty=session_response.difficulty,
            interview_complete=session_response.interview_complete,
            audio_url=audio_url,
        )

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.post("/glamis/start-interview", response_model=GLAMISResponse)
def glamis_start_interview(
    payload: GLAMISRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
    tts_service: TextToSpeechService = Depends(get_tts_service),
) -> GLAMISResponse:
    try:
        internal_request = GLAMISAdapter.convert_request_to_internal(payload)
        interview_type = GLAMISAdapter.get_interview_type(payload)

        session = orchestrator.memory.create_glamis_session(
            candidate_name=payload.metadata.get("candidate_name", "Candidate"),
            role=payload.metadata.get("role", "Software Engineer"),
            experience=payload.metadata.get("experience", "0-2 years"),
            skills=payload.metadata.get("skills", []),
            interview_type=interview_type.value,
            subject=internal_request.get("subject"),
            company=internal_request.get("company"),
            job_title=internal_request.get("job_title"),
            jd_details=internal_request.get("jd_details"),
            svar_type=internal_request.get("svar_type"),
            resume_text=payload.resume_text,
            student_id=payload.student_id,
        )

        profile = orchestrator.memory.get_student_profile(
            payload.metadata.get("candidate_name", "Candidate"),
            student_id=payload.student_id,
        )
        if profile["weak_areas"]:
            for area, freq in profile["weak_areas"].items():
                orchestrator.memory.update_weak_areas(session.id, area, frequency=freq)
        if profile["strong_areas"]:
            for area, freq in profile["strong_areas"].items():
                orchestrator.memory.update_strong_areas(session.id, area, frequency=freq)

        first_question_result = orchestrator.generate_first_question(
            session.id, interview_type,
            # Ignored by every agent except PsychometricAgent (all declare
            # **kwargs) — the ephemeral per-batch admin bank lives in the
            # Node backend's own MongoDB, not here, so Node selects the next
            # unused bank question (if any) and passes it through as-is.
            bank_question=payload.metadata.get("bank_question"),
            pillar=payload.metadata.get("pillar"),
            response_type=payload.metadata.get("response_type"),
            question_number=1,
        )
        first_question = orchestrator.store_generated_question(session.id, first_question_result, is_follow_up=False)
        audio_url = tts_service.generate_audio(first_question)

        return GLAMISAdapter.convert_response_to_glamis(
            session_id=session.id,
            next_question=first_question,
            audio_url=audio_url,
            interview_type=interview_type.value,
            metadata=_response_metadata_for(payload.metadata, first_question_result),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/glamis/submit-answer", response_model=GLAMISResponse)
def glamis_submit_answer(
    payload: GLAMISRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
    tts_service: TextToSpeechService = Depends(get_tts_service),
) -> GLAMISResponse:
    try:
        session_id = payload.interviewId
        if not session_id:
            raise ValueError("interviewId is required")

        session = orchestrator.memory.get_session(session_id)
        interview_type = GLAMISAdapter.get_interview_type(payload)

        evaluation = orchestrator.evaluate_answer_for_glamis(
            session_id=session_id,
            answer=payload.answer or "",
            interview_type=interview_type,
        )

        if evaluation.get("overall_score", 0) < 6:
            for weakness in evaluation.get("weaknesses", []):
                orchestrator.memory.update_weak_areas(session_id, weakness)
        else:
            for strength in evaluation.get("strengths", []):
                orchestrator.memory.update_strong_areas(session_id, strength)

        follow_up_needed = GLAMISAdapter.should_generate_followup(
            interview_type=interview_type,
            score=evaluation.get("overall_score", 0),
            evaluation=evaluation,
        )

        is_completed = (
            session.questions_asked >= orchestrator.settings.interview_max_questions
            or payload.metadata.get("action") in ("finish", "cancel", "timeout")
            or payload.metadata.get("finished") is True
            or payload.metadata.get("cancelled") is True
            or payload.metadata.get("timeout") is True
        )

        if is_completed:
            adjusted_difficulty = orchestrator.adjust_difficulty_for_glamis(
                session_id=session_id,
                score=evaluation.get("overall_score", 0),
            )
            completed_at = datetime.now(timezone.utc)
            created_at_val = session.created_at
            if created_at_val:
                if created_at_val.tzinfo is None:
                    created_at_val = created_at_val.replace(tzinfo=timezone.utc)
                duration = int((completed_at - created_at_val).total_seconds())
            else:
                duration = 0

            final_score = 0.0
            try:
                report_data = orchestrator.get_report(session_id)
                final_score = float(report_data.get("overall_score", 0.0))
            except Exception:
                report_data = {}
                final_score = float(evaluation.get("overall_score", 0.0))

            orchestrator.memory.complete_session(
                session_id=session_id,
                completed_at=completed_at,
                duration=duration,
                final_score=final_score,
            )

            return GLAMISAdapter.convert_response_to_glamis(
                session_id=session_id,
                next_question=None,
                evaluation=evaluation,
                difficulty=adjusted_difficulty,
                interview_complete=True,
                audio_url=None,
                follow_up_question=None,
                interview_type=interview_type.value,
                metadata=payload.metadata,
            )

        current_q_obj = orchestrator.memory.get_latest_question(session_id)
        already_a_followup = getattr(current_q_obj, "is_follow_up", False)
        use_followup = (
            not already_a_followup
            and follow_up_needed
            and evaluation.get("follow_up_needed", False)
        )

        def _generate_question():
            if use_followup:
                return orchestrator.generate_followup_question(session_id), True
            return orchestrator.generate_next_question(
                session_id, interview_type,
                bank_question=payload.metadata.get("bank_question"),
                pillar=payload.metadata.get("pillar"),
                response_type=payload.metadata.get("response_type"),
                question_number=payload.metadata.get("next_question_no"),
            ), False

        adjusted_difficulty = orchestrator.adjust_difficulty_for_glamis(
            session_id=session_id,
            score=evaluation.get("overall_score", 0),
        )
        next_result, is_follow_up = _generate_question()

        next_question = orchestrator.store_generated_question(session_id, next_result, is_follow_up=is_follow_up)
        audio_url = tts_service.generate_audio(next_question) if next_question else None
        follow_up_question = next_question if is_follow_up else None

        return GLAMISAdapter.convert_response_to_glamis(
            session_id=session_id,
            next_question=next_question,
            evaluation=evaluation,
            difficulty=adjusted_difficulty,
            interview_complete=False,
            audio_url=audio_url,
            follow_up_question=follow_up_question,
            interview_type=interview_type.value,
            metadata=_response_metadata_for(payload.metadata, next_result),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/interview/question")
def api_interview_question(
    payload: QuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    if not payload.prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    question_text = orchestrator.generate_glamis_question(
        interview_type="raw",
        difficulty="Medium",
        conversation_history=[],
        prompt=payload.prompt,
        system_instruction=payload.system_instruction,
        model=payload.model,
        max_tokens=payload.max_tokens,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/coding")
def api_interview_coding(
    payload: CodingQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    """Coding round: appended after Easy/Medium/Hard are exhausted (see the
    Node backend's generateQuestionForJDAdmin/generateQuestionForSubjectAdmin).
    Not restricted to DSA - the prompt picks whatever category (DSA, SQL,
    framework-specific, etc.) best fits domain_context."""
    result = orchestrator.generate_coding_question(
        domain_context=payload.domain_context,
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        jd_details=payload.jd_details,
        session_id=payload.interview_id,
    )
    return {"question": result.question, "source": "llm"}


@router.post("/interview/jd-bank-gap")
def api_interview_jd_bank_gap(
    payload: BankSkillGapRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    """One-shot check: which JD skills does this admin's own question bank
    never mention? Called only from the Node backend's background
    computeBankSkillGapsForJDAdmin at interview-creation time - never from the
    live per-turn question path - so its cost (one cached LLM extraction call)
    never lands on a candidate's interview latency. The result is persisted on
    the AdminInterview doc and read back for free on every later turn."""
    if not payload.jd_details:
        return {"uncovered_skills": []}
    from services.retrieval.jd_skill_extractor import extract_jd_skills_llm

    skills = extract_jd_skills_llm(payload.jd_details, payload.job_title, orchestrator.openai_service)
    bank_lower = (payload.bank_text or "").lower()
    uncovered = [s for s in skills if s.lower() not in bank_lower]
    return {"uncovered_skills": uncovered[:10]}


@router.post("/interview/evaluate-code")
def api_interview_evaluate_code(
    payload: CodeEvaluationRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    """Grades a code submission by having the LLM read it - logic and
    structure only, never executed. Response keys are camelCase to match the
    Node backend's evaluateCodeAnswer (interview.controller.js)."""
    result = orchestrator.evaluate_code_answer(
        question=payload.question,
        code=payload.code,
        difficulty=payload.difficulty,
    )
    return {
        "overallScore": result.overall_score,
        "correctnessScore": result.correctness_score,
        "structureScore": result.structure_score,
        "pros": result.pros,
        "cons": result.cons,
        "expectedApproach": result.expected_approach,
        "detailedFeedback": result.detailed_feedback.model_dump() if result.detailed_feedback else None,
        "scoringParameters": result.scoring_parameters.model_dump() if result.scoring_parameters else None,
    }


@router.post("/interview/evaluate")
def api_interview_evaluate(
    payload: EvaluateRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    evaluation = orchestrator.evaluate_glamis_answer(
        question=payload.question,
        answer=payload.answer,
        interview_type=payload.interview_type,
        difficulty=payload.difficulty,
        pillar=payload.pillar,
        response_type=payload.response_type,
        options=payload.options,
    )
    return {"evaluation": evaluation}


@router.post("/interview/followup")
def api_interview_followup(
    payload: FollowupRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    try:
        result = orchestrator.generate_followup_question(payload.session_id)
        return {"follow_up_question": result.question}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/interview/resume")
def api_interview_resume(
    payload: ResumeQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="question_generator",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        resume_text=payload.resume_text,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/prefetch-context")
def api_prefetch_interview_context(payload: PrefetchContextRequest) -> dict:
    prefetch_grounding(
        _prefetch_web_search_service,
        payload.interview_type,
        subject=payload.subject,
        company=payload.company,
        role=payload.job_title,
        web_search_enabled=payload.web_search_enabled,
    )
    return {"status": "prefetching"}


@router.post("/interview/jd")
def api_interview_jd(
    payload: JDQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="company",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        company=payload.selected_company,
        job_title=payload.job_title,
        jd_details=payload.jd_details,
        resume_text=payload.resume_text,
        web_search_enabled=payload.web_search_enabled,
        question_bank_id=payload.question_bank_id,
        question_bank_ratio=payload.question_bank_ratio,
        next_question_no=payload.next_question_no,
        interviewId=payload.interview_id,
        total_questions=payload.total_questions,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/adaptive/next")
def api_interview_adaptive_next(payload: AdaptiveNextRequest):
    """Produce the next question through the adaptive engine and return it with
    its full audit metadata (source, blueprint bucket, difficulty, web query)."""
    from interview_agents.interview_engine.engine import EngineConfig
    from interview_agents.interview_engine.session import produce

    cfg = EngineConfig(
        interview_id=payload.interview_id,
        role=payload.role or payload.company or "Software Engineer",
        company=payload.company,
        jd=payload.jd_details,
        resume=payload.resume_text,
        total_questions=max(1, payload.total_questions),
        interview_type=payload.interview_type,
        question_bank_id=(payload.question_bank_id or None),
        web_available=payload.web_search_enabled,
    )
    turn = produce(cfg, payload.question_no)
    m = turn.meta
    return {
        "question": turn.question,
        "difficulty": m.difficulty,
        "bucket": m.bucket,
        "subtopic": m.subtopic,
        "source": m.source,
        "planned_source": m.planned_source,
        "web_query": m.web_query,
        "source_fallback_reason": m.source_fallback_reason,
        "dedup_regens": m.dedup_regens,
    }


@router.post("/interview/adaptive/evaluate")
def api_interview_adaptive_evaluate(payload: AdaptiveEvaluateRequest):
    """Score an answer with the discriminating evaluator, advance difficulty for
    the next turn, and return the dimensional breakdown plus any follow-up."""
    from interview_agents.interview_engine.session import record

    turn = record(payload.interview_id, payload.question_no, payload.answer)
    if turn is None or turn.evaluation is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="no adaptive session/turn for this interview",
        )
    ev = turn.evaluation
    decision = turn.difficulty_decision or {}
    return {
        "overall_score": ev.total,
        "band": ev.band,
        "dimensions": ev.dimensions.as_dict(),
        "topics": ev.topics,
        "justification": ev.justification,
        "bucket": turn.meta.bucket,
        "source": turn.meta.source,
        "difficulty": turn.meta.difficulty,
        "web_query": turn.meta.web_query,
        "follow_up": turn.follow_up,
        "next_difficulty": decision.get("new_level"),
        "difficulty_decision": decision,
    }


@router.post("/interview/subject")
def api_interview_subject(
    payload: SubjectQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="subject",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        subject=payload.subject,
        web_search_enabled=payload.web_search_enabled,
        question_bank_id=payload.question_bank_id,
        question_bank_ratio=payload.question_bank_ratio,
        next_question_no=payload.next_question_no,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/verbal")
def api_interview_verbal(
    payload: VerbalQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="verbal",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        answer=payload.answer,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/hr")
def api_interview_hr(
    payload: HrQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="hr",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        answer=payload.answer,
        resume_text=payload.resume_text,
        # Optional grounding context - passed through to the HR agent so it can
        # ask company- / role-specific behavioral questions when available.
        company=payload.company,
        position=payload.position,
        job_description=payload.job_description,
        total_questions=payload.total_questions,
        candidate_name=payload.candidate_name,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/written")
def api_interview_written(
    payload: WrittenQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="written",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        subject=payload.subject,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/svar")
def api_interview_svar(
    payload: SvarQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    question_text = orchestrator.generate_glamis_question(
        interview_type="svar",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
    )
    if isinstance(question_text, dict):
        question_text = question_text.get("question", "")
    return {"question": question_text}


@router.post("/interview/psychometric")
def api_interview_psychometric(
    payload: PsychometricQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    # Unlike every other /interview/{type} route above, this returns the full
    # dict (not just {"question": ...}) — the frontend needs the actual
    # option list/pillar/response_type to render its 13 answer controls, not
    # just question text.
    return orchestrator.generate_glamis_question(
        interview_type="psychometric",
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
        candidate_name=payload.candidate_name,
        bank_question=payload.bank_question,
        pillar=payload.pillar,
        response_type=payload.response_type,
        next_question_no=payload.next_question_no,
        seed=payload.seed,
    )


@router.post("/interview/prefetch-next")
def api_prefetch_next(
    payload: PrefetchNextQuestionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    try:
        total_questions = len(payload.conversation_history) + 5
        source = QuestionSourceRouter.determine_source(
            turn_no=payload.next_question_no,
            total_questions=total_questions,
            interview_mode=payload.interview_mode,
            question_bank_id=payload.question_bank_id,
            interview_type=payload.interview_type,
            session_id=payload.interview_id
        )

        question_text = ""
        context = {
            "question_bank_id": payload.question_bank_id,
            "company": payload.selected_company,
            "subject": payload.subject,
            "role": payload.job_title,
            "job_title": payload.job_title,
            "jd_details": payload.jd_details,
            "difficulty": payload.difficulty,
        }

        pdf_name = ""
        chunk_id = ""
        similarity = 0.0

        if source == "qb" and payload.question_bank_id:
            ret_payload = orchestrator.retriever.retrieve(
                context=context,
                limit=3
            )
            candidates = ret_payload.get("candidates") or []
            if candidates:
                selected = candidates[0]
                meta = selected.get("metadata") or {}
                pdf_name = meta.get("pdf_name") or meta.get("source_file") or "unknown"
                chunk_id = meta.get("chunk_id") or selected.get("id") or ""
                similarity = selected.get("score") or selected.get("ranking_score") or 0.8
                
                original_q = meta.get("original_question")
                if not original_q:
                    doc_text = selected.get("document", "")
                    for sep in ("\n\nExpected:", "Expected:", "\n\nAnswer:", "Answer:", "Question:"):
                        if sep in doc_text:
                            doc_text = doc_text.split(sep)[0].strip()
                    original_q = doc_text.replace("Question:", "").strip()
                question_text = original_q
            
            if not question_text:
                source = "llm"

        if source == "web":
            question_text = orchestrator.generate_glamis_question(
                interview_type=payload.interview_type,
                difficulty=payload.difficulty,
                conversation_history=payload.conversation_history,
                company=payload.selected_company,
                job_title=payload.job_title,
                jd_details=payload.jd_details,
                subject=payload.subject,
                web_search_enabled=True,
                resume_text=payload.resume_text or "",
            )

        if source == "llm" or not question_text:
            question_text = orchestrator.generate_glamis_question(
                interview_type=payload.interview_type,
                difficulty=payload.difficulty,
                conversation_history=payload.conversation_history,
                company=payload.selected_company,
                job_title=payload.job_title,
                jd_details=payload.jd_details,
                subject=payload.subject,
                web_search_enabled=False,
                resume_text=payload.resume_text or "",
            )

        if isinstance(question_text, dict):
            question_text = question_text.get("question", "")

        return {
            "question": question_text,
            "source": source,
            "difficulty": payload.difficulty,
            "pdf_name": pdf_name if source == "qb" else None,
            "chunk_id": chunk_id if source == "qb" else None,
            "question_bank_id": payload.question_bank_id if source == "qb" else None,
            "similarity": similarity if source == "qb" else 0.0
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
