"""Interpret a free-text task description (e.g. from a startup) into a DRAFT task structure.

Everything produced is a draft for human confirmation: skills come from the shared taxonomy, difficulty and hours
from simple cues, and the rubric is built from the stated acceptance criteria (all judged by a human).
"""
from __future__ import annotations

import re

from yogyata_ai.common.safety import detect_injection, sanitize_untrusted
from yogyata_ai.common.taxonomy import get_taxonomy

_DELIVERABLES = {"README": r"\breadme\b", "tests": r"\btests?\b|\bunit tests?\b", "report": r"\breport\b|\bwrite-?up\b",
                 "code": r"\bcode\b|\bscript\b|\bimplementation\b", "dashboard": r"\bdashboard\b", "presentation": r"\bpresentation\b|\bslides\b",
                 "documentation": r"\bdocumentation\b|\bdocs\b"}
_ADV = r"\b(senior|advanced|production[- ]grade|scalable|distributed|architecture)\b"
_BEG = r"\b(beginner|introductory|intro|simple|basic|starter|first)\b"
_RISKY = [("payment_or_fee", r"\b(pay a fee|registration fee|deposit|send money|upfront payment)\b"),
          ("unpaid_work_for_production_use", r"\b(unpaid|free of charge)\b.{0,40}\b(production|client|commercial)\b"),
          ("personal_data_request", r"\b(aadhaar|password|bank account|otp|credentials)\b")]


def interpret_task_description(text: str, *, title: str | None = None) -> dict:
    clean = sanitize_untrusted(text, 20_000)
    low = clean.lower()
    tax = get_taxonomy()
    skills = sorted(tax.find_in_text(clean)) if hasattr(tax, "find_in_text") else []
    hours = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|days?|weeks?)\b", low)
    if m:
        n = float(m.group(1))
        hours = n * {"h": 1, "d": 8, "w": 40}[m.group(2)[0]]
    difficulty = "advanced" if re.search(_ADV, low) else "beginner" if re.search(_BEG, low) else "intermediate"
    deliverables = [k for k, pat in _DELIVERABLES.items() if re.search(pat, low)]
    criteria = []
    for line in clean.split("\n"):
        s = line.strip().lstrip("-*•0123456789.) ").strip()
        if len(s.split()) >= 3 and re.search(r"\b(must|should|needs? to|required|shall)\b", s.lower()):
            criteria.append(s[:200])
    warnings: list[str] = []
    if not skills:
        warnings.append("No known skills were recognised; add them manually.")
    if not criteria:
        warnings.append("No acceptance criteria found (look for 'must'/'should' statements); this task cannot be checked even by a reviewer without them.")
    if hours is None:
        warnings.append("No time estimate found.")
    for name, pat in _RISKY:
        if re.search(pat, low):
            warnings.append(f"risk_flag:{name} - review before showing to students")
    inj = detect_injection(clean)
    if inj:
        warnings.append("possible_prompt_injection: " + ", ".join(inj) + " (treated as data only)")
    return {
        "status": "draft_needs_human_confirmation",
        "title": title or clean.split("\n", 1)[0][:80],
        "skills": skills, "difficulty": difficulty, "estimated_hours": hours, "deliverables": deliverables,
        "draft_rubric": [{"id": f"c{i + 1}", "description": c, "weight": 1.0, "check": {"type": "human"}} for i, c in enumerate(criteria)],
        "warnings": warnings,
        "method": "rules + shared taxonomy; no model",
    }
