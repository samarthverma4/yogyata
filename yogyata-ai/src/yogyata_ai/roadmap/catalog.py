"""Activity catalog: validated, configurable. Ships with a generic synthetic demo catalog (no real courses/URLs)."""
from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from yogyata_ai.common.taxonomy import get_taxonomy

ActivityType = Literal["learn", "practice", "project", "assessment", "interview_practice", "mentor_review"]
EvidenceSourceName = Literal["interview_auto", "task_review", "interview_review", "portfolio_review"]


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    skill: str
    type: ActivityType
    title: str
    hours: float = Field(..., gt=0, le=60)
    objective: str
    expected_evidence: str
    evidence_source: EvidenceSourceName | None = None
    completion_criteria: str
    requires: list[str] = Field(default_factory=list, description="Activity ids to finish first (same skill)")
    requires_review: bool = False
    paid_possible: bool = False
    external_action_required: bool = False


class ActivityCatalog:
    def __init__(self, activities: list[Activity]):
        tax = get_taxonomy()
        self.activities = {a.id: a for a in activities}
        if len(self.activities) != len(activities):
            raise ValueError("duplicate activity ids in catalog")
        for a in activities:
            if tax.canonical(a.skill) != a.skill:
                raise ValueError(f"activity '{a.id}': '{a.skill}' is not a canonical taxonomy skill")
            for r in a.requires:
                if r not in self.activities:
                    raise ValueError(f"activity '{a.id}' requires unknown activity '{r}'")
                if self.activities[r].skill != a.skill:
                    raise ValueError(f"activity '{a.id}' requires an activity of a different skill")
        for a in activities:  # cycle check
            seen, stack = set(), list(a.requires)
            while stack:
                r = stack.pop()
                if r == a.id:
                    raise ValueError(f"requirement cycle involving '{a.id}'")
                if r not in seen:
                    seen.add(r)
                    stack.extend(self.activities[r].requires)

    @classmethod
    def from_dict(cls, data: dict) -> "ActivityCatalog":
        return cls([Activity(**a) for a in data["activities"]])

    @classmethod
    def from_file(cls, path: str | Path) -> "ActivityCatalog":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    @classmethod
    def default(cls) -> "ActivityCatalog":
        with resources.files("yogyata_ai.roadmap").joinpath("data/activities.json").open("r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    def get(self, activity_id: str) -> Activity | None:
        return self.activities.get(activity_id)

    def find(self, skill: str, type_: str) -> Activity | None:
        for a in self.activities.values():
            if a.skill == skill and a.type == type_:
                return a
        return None


@lru_cache(maxsize=1)
def default_activity_catalog() -> ActivityCatalog:
    return ActivityCatalog.default()
