"""Independent verification of the assembled response against the tool results and the caller's inputs.

The verifier does not trust the summary, the plan or any LLM output. It re-derives facts from tool results.
"""
from __future__ import annotations

import re
from typing import Any

from .schemas import AgentSession, ProposedAction, Verification
from .tools import CONFIRMABLE_KINDS, USER_ONLY_KINDS

# first-person claims of completed consequential acts / verification
_CLAIMS = re.compile(r"\b(i|we|the assistant|assistant)\b[^.]{0,40}\b(have|has|had|already|successfully|just)?\s*(applied|booked|paid|submitted|purchased|registered|enrolled|sent your application|scheduled)\b", re.I)
_VERIFIED_CLAIM = re.compile(r"\b(is|are|been|now|officially)\s+(verified|certified|competent|proficient)\b", re.I)


def summary_problems(summary: str, allowed_numbers: set[str] | None) -> list[str]:
    issues = []
    if _CLAIMS.search(summary):
        issues.append("summary claims a completed consequential action")
    if _VERIFIED_CLAIM.search(summary):
        issues.append("summary asserts verification/competence")
    nums = set(re.findall(r"\d+(?:\.\d+)?", summary))
    stray = sorted(n for n in nums if allowed_numbers is not None and n not in allowed_numbers)
    if stray:
        issues.append("summary contains numbers not present in tool results: " + ", ".join(stray[:5]))
    return issues


def fact_numbers(results: dict[str, Any]) -> set[str]:
    out: set[str] = set()

    def walk(x):
        if isinstance(x, bool):
            return
        if isinstance(x, (int, float)):
            out.add(f"{x:g}")
            out.add(str(x))
            if isinstance(x, float):
                out.add(f"{x:.1f}")
                out.add(str(int(x)) if x == int(x) else f"{x:g}")
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(results)
    return out


def verify_response(*, results: dict[str, Any], session: AgentSession, proposed: list[ProposedAction], summary: str,
                    known_opportunity_ids: set[str], known_mentor_ids: set[str], max_calls: int, calls_used: int,
                    completed_activity_ids: list[str], task_ids: set[str], base_summary: str) -> Verification:
    checks, issues = [], []

    checks.append("recommended opportunities/mentors/tasks exist in supplied or catalog data")
    for r in (results.get("opportunities") or {}).get("ranked", []):
        if r["opportunity_id"] not in known_opportunity_ids:
            issues.append(f"unknown opportunity id {r['opportunity_id']}")
    for r in (results.get("mentors") or {}).get("ranked", []):
        if r["mentor_id"] not in known_mentor_ids:
            issues.append(f"unknown mentor id {r['mentor_id']}")
    for r in (results.get("tasks") or {}).get("recommendations", []):
        if r["task_id"] not in task_ids:
            issues.append(f"unknown task id {r['task_id']}")

    checks.append("no consequential action executed; user-only kinds never awaiting agent execution")
    for a in proposed:
        if a.executed is not False:
            issues.append(f"action {a.id} marked executed")
        if a.kind in USER_ONLY_KINDS and a.status != "suggested_for_user":
            issues.append(f"user-only action {a.id} in state {a.status}")
        if a.kind not in USER_ONLY_KINDS | CONFIRMABLE_KINDS:
            issues.append(f"action {a.id} has unknown kind {a.kind}")

    checks.append("'verified' skills are backed by human-reviewed evidence in the session")
    reviewed = {e.skill for e in session.evidence if e.verified}
    if session.review_ledger:
        from yogyata_ai.common.audit import verify_log
        from yogyata_ai.skill_gap.review import ReviewLedger
        led = ReviewLedger(**session.review_ledger)
        reviewed |= {e.skill for e in led.evidence_records()}
        checks.append("the review ledger's audit log is intact")
        issues.extend(f"review audit log: {p}" for p in verify_log(led.audit))
    gap = results.get("gap") or {}
    for s in gap.get("skills", []):
        if s["level"] == "verified" and s["skill"] not in reviewed:
            issues.append(f"skill {s['skill']} reported verified without reviewed evidence")

    checks.append("roadmap respects completed activities and the time budget")
    rm = results.get("roadmap") or {}
    done = set(completed_activity_ids)
    for it in rm.get("items", []):
        if it["activity_id"] in done:
            issues.append(f"roadmap repeats completed activity {it['activity_id']}")
    if rm and rm.get("total_hours", 0) > rm.get("constraints", {}).get("hours_budget", 1e9) + 1e-6:
        issues.append("roadmap exceeds hours budget")

    checks.append("tool-call budget respected")
    if calls_used > max_calls:
        issues.append("tool-call budget exceeded")

    checks.append("summary makes no completed-action or verification claims and invents no numbers")
    allowed = fact_numbers(results) | set(re.findall(r"\d+(?:\.\d+)?", base_summary))
    issues += summary_problems(summary, allowed)
    return Verification(passed=not issues, checks_run=checks, issues=issues)
