"""
Adaptive interview engine.

Composes the six corrected behaviours exposed by a 20-question audit:

  fix 1  response-conditioned adaptivity   -> difficulty.py + followup.py + engine transcript
  fix 2  activated source router           -> routing.py (+ seed bank)
  fix 3  per-subtopic web grounding         -> web_grounding.py
  fix 4  coverage blueprint                 -> blueprint.py
  fix 5  near-duplicate detection           -> dedup.py
  fix 6  discriminating evaluator           -> evaluator.py

Every generated question carries an audit record (source, blueprint bucket,
difficulty level, web query issued) so a run report can prove the fixes work.
The LLM, web-search and embedding dependencies are injected as protocols, so the
end-to-end test drives a full interview deterministically with scripted doubles.
"""
from interview_agents.interview_engine.engine import InterviewEngine, EngineConfig
from interview_agents.interview_engine.protocols import (
    QuestionMeta,
    DimensionScores,
    Evaluation,
    Turn,
    RunReport,
)

__all__ = [
    "InterviewEngine",
    "EngineConfig",
    "QuestionMeta",
    "DimensionScores",
    "Evaluation",
    "Turn",
    "RunReport",
]
