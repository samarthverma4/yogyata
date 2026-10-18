"""Vocabulary translation between the Yogyata app and the yogyata_ai taxonomy.

The app lets people type roles and skills freely; the package only understands a fixed
catalog (3 roles, 46 canonical skills). Everything that crosses the boundary is translated
here, and whatever cannot be translated is reported rather than dropped silently.
"""
from __future__ import annotations

from yogyata_ai.common.taxonomy import get_taxonomy
from yogyata_ai.skill_gap import list_roles

# App target-role labels (onboarding CareerGoalsStep) -> package role ids.
# Anything absent is unsupported: the caller gets a 422 naming the supported roles,
# never a guess, because scoring against the wrong role catalog is worse than no score.
ROLE_ALIASES: dict[str, str] = {
    "data analyst": "data_analyst",
    "data scientist": "data_analyst",
    "data analyst / data scientist": "data_analyst",
    "business analyst": "data_analyst",
    "ai / machine learning engineer": "ml_engineer",
    "ai/ml engineer": "ml_engineer",
    "machine learning engineer": "ml_engineer",
    "ml engineer": "ml_engineer",
    "full-stack developer": "full_stack_developer",
    "full stack developer": "full_stack_developer",
    "fullstack developer": "full_stack_developer",
    "frontend developer": "full_stack_developer",
    "backend developer": "full_stack_developer",
    "software engineer": "full_stack_developer",
    "web developer": "full_stack_developer",
}

# Skill spellings the app produces that the bundled taxonomy does not already alias.
SKILL_ALIASES: dict[str, str] = {
    "reactjs": "React",
    "react.js": "React",
    "nodejs": "Node.js",
    "node": "Node.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "js": "JavaScript",
    "ts": "TypeScript",
    "ml": "Machine Learning",
    "dl": "Deep Learning",
    "nlp": "Natural Language Processing",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "tf": "TensorFlow",
    "powerbi": "Power BI",
    "power-bi": "Power BI",
    "excel": "Excel",
    "ms excel": "Excel",
    "data viz": "Data Visualization",
    "dataviz": "Data Visualization",
}


def supported_roles() -> list[str]:
    return [r["id"] for r in list_roles()]


def resolve_role(raw: str | None) -> str | None:
    """App role label -> package role id, or None when it is not one we can score."""
    if not raw:
        return None
    key = raw.strip().lower()
    if key in ROLE_ALIASES:
        return ROLE_ALIASES[key]
    # already a package id, e.g. passed straight through by a caller
    snake = key.replace(" ", "_").replace("-", "_").replace("/", "_")
    return snake if snake in supported_roles() else None


def canonical_skill(raw: str) -> str | None:
    """Free-text skill -> canonical taxonomy name, or None when unknown."""
    if not raw or not raw.strip():
        return None
    name = get_taxonomy().canonical(raw)
    if name:
        return name
    return SKILL_ALIASES.get(raw.strip().lower())


def canonical_skills(raws: list[str]) -> tuple[list[str], list[str]]:
    """Split a list into (canonical names, unmapped originals), order-preserving and deduped.

    Unmapped names are returned so the API can surface them: a skill the taxonomy does not
    know is invisible to every score, and a student should be told that rather than quietly
    scored as if the skill did not exist.
    """
    known: list[str] = []
    unknown: list[str] = []
    for raw in raws:
        name = canonical_skill(raw)
        if name is None:
            if raw and raw not in unknown:
                unknown.append(raw)
        elif name not in known:
            known.append(name)
    return known, unknown
