"""Role competency requirements: configurable, validated (known skills, in-role prerequisites, no cycles)."""
from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, model_validator

from yogyata_ai.common.taxonomy import get_taxonomy


class RoleSkill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: str
    importance: int = Field(..., ge=1, le=5)
    prerequisites: list[str] = Field(default_factory=list)


class RoleConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = ""
    title: str
    skills: list[RoleSkill]

    @model_validator(mode="after")
    def _validate(self):
        tax = get_taxonomy()
        names = [s.skill for s in self.skills]
        if len(set(names)) != len(names):
            raise ValueError("duplicate skills in role")
        for s in self.skills:
            if tax.canonical(s.skill) != s.skill:
                raise ValueError(f"'{s.skill}' is not a canonical taxonomy skill name")
            for p in s.prerequisites:
                if p not in names:
                    raise ValueError(f"prerequisite '{p}' of '{s.skill}' is not a skill of this role")
                if p == s.skill:
                    raise ValueError(f"'{s.skill}' cannot be its own prerequisite")
        # cycle check (DFS)
        graph = {s.skill: s.prerequisites for s in self.skills}
        state: dict[str, int] = {}

        def visit(n: str):
            if state.get(n) == 1:
                raise ValueError("prerequisite cycle detected involving '" + n + "'")
            if state.get(n) == 2:
                return
            state[n] = 1
            for p in graph[n]:
                visit(p)
            state[n] = 2

        for n in graph:
            visit(n)
        return self


class RoleCatalog:
    def __init__(self, roles: dict[str, RoleConfig]):
        self.roles = roles

    @classmethod
    def from_dict(cls, data: dict) -> "RoleCatalog":
        roles = {}
        for rid, cfg in data["roles"].items():
            roles[rid] = RoleConfig(id=rid, **{k: v for k, v in cfg.items() if k != "id"})
        return cls(roles)

    @classmethod
    def from_file(cls, path: str | Path) -> "RoleCatalog":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    @classmethod
    def default(cls) -> "RoleCatalog":
        with resources.files("yogyata_ai.skill_gap").joinpath("data/roles.json").open("r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    def get(self, role_id: str) -> RoleConfig:
        if role_id not in self.roles:
            raise ValueError(f"unknown role '{role_id}'. Known roles: {', '.join(sorted(self.roles))}")
        return self.roles[role_id]

    @property
    def ids(self) -> list[str]:
        return sorted(self.roles)


@lru_cache(maxsize=1)
def default_catalog() -> RoleCatalog:
    return RoleCatalog.default()
