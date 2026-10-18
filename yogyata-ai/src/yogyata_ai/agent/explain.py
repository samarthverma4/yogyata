"""Summary generation. Deterministic template by default; an optional LLM may rephrase it but is validated and discarded
if it adds numbers, claims actions were taken, or asserts verification."""
from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field

from yogyata_ai.common.llm import LLMAdapter, call_llm_json
from yogyata_ai.common.safety import UNTRUSTED_NOTICE

from .verify import fact_numbers, summary_problems


def deterministic_summary(results: dict, stages_skipped: list[dict], needs_input: list[str], refused: list[dict]) -> str:
    parts: list[str] = []
    g = results.get("gap")
    if g:
        parts.append(f"For the {g['role_title']} path your current evidence-based readiness is {g['readiness_score']:g}/100 "
                     f"(range {g['readiness_min']:g}-{g['readiness_max']:g}); evidence is {g['evidence_sufficiency']}"
                     + ("; nothing is human-verified yet." if g["verified_coverage"] == 0 else "."))
        if g["priority_gaps"]:
            parts.append("Top priorities: " + ", ".join(f"{x['skill']} ({x['status'].replace('_', ' ')})" for x in g["priority_gaps"][:3]) + ".")
        if g["unassessed"]:
            parts.append("Skills with no information yet are unassessed, not weak.")
    rm = results.get("roadmap")
    if rm and rm["items"]:
        first = rm["items"][0]
        parts.append(f"Your roadmap has {len(rm['items'])} steps over {rm['weeks_used']} week(s) ({rm['total_hours']:g}h); it starts with '{first['title']}'.")
    o = results.get("opportunities")
    if o and o["ranked"]:
        parts.append(f"{len(o['ranked'])} supplied opportunit{'y matches' if len(o['ranked']) == 1 else 'ies match'} your profile; top: {o['ranked'][0]['title']}. "
                     "Fit scores are indicators, not hiring chances, and you apply yourself.")
    m = results.get("mentors")
    if m and m["ranked"]:
        parts.append(f"{len(m['ranked'])} mentor(s) fit your gaps; nothing has been booked.")
    t = results.get("tasks")
    if t and t["recommendations"]:
        parts.append(f"Suggested practice task: {t['recommendations'][0]['title']}. Submitting a task does not by itself show competence; a human review does.")
    if results.get("interview"):
        parts.append(f"{len(results['interview'])} interview answer(s) were assessed automatically; these results are provisional and unverified.")
    for r in refused:
        parts.append(r["explanation"])
    if needs_input:
        parts.append("To go further I need: " + "; ".join(needs_input) + ".")
    if not parts:
        parts.append("There was not enough information to produce recommendations. Provide a target role and, ideally, a resume or interview answers.")
    return " ".join(parts)


class _LLMSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(..., min_length=10, max_length=2500)


def llm_summary(llm: LLMAdapter, base: str, results: dict) -> tuple[str | None, str | None]:
    system = (UNTRUSTED_NOTICE + " Rewrite the FACTS as a short, friendly summary for a student. Use only facts and numbers given; "
              "never say anything was applied for, booked, paid or verified. Respond ONLY with JSON {\"summary\": \"...\"}.")
    parsed, err = call_llm_json(llm, system, "FACTS:\n" + base, _LLMSummary)
    if parsed is None:
        return None, err
    problems = summary_problems(parsed.summary, fact_numbers(results) | set(re.findall(r"\d+(?:\.\d+)?", base)))
    if problems:
        return None, "llm_summary_rejected: " + "; ".join(problems)
    return parsed.summary, None
