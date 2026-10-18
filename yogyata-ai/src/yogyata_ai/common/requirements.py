"""Split a job/task description into required vs preferred skills (deterministic rules).

Rules, applied line by line:
- A clause containing a preference cue ("preferred", "nice to have", "a plus", "bonus"...) marks its
  skills as preferred.
- A cue followed by a colon ("Nice to have: AWS; Git") applies to the rest of that line.
- A heading line with no skills ("Preferred qualifications:") sets the mode for the following lines
  until a blank line or another heading.
- Everything else is required. Skills found in both lists stay required.
Limitation: "X or Y" alternatives are not modelled; both are treated as required.
"""
from __future__ import annotations

import re

from .taxonomy import Taxonomy, get_taxonomy

_PREFERRED = re.compile(
    r"\b(preferred|nice[- ]to[- ]have|(?:is |are )?an? (?:plus|bonus|advantage)|(?:is |are )?a plus|bonus|"
    r"good to have|desirable|optional|advantage)\b", re.I)
_PREFERRED_LABEL = re.compile(_PREFERRED.pattern + r"[^.\n:]{0,30}:", re.I)
_REQUIRED_HEADING = re.compile(r"\b(requirements?|required|must[- ]have|qualifications?|you will need|what you need)\b", re.I)
_CLAUSE_SPLIT = re.compile(r"\.(?=\s|$)|;")


def extract_requirements(text: str | None, taxonomy: Taxonomy | None = None) -> tuple[list[str], list[str]]:
    tax = taxonomy or get_taxonomy()
    required: list[str] = []
    preferred: list[str] = []
    mode = "required"
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            mode = "required"
            continue
        line_mode = mode
        has_skills = bool(tax.find_in_text(line))
        if not has_skills and (line.endswith(":") or len(line) < 60):  # heading line
            if _PREFERRED.search(line):
                mode = "preferred"
            elif _REQUIRED_HEADING.search(line) or line.endswith(":"):
                mode = "required"
            continue
        for clause in _CLAUSE_SPLIT.split(line):
            skills = list(tax.find_in_text(clause))
            is_pref = bool(_PREFERRED.search(clause)) or line_mode == "preferred"
            if _PREFERRED_LABEL.search(clause):
                line_mode = "preferred"  # label form: rest of the line is preferred
            if not skills:
                continue
            target = preferred if is_pref else required
            for s in skills:
                if s not in target:
                    target.append(s)
    preferred = [s for s in preferred if s not in required]
    return sorted(required), sorted(preferred)
