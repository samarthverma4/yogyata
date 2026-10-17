"""Public integration surface for opportunity matching.

Opportunities are supplied by the backend; this module never invents or fetches any. Invalid
opportunity records are skipped and reported in `warnings` instead of failing the whole request.
"""
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.common.similarity import SimilarityBackend

from .eligibility import check_eligibility, eligibility_status
from .ranker import rank_opportunities
from .schemas import MatchWeights, Opportunity


def _parse_opportunities(raw: list[dict[str, Any]]) -> tuple[list[Opportunity], list[str]]:
    ok, warnings = [], []
    for i, item in enumerate(raw or []):
        try:
            ok.append(Opportunity(**item))
        except (ValidationError, TypeError) as exc:
            warnings.append(f"Opportunity #{i} (id={item.get('id') if isinstance(item, dict) else '?'}) skipped: invalid record "
                            f"({type(exc).__name__}).")
    return ok, warnings


def match_opportunities(payload: dict[str, Any], *, backend: SimilarityBackend | None = None) -> dict[str, Any]:
    """payload: {"profile": StudentProfile dict, "opportunities": [Opportunity dict],
    "weights"?: MatchWeights dict, "top_k"?: int, "include_ineligible"?: bool} -> MatchResult dict."""
    profile = StudentProfile(**payload["profile"])
    opps, warnings = _parse_opportunities(payload.get("opportunities", []))
    weights = MatchWeights(**payload["weights"]) if payload.get("weights") else None
    result = rank_opportunities(profile, opps, weights=weights, backend=backend,
                                top_k=payload.get("top_k"), include_ineligible=bool(payload.get("include_ineligible")))
    result.warnings = warnings + result.warnings
    return result.model_dump(mode="json")


def check_opportunity_eligibility(payload: dict[str, Any]) -> dict[str, Any]:
    """payload: {"profile", "opportunity"} -> {"status", "checks"}."""
    profile = StudentProfile(**payload["profile"])
    opp = Opportunity(**payload["opportunity"])
    checks = check_eligibility(profile, opp)
    return {"status": eligibility_status(checks), "checks": [c.model_dump() for c in checks]}
