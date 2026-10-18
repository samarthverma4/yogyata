from fastapi import APIRouter
from interview_agents.utils.metrics_tracker import get_metrics_summary

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
def get_observability_metrics():
    return get_metrics_summary()
