import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TTS_AUDIO_DIR = os.path.join(PROJECT_ROOT, "static", "audio")



class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Mock Interview Agent"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(default="sqlite:///./ai_mock_interview_agent.db")

    openai_api_key: str = Field(default="", env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", env="OPENAI_MODEL")
    openai_temperature: float = Field(default=0.2, env="OPENAI_TEMPERATURE")
    openai_timeout_seconds: int = Field(default=60, env="OPENAI_TIMEOUT_SECONDS")
    openai_max_retries: int = Field(default=3, env="OPENAI_MAX_RETRIES")

    interview_success_threshold: int = Field(default=7)
    interview_max_questions: int = Field(default=10)
    easy_score_threshold: int = Field(default=5)
    hard_score_threshold: int = Field(default=8)

    log_level: str = Field(default="INFO")

    # Default transcription model for every round. gpt-4o-mini-transcribe is
    # cheaper and faster than whisper-1 and returns the same {"text": ...} shape,
    # so the existing transcribe() callers are unaffected.
    whisper_model: str = Field(default="gpt-4o-mini-transcribe", env=["OPENAI_WHISPER_MODEL", "WHISPER_MODEL"])
    whisper_device: Optional[str] = Field(default=None)
    whisper_max_duration_seconds: int = Field(default=300)
    # Word-level timestamps are an OpenAI capability of whisper-1 ONLY: they need
    # response_format="verbose_json" + timestamp_granularities=["word"], which the
    # gpt-4o-*-transcribe models do not accept. SVAR delivery scoring (speaking
    # rate, pauses) depends on them, so that one call keeps its own model.
    stt_timings_model: str = Field(default="whisper-1", env=["OPENAI_STT_TIMINGS_MODEL", "STT_TIMINGS_MODEL"])

    tts_enabled: bool = Field(default=True)
    tts_model: str = Field(default="gpt-4o-mini-tts", env=["OPENAI_TTS_MODEL", "TTS_MODEL"])
    tts_voice: str = Field(default="alloy", env=["OPENAI_TTS_VOICE", "TTS_VOICE"])
    tts_voice_language: str = Field(default="en")
    tts_response_format: str = Field(default="mp3", env=["OPENAI_TTS_RESPONSE_FORMAT", "TTS_RESPONSE_FORMAT"])
    tts_audio_dir: str = Field(default=DEFAULT_TTS_AUDIO_DIR)

    # GLAMIS Admin Automation Integration settings
    glamis_backend_url: str = Field(default="http://localhost:8001")
    glamis_admin_email: str = Field(default="admin@glamis.in")
    glamis_admin_password: str = Field(default="demo123")
    mongodb_url: Optional[str] = Field(default=None)

    # Backs the web-search cache (see web_search_service.py). Optional - falls
    # back to an in-process dict if unset or unreachable, so this is never a
    # hard dependency for search to keep working.
    redis_url: Optional[str] = Field(default="redis://localhost:6379", env="REDIS_URL")

    # Set to false to skip ChromaDB retrieval and go directly to specialized agents.
    # Keep false while the ChromaDB collection holds mock embeddings (score ≈ -422)
    # to avoid a wasted OpenAI embedding API call on every question generation.
    rag_enabled: bool = Field(default=False, env="RAG_ENABLED")
    # Embed the retrieval query synchronously on the request thread. Default True:
    # question generation runs in a background prefetch turn (the candidate is
    # answering the previous question, not waiting), so the old "never embed in the
    # request thread" latency guarantee protected a path that is already off the
    # user's critical path — and skipping it returned 0 candidates (no grounding).
    # Set RAG_SYNC_EMBEDDING=false to restore the background-warm-only behaviour
    # (the background-warm code path in embedding_service is preserved either way).
    rag_sync_embedding: bool = Field(default=True, env="RAG_SYNC_EMBEDDING")

    # Tavily web search (optional) - grounds question generation with live company/role
    # context when a request opts in via web_search_enabled. Empty = feature is inert.
    tavily_api_key: str = Field(default="", env="TAVILY_API_KEY")
    # Comma-separated domain allow/block lists, e.g. "glassdoor.com,leetcode.com".
    # Empty = unrestricted. Use to keep low-quality SEO/listicle content out of
    # the grounding context without a code change.
    tavily_include_domains: str = Field(default="", env="TAVILY_INCLUDE_DOMAINS")
    tavily_exclude_domains: str = Field(default="", env="TAVILY_EXCLUDE_DOMAINS")



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached settings instance."""

    return Settings()
