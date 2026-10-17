"""Question bank loading and validation (configurable: pass your own JSON path or list)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from importlib import resources
from pathlib import Path

from .schemas import Question


class QuestionBank:
    def __init__(self, questions: list[Question]):
        ids = [q.id for q in questions]
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            raise ValueError(f"duplicate question ids: {sorted(dupes)}")
        for q in questions:
            if q.type == "technical" and not q.concepts:
                raise ValueError(f"technical question '{q.id}' needs at least one concept")
            for m in q.misconceptions:
                try:
                    re.compile(m.pattern)
                except re.error as exc:
                    raise ValueError(f"bad misconception regex in '{q.id}': {exc}") from exc
        self._by_id = {q.id: q for q in questions}
        self.questions = list(questions)

    @classmethod
    def from_file(cls, path: str | Path) -> "QuestionBank":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls([Question(**q) for q in data["questions"]])

    @classmethod
    def default(cls) -> "QuestionBank":
        with resources.files("yogyata_ai.interview").joinpath("data/question_bank.json").open("r", encoding="utf-8") as f:
            return cls([Question(**q) for q in json.load(f)["questions"]])

    def get(self, question_id: str) -> Question | None:
        return self._by_id.get(question_id)

    def filter(self, *, interview_type: str | None = None, role: str | None = None) -> list[Question]:
        out = []
        for q in self.questions:
            if interview_type and q.type != interview_type:
                continue
            if role and "any" not in q.roles and role not in q.roles:
                continue
            out.append(q)
        return out

    @property
    def topics(self) -> list[str]:
        return sorted({q.topic for q in self.questions})


@lru_cache(maxsize=1)
def default_bank() -> QuestionBank:
    return QuestionBank.default()
