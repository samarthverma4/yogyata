"""Central configuration, read from environment variables with safe defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    similarity_backend: str = "tfidf"  # "tfidf" | "embeddings"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    llm_provider: str = ""  # empty = LLM disabled; "mock" = built-in scripted mock
    llm_timeout_s: float = 20.0
    taxonomy_path: str = ""  # empty = bundled demo taxonomy

    @classmethod
    def from_env(cls) -> "Settings":
        try:
            timeout = float(os.getenv("YOGYATA_LLM_TIMEOUT_S", "20"))
        except ValueError:
            timeout = 20.0
        return cls(
            similarity_backend=os.getenv("YOGYATA_SIMILARITY_BACKEND", "tfidf").strip().lower(),
            embedding_model=os.getenv(
                "YOGYATA_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
            ),
            llm_provider=os.getenv("YOGYATA_LLM_PROVIDER", "").strip().lower(),
            llm_timeout_s=timeout if timeout > 0 else 20.0,
            taxonomy_path=os.getenv("YOGYATA_TAXONOMY_PATH", "").strip(),
        )
