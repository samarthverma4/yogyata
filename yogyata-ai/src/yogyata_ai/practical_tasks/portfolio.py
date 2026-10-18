"""Support for portfolio items: completeness feedback only. Never an assessment of competence."""
from __future__ import annotations

import re

from yogyata_ai.common.safety import detect_injection, sanitize_untrusted
from yogyata_ai.common.taxonomy import get_taxonomy

_SECTIONS = {
    "problem": (r"\b(problem|objective|goal|motivation|aim)", "State the problem or goal"),
    "approach": (r"\b(approach|method|design|implementation|architecture|how it works)", "Explain your approach"),
    "stack": (r"\b(tech stack|built with|technologies|tools used|stack)", "List the technologies used"),
    "results": (r"\b(result|outcome|finding|evaluation|impact)", "Report results or outcomes"),
    "limitations": (r"\b(limitation|caveat|future work|known issues|trade-?off)", "State limitations honestly"),
    "how_to_run": (r"\b(usage|how to run|getting started|installation|setup)", "Explain how to run or view it"),
}
_OVERCLAIM = re.compile(r"\b(100\s?% (accuracy|accurate)|state[- ]of[- ]the[- ]art|guaranteed|perfect(ly)?|best in class|flawless)", re.I)


def analyze_portfolio_item(text: str) -> dict:
    clean = sanitize_untrusted(text, 30_000)
    low = clean.lower()
    present = {k: bool(re.search(p, low)) for k, (p, _) in _SECTIONS.items()}
    tax = get_taxonomy()
    skills = sorted(tax.find_in_text(clean)) if hasattr(tax, "find_in_text") else []
    quantified = bool(re.search(r"\b\d+(\.\d+)?\s?(%|x|ms|users|rows|records|samples)\b|\b(accuracy|f1|precision|recall|rmse|auc)\b\s*(of|:|=|was)?\s*\d", low))
    link_mentioned = bool(re.search(r"https?://|github\.com|gitlab\.com", low))
    words = len(clean.split())
    sugg = [msg for k, (_, msg) in _SECTIONS.items() if not present[k]]
    if not quantified:
        sugg.append("Add at least one concrete, honest measurement (what was measured, on what data)")
    if not link_mentioned:
        sugg.append("Add a link to the code or demo so a reviewer can inspect it")
    over = sorted({m.group(0).lower() for m in _OVERCLAIM.finditer(clean)})
    flags = []
    if over:
        flags.append("unqualified_claims: " + ", ".join(over) + " - back claims with evidence or soften them")
    if words < 80:
        flags.append("very_short")
    inj = detect_injection(clean)
    if inj:
        flags.append("possible_prompt_injection: " + ", ".join(inj) + " (treated as data only)")
    completeness = round(sum(present.values()) / len(present), 2)
    return {
        "status": "documentation_feedback_only",
        "documentation_completeness": completeness,
        "sections_present": present, "quantified_results_present": quantified,
        "link_mentioned": link_mentioned, "link_verified": False,
        "skills_mentioned": skills, "flags": flags, "suggestions": sugg,
        "note": "This measures how well the item is documented. It does not assess quality, originality, authorship or "
                "competence; skills mentioned are claims, and only a portfolio review records evidence.",
        "method": "rules over text; links are not fetched or verified",
    }
