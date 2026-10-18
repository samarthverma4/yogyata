from fastapi import APIRouter
from interview_agents.api.interview_routes import router as interview_router
from interview_agents.api.report_routes import router as report_router
from interview_agents.api.speech_routes import router as speech_router
from interview_agents.api.metrics_routes import router as metrics_router

router = APIRouter()

# Register core interview agent routes
router.include_router(interview_router)
router.include_router(report_router)
router.include_router(speech_router)
router.include_router(metrics_router)

# Optional routes
try:
    from interview_agents.api.admin_routes import router as admin_router
    router.include_router(admin_router)
except ImportError:
    pass

try:
    from interview_agents.api.svar_routes import router as svar_router
    router.include_router(svar_router)
except ImportError:
    pass
