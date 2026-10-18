"""Service configuration, read once from the environment."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    allowed_origins: tuple[str, ...]
    request_timeout_s: float = 10.0
    # Seconds a verified token is trusted without re-asking Supabase. Short, because this is
    # the window in which a signed-out user could still be served.
    token_cache_ttl_s: float = 60.0


def load_settings() -> Settings:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (see service/README.md)")
    origins = tuple(o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip())
    return Settings(supabase_url=url, supabase_anon_key=key, allowed_origins=origins)
