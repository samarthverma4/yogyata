from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from yogyata_ai.skill_gap.roles import RoleCatalog, default_catalog

from .analytics import analyze_cohort
from .schemas import CohortRecord

MIN_K = 5


def cohort_analytics(records: list[dict[str, Any]], *, group_by: str = "department", k: int = 10,
                     default_role_id: str | None = None, roles: RoleCatalog | None = None) -> dict[str, Any]:
    """Aggregate skill/readiness analytics with small-cohort suppression. Individual rows are never returned.

    k below MIN_K is refused (a lower threshold gives no meaningful protection).
    """
    if group_by not in ("department", "program", "graduation_year", "target_role"):
        raise ValueError("group_by must be one of department, program, graduation_year, target_role")
    if k < MIN_K:
        raise ValueError(f"k must be at least {MIN_K}")
    parsed, bad = [], 0
    for r in records:
        try:
            parsed.append(CohortRecord(**r))
        except ValidationError:
            bad += 1
    rep = analyze_cohort(parsed, roles or default_catalog(), group_by=group_by, k=k, default_role_id=default_role_id)
    out = rep.model_dump(mode="json")
    if bad:
        out["warnings"].append(f"{bad} invalid record(s) were rejected (identifying fields are not accepted).")
        out["skipped_records"] += bad
    return out
