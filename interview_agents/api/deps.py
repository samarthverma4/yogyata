import logging
import time

from fastapi import Depends
from sqlalchemy.orm import Session

from interview_agents.database.session import get_db
from interview_agents.services.interview_service import InterviewOrchestrator

_deps_logger = logging.getLogger("app.latency")


def get_interview_orchestrator(db: Session = Depends(get_db)) -> InterviewOrchestrator:
    """Create an orchestrator bound to the request database session."""

    _t = time.time()
    orch = InterviewOrchestrator(db)
    _deps_logger.info("[LATENCY] orchestrator construct: %.0fms", (time.time() - _t) * 1000)
    return orch
