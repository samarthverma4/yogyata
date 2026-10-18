from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager

# Real-time agent traces (and any LLM-text in logs) print safely as UTF-8 even
# when the server's stdout is redirected to a file on Windows.
try:
    if hasattr(sys.stdout, "reconfigure"):
        getattr(sys.stdout, "reconfigure")(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        getattr(sys.stderr, "reconfigure")(encoding="utf-8")
except Exception:
    pass

# Ensure directory is in sys.path for module resolution
_this_dir = os.path.dirname(os.path.abspath(__file__))
_pkg_root = os.path.dirname(_this_dir)
for p in (_this_dir, _pkg_root):
    if p not in sys.path:
        sys.path.insert(0, p)

import interview_agents  # triggers app alias mapping

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from interview_agents.api.routes import router
from interview_agents.config.settings import get_settings
from interview_agents.database.session import init_db
from interview_agents.services.speech_to_text_service import get_stt_service
from interview_agents.services.text_to_speech_service import get_tts_service

settings = get_settings()

# settings.log_level was previously read but never applied - app-level
# logger.info/warning calls (e.g. WebSearchService's query/result-count logs)
# were silently dropped since the root logger defaults to WARNING.
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))

logger = logging.getLogger(__name__)


def _warm_openai_connections() -> None:
    """Pre-establish TCP/TLS connections to OpenAI in the background at
    startup so the first real TTS/STT call of the first real interview
    doesn't pay the ~2-3s handshake cost. TTS and STT each cache their own
    OpenAI client (own connection pool), so each needs its own warmup call.
    Fire-and-forget on daemon threads: startup must never block on this, and
    a warmup failure (e.g. no network yet) must never prevent the app from
    serving real traffic."""
    import threading

    def _warm(get_service, label: str) -> None:
        try:
            client = get_service()._get_openai_client()
            client.models.list()
            logger.info("Warmed OpenAI connection for %s", label)
        except Exception:
            logger.warning("OpenAI connection warmup failed for %s (will retry on first real call)", label, exc_info=True)

    threading.Thread(target=_warm, args=(get_tts_service, "TTS"), daemon=True).start()
    threading.Thread(target=_warm, args=(get_stt_service, "STT"), daemon=True).start()


def _warm_orchestrator() -> None:
    """Pre-build one throwaway InterviewOrchestrator at startup so the first
    real question doesn't pay for it. That constructor cold-imports chromadb,
    opens its persistent vector store, connects to MongoDB, and loads the
    embedding cache from disk - ~8s the first time it runs in this process
    ([LATENCY] orchestrator construct in the logs). Every InterviewOrchestrator
    built after this one reuses the now-cached chromadb module import and its
    already-open PersistentClient for the same path, so real requests build in
    milliseconds instead. Fire-and-forget on a daemon thread, same as
    _warm_openai_connections: startup must never block on this, and a failure
    here must never stop the app from serving real traffic."""
    import threading

    def _warm() -> None:
        from interview_agents.database.session import SessionLocal
        from interview_agents.services.interview_service import InterviewOrchestrator

        db = SessionLocal()
        try:
            InterviewOrchestrator(db)
            logger.info("Warmed interview orchestrator (chromadb/mongo/embedding cache)")
        except Exception:
            logger.warning("Interview orchestrator warmup failed (will retry on first real request)", exc_info=True)
        finally:
            db.close()

    threading.Thread(target=_warm, daemon=True).start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    # Ensure static audio directory exists
    os.makedirs(settings.tts_audio_dir, exist_ok=True)

    # Configure remote OpenAI transcription model at startup
    get_stt_service().initialize(settings.whisper_model, settings.whisper_device)

    _warm_openai_connections()
    _warm_orchestrator()

    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

    # Load allowed CORS origins
    cors_origins_env = os.getenv("CORS_ORIGINS", "")
    allowed_origins = []
    if cors_origins_env:
        allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    
    # Maintain localhost, 127.0.0.1, glamis.in, admin.glamis.in and development ports
    default_origins = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:4000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://localhost:8001",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8001",
        "https://glamis.co.in",
        "https://www.glamis.co.in",
        "https://student.glamis.co.in",
        "https://admin.glamis.co.in",
        "https://api.glamis.co.in",
        "http://glamis.co.in",
        "http://www.glamis.co.in",
        "http://student.glamis.co.in",
        "http://admin.glamis.co.in",
        "http://api.glamis.co.in",
        "https://glamis.in",
        "https://admin.glamis.in",
    ]
    for origin in default_origins:
        if origin not in allowed_origins:
            allowed_origins.append(origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https?://([a-z0-9-]+\.)*glamis\.(co\.in|in)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Ensure static directory exists before mounting
    from pathlib import Path
    package_root = Path(__file__).resolve().parent.parent
    static_dir = os.path.join(package_root, "static")
    os.makedirs(static_dir, exist_ok=True)
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    import time
    from interview_agents.utils.metrics_tracker import record_latency

    @app.middleware("http")
    async def log_latency_middleware(request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        if request.url.path.startswith(settings.api_v1_prefix):
            record_latency(process_time)
        return response

    app.include_router(router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
