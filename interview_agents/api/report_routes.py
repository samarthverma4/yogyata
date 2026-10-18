from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from interview_agents.api.deps import get_interview_orchestrator
from interview_agents.services.interview_service import InterviewOrchestrator
from interview_agents.schemas.interview import InterviewReportResponse
from interview_agents.schemas.glamis import GLAMISReportResponse

router = APIRouter(tags=["report"])


class ReportRequest(BaseModel):
    session_id: str


@router.get("/interview-report/{session_id}", response_model=InterviewReportResponse)
@router.get("/interview/{session_id}/report", response_model=InterviewReportResponse)
def interview_report(
    session_id: str,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
) -> InterviewReportResponse:
    try:
        report = orchestrator.get_report(session_id)
        return InterviewReportResponse(session_id=session_id, report=report)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/interview/report")
def api_interview_report(
    payload: ReportRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    try:
        report = orchestrator.get_report(payload.session_id)
        return {"report": report}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/glamis/report/{session_id}", response_model=GLAMISReportResponse)
def glamis_interview_report(
    session_id: str,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
) -> GLAMISReportResponse:
    try:
        session = orchestrator.memory.get_session(session_id)
        report = orchestrator.get_report(session_id)

        weak_areas = orchestrator.memory.get_weak_areas(session_id, top_n=5)
        strong_areas = orchestrator.memory.get_strong_areas(session_id, top_n=5)

        return GLAMISReportResponse(
            interviewId=session_id,
            candidate_name=session.candidate_name,
            subject=session.subject,
            interview_type=session.interview_type,
            total_questions=session.questions_asked,
            average_score=report.get("overall_score", 0),
            technical_score=report.get("technical_score", 0),
            communication_score=report.get("communication_score", 0),
            overall_score=report.get("overall_score", 0),
            strengths=list(strong_areas.keys()),
            weaknesses=list(weak_areas.keys()),
            recommendations=report.get("recommendations", []),
            summary=report.get("summary", ""),
            interview_outcome=report.get("interview_outcome", ""),
            duration=report.get("duration"),
            question_statistics=report.get("question_statistics"),
            feedback=report.get("feedback"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
