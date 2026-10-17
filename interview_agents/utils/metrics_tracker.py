import math
import time
from typing import List, Dict, Any

# Latency tracking
_request_latencies: List[float] = []

# RAG tracking
_total_rag_turns: int = 0
_successful_rag_turns: int = 0
_rag_utilizations: List[float] = []

# Web search tracking
_web_search_hits: int = 0
_web_search_misses: int = 0

# Adaptive question-generation tracking (per produced question, not per HTTP request)
_gen_total_ms: List[float] = []
_gen_llm_ms: List[float] = []
_gen_dedup_ms: List[float] = []
_gen_regens: List[float] = []


def record_generation(total_ms: float, llm_ms: float, dedup_ms: float, regens: int) -> None:
    for series, value in (
        (_gen_total_ms, total_ms), (_gen_llm_ms, llm_ms),
        (_gen_dedup_ms, dedup_ms), (_gen_regens, float(regens)),
    ):
        series.append(value)
        if len(series) > 1000:
            series.pop(0)


def record_latency(duration_seconds: float) -> None:
    global _request_latencies
    _request_latencies.append(duration_seconds)
    # Keep only the last 1000 requests to avoid memory growth
    if len(_request_latencies) > 1000:
        _request_latencies.pop(0)


def record_rag_turn(selected: bool, utilization_pct: float) -> None:
    global _total_rag_turns, _successful_rag_turns, _rag_utilizations
    _total_rag_turns += 1
    if selected:
        _successful_rag_turns += 1
    _rag_utilizations.append(utilization_pct)
    if len(_rag_utilizations) > 1000:
        _rag_utilizations.pop(0)


def record_web_search(hit: bool) -> None:
    global _web_search_hits, _web_search_misses
    if hit:
        _web_search_hits += 1
    else:
        _web_search_misses += 1


def get_percentile(data: List[float], percentile: float) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * percentile / 100
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    d0 = sorted_data[int(f)] * (c - k)
    d1 = sorted_data[int(c)] * (k - f)
    return d0 + d1


def get_metrics_summary() -> Dict[str, Any]:
    global _request_latencies, _total_rag_turns, _successful_rag_turns, _rag_utilizations, _web_search_hits, _web_search_misses
    
    # Latency percentiles in milliseconds
    latencies_ms = [l * 1000 for l in _request_latencies]
    p50 = get_percentile(latencies_ms, 50.0)
    p95 = get_percentile(latencies_ms, 95.0)
    p99 = get_percentile(latencies_ms, 99.0)

    # RAG rates
    selected_rate = (
        _successful_rag_turns / _total_rag_turns
        if _total_rag_turns > 0 else 1.0
    )
    avg_utilization = (
        sum(_rag_utilizations) / len(_rag_utilizations)
        if _rag_utilizations else 0.0
    )

    # Web search rates
    total_web = _web_search_hits + _web_search_misses
    hit_rate = _web_search_hits / total_web if total_web > 0 else 1.0
    fallback_rate = _web_search_misses / total_web if total_web > 0 else 0.0

    # Retrieve cache metrics if possible
    retrieval_cache_metrics = {
        "hits": 0,
        "misses": 0,
        "evictions": 0,
        "expired": 0
    }
    try:
        from services.retrieval.retrieval_cache import RetrievalCache
        rc = RetrievalCache()
        rc_m = rc.get_metrics()
        retrieval_cache_metrics = {
            "hits": rc_m.get("hits", 0),
            "misses": rc_m.get("misses", 0),
            "evictions": rc_m.get("evictions", 0),
            "expired": rc_m.get("expired_entries", 0),
        }
    except Exception:
        pass

    # Embedding cache metrics if possible
    embedding_cache_metrics = {
        "pending_writes": 0,
        "last_flush": None
    }
    try:
        from services.vector_store.embedding_cache import EmbeddingCache
        ec = EmbeddingCache()
        ec_m = ec.get_metrics()
        embedding_cache_metrics = {
            "pending_writes": ec_m.get("pending_writes", 0),
            "last_flush": ec_m.get("last_flush_time") or ec_m.get("last_flush")
        }
    except Exception:
        pass

    return {
        "retrieval_cache": retrieval_cache_metrics,
        "embedding_cache": embedding_cache_metrics,
        "rag_metrics": {
            "utilization_pct": avg_utilization,
            "selected_rate": selected_rate
        },
        "latency": {
            "p50": round(p50, 1),
            "p95": round(p95, 1),
            "p99": round(p99, 1)
        },
        "question_generation": {
            "samples": len(_gen_total_ms),
            "total_p50": round(get_percentile(_gen_total_ms, 50.0), 1),
            "total_p95": round(get_percentile(_gen_total_ms, 95.0), 1),
            "llm_p50": round(get_percentile(_gen_llm_ms, 50.0), 1),
            "dedup_p50": round(get_percentile(_gen_dedup_ms, 50.0), 1),
            "regen_rate": round(
                sum(1 for r in _gen_regens if r > 0) / len(_gen_regens), 3
            ) if _gen_regens else 0.0,
        },
        "web_search": {
            "hit_rate": hit_rate,
            "fallback_rate": fallback_rate
        }
    }
