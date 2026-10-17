"""Shared, configurable skill taxonomy (canonical names, aliases, categories).

Every module normalises skill names through this class so that "sklearn", "scikit learn" and
"scikit-learn" are the same skill everywhere. Approach: deterministic rules (alias lookup + regex).
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Iterable


class Taxonomy:
    def __init__(self, skills: dict[str, dict]):
        if not skills:
            raise ValueError("taxonomy must contain at least one skill")
        self._skills = {}
        self._alias_to_name: dict[str, str] = {}
        for name, meta in skills.items():
            aliases = {a.strip().lower() for a in meta.get("aliases", []) if a.strip()} | {name.lower()}
            self._skills[name] = {"category": meta.get("category", "other"), "aliases": sorted(aliases)}
            for a in aliases:
                # first definition wins; duplicates across skills are a config error worth surfacing
                if a in self._alias_to_name and self._alias_to_name[a] != name:
                    raise ValueError(f"alias '{a}' maps to both '{self._alias_to_name[a]}' and '{name}'")
                self._alias_to_name[a] = name
        self._patterns: list[tuple[str, str, re.Pattern]] | None = None

    # ---- construction -------------------------------------------------
    @classmethod
    def from_file(cls, path: str | Path) -> "Taxonomy":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(data["skills"])

    @classmethod
    def default(cls) -> "Taxonomy":
        with resources.files("yogyata_ai.common").joinpath("data/skills_taxonomy.json").open(
            "r", encoding="utf-8"
        ) as f:
            return cls(json.load(f)["skills"])

    # ---- lookups --------------------------------------------------------
    @property
    def names(self) -> list[str]:
        return sorted(self._skills)

    def category(self, name: str) -> str | None:
        return self._skills.get(name, {}).get("category")

    def canonical(self, raw: str) -> str | None:
        """Return the canonical skill name for a raw string, or None if unknown."""
        if not raw:
            return None
        return self._alias_to_name.get(re.sub(r"\s+", " ", raw.strip().lower()))

    def normalize_many(self, raws: Iterable[str]) -> tuple[list[str], list[str]]:
        """Return (canonical skills de-duplicated in input order, unknown raw strings)."""
        known: list[str] = []
        unknown: list[str] = []
        for raw in raws:
            c = self.canonical(raw)
            if c is None:
                if raw and raw.strip() and raw.strip() not in unknown:
                    unknown.append(raw.strip())
            elif c not in known:
                known.append(c)
        return known, unknown

    def patterns(self) -> list[tuple[str, str, re.Pattern]]:
        if self._patterns is None:
            out = []
            for name, meta in self._skills.items():
                alts = sorted(meta["aliases"], key=len, reverse=True)
                body = "|".join(re.escape(a) for a in alts)
                # '.' in the lookbehind stops the "js" alias from firing inside "Node.js"
                out.append((name, meta["category"],
                            re.compile(rf"(?<![A-Za-z0-9+#.])(?:{body})(?![A-Za-z0-9+#])", re.I)))
            self._patterns = out
        return self._patterns

    def find_in_text(self, text: str) -> Counter:
        """Count canonical skill mentions in free text."""
        counts: Counter = Counter()
        for name, _cat, pat in self.patterns():
            n = len(pat.findall(text or ""))
            if n:
                counts[name] = n
        return counts


@lru_cache(maxsize=4)
def _load(path: str | None) -> Taxonomy:
    return Taxonomy.from_file(path) if path else Taxonomy.default()


def get_taxonomy(path: str | None = None) -> Taxonomy:
    """Default taxonomy, or the file named by `path` / env YOGYATA_TAXONOMY_PATH."""
    return _load(path or os.getenv("YOGYATA_TAXONOMY_PATH") or None)
