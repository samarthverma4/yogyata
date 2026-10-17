"""Fix 1a — response-conditioned difficulty.

The legacy path set difficulty by question index (a fixed 10/5/5 schedule that
ignored the candidate entirely). This controller consumes a rolling window of the
most recent *dimensional totals* instead: sustained high scores step up, low or
vague answers step down, mixed holds. Every decision is logged as
(prev_level, signal, new_level) so a run report can prove difficulty tracked
performance rather than position.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List

logger = logging.getLogger(__name__)

LEVELS = ["Easy", "Medium", "Hard"]

# Rolling window + thresholds (scores are 0-100 dimensional totals).
_WINDOW = 3
_STEP_UP_MEAN = 78.0     # sustained strong -> harder
_STEP_UP_MIN = 68.0      # ...and no weak answer inside the window
_STEP_DOWN_MEAN = 58.0   # struggling -> easier
_SEVERE = 42.0           # a single very weak answer forces a step down


@dataclass
class DifficultyDecision:
    prev_level: str
    signal: str          # "up" | "down" | "hold"
    new_level: str
    window: List[int]
    reason: str


class AdaptiveDifficulty:
    """Owns the current difficulty level for one interview run."""

    def __init__(self, start: str = "Easy") -> None:
        self.level = start if start in LEVELS else "Easy"
        self._scores: List[int] = []
        self.decisions: List[DifficultyDecision] = []

    def _step(self, direction: int) -> str:
        idx = max(0, min(len(LEVELS) - 1, LEVELS.index(self.level) + direction))
        return LEVELS[idx]

    def update(self, score: int) -> DifficultyDecision:
        """Record the latest answer score and return the next difficulty decision.

        Call AFTER evaluating an answer; the returned level applies to the NEXT
        question, which is what makes difficulty response-conditioned.
        """
        self._scores.append(int(score))
        window = self._scores[-_WINDOW:]
        prev = self.level
        mean = sum(window) / len(window)
        lo = min(window)

        if lo < _SEVERE:
            signal, reason = "down", f"severe answer ({lo}) in window"
        elif len(window) >= 2 and mean >= _STEP_UP_MEAN and lo >= _STEP_UP_MIN:
            signal, reason = "up", f"sustained strong (mean={mean:.0f}, min={lo})"
        elif mean <= _STEP_DOWN_MEAN:
            signal, reason = "down", f"weak window (mean={mean:.0f})"
        else:
            signal, reason = "hold", f"mixed (mean={mean:.0f}, min={lo})"

        if signal == "up":
            self.level = self._step(+1)
        elif signal == "down":
            self.level = self._step(-1)

        decision = DifficultyDecision(
            prev_level=prev, signal=signal, new_level=self.level,
            window=list(window), reason=reason,
        )
        self.decisions.append(decision)
        logger.info(
            "[DIFFICULTY] prev=%s signal=%s new=%s window=%s (%s)",
            prev, signal, self.level, window, reason,
        )
        return decision

    def as_log(self) -> List[Dict]:
        return [
            {"prev_level": d.prev_level, "signal": d.signal,
             "new_level": d.new_level, "window": d.window, "reason": d.reason}
            for d in self.decisions
        ]
