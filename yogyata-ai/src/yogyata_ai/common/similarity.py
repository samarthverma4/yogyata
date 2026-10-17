"""Pluggable text-similarity backends (TF-IDF default; Sentence Transformers optional).

Both backends expose `similarity(a, b) -> float in [0, 1]`.
"""
from __future__ import annotations

from typing import Protocol

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .config import Settings


class SimilarityBackend(Protocol):
    def similarity(self, a: str, b: str) -> float: ...

    def similarities(self, query: str, docs: list[str]) -> list[float]: ...


class TfidfSimilarity:
    """Pairwise TF-IDF cosine similarity. Fitted on the two texts only (no corpus needed).

    Pretrained: no. Trained: no (a vectorizer is fitted per call; nothing persists).
    """

    def similarity(self, a: str, b: str) -> float:
        if not a.strip() or not b.strip():
            return 0.0
        try:
            vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
            m = vec.fit_transform([a, b])
        except ValueError:  # empty vocabulary after stop-word removal
            return 0.0
        return float(max(0.0, min(1.0, cosine_similarity(m[0], m[1])[0, 0])))

    def similarities(self, query: str, docs: list[str]) -> list[float]:
        return _tfidf_corpus_similarities(query, docs)


def _tfidf_corpus_similarities(query: str, docs: list[str]) -> list[float]:
    """Cosine similarity of `query` to each doc, with the vocabulary/IDF fitted on query + all docs."""
    if not docs:
        return []
    if not query.strip():
        return [0.0] * len(docs)
    try:
        m = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit_transform([query] + list(docs))
    except ValueError:
        return [0.0] * len(docs)
    sims = cosine_similarity(m[0], m[1:])[0]
    return [float(max(0.0, min(1.0, x))) for x in sims]


class EmbeddingSimilarity:
    """Cosine similarity of pretrained Sentence Transformer embeddings (optional extra)."""

    def __init__(self, model_name: str):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:  # pragma: no cover - depends on optional extra
            raise RuntimeError(
                "Embedding backend requested but sentence-transformers is not installed. "
                "Install with: pip install 'yogyata-ai[embeddings]'"
            ) from exc
        self._model = SentenceTransformer(model_name)

    def similarity(self, a: str, b: str) -> float:  # pragma: no cover - needs model download
        if not a.strip() or not b.strip():
            return 0.0
        ea, eb = self._model.encode([a, b], normalize_embeddings=True)
        return float(max(0.0, min(1.0, float(ea @ eb))))

    def similarities(self, query: str, docs: list[str]) -> list[float]:  # pragma: no cover - needs model download
        if not docs:
            return []
        if not query.strip():
            return [0.0] * len(docs)
        vecs = self._model.encode([query] + list(docs), normalize_embeddings=True)
        return [float(max(0.0, min(1.0, float(vecs[0] @ v)))) for v in vecs[1:]]


def get_backend_with_status(settings: Settings | None = None) -> tuple[SimilarityBackend, str]:
    """Return (backend, status). Falls back to TF-IDF, with a status message, if embeddings are
    requested but unavailable (package missing, model not downloadable, ...)."""
    settings = settings or Settings.from_env()
    if settings.similarity_backend == "embeddings":
        try:
            return EmbeddingSimilarity(settings.embedding_model), f"embeddings:{settings.embedding_model}"
        except Exception as exc:  # noqa: BLE001 - any load failure must degrade gracefully
            return TfidfSimilarity(), f"tfidf (embeddings unavailable: {type(exc).__name__})"
    return TfidfSimilarity(), "tfidf"


def get_backend(settings: Settings | None = None) -> SimilarityBackend:
    """Backend only; degrades to TF-IDF if embeddings are unavailable (see get_backend_with_status)."""
    return get_backend_with_status(settings)[0]
