from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from pathlib import Path

from yogyata_ai.common.taxonomy import get_taxonomy

from .schemas import PracticalTask


class TaskCatalog:
    def __init__(self, tasks: list[PracticalTask]):
        tax = get_taxonomy()
        self.tasks = {t.id: t for t in tasks}
        if len(self.tasks) != len(tasks):
            raise ValueError("duplicate task ids")
        for t in tasks:
            for s in [*t.skills, *t.prerequisite_skills]:
                if tax.canonical(s) != s:
                    raise ValueError(f"task '{t.id}': '{s}' is not a canonical taxonomy skill")
            ids = [c.id for c in t.rubric]
            if len(set(ids)) != len(ids):
                raise ValueError(f"task '{t.id}': duplicate rubric criterion ids")

    @classmethod
    def from_dict(cls, data: dict) -> "TaskCatalog":
        return cls([PracticalTask(**t) for t in data["tasks"]])

    @classmethod
    def from_file(cls, path: str | Path) -> "TaskCatalog":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    @classmethod
    def default(cls) -> "TaskCatalog":
        with resources.files("yogyata_ai.practical_tasks").joinpath("data/tasks.json").open("r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    def get(self, task_id: str) -> PracticalTask:
        if task_id not in self.tasks:
            raise ValueError(f"unknown task '{task_id}'")
        return self.tasks[task_id]


@lru_cache(maxsize=1)
def default_task_catalog() -> TaskCatalog:
    return TaskCatalog.default()
