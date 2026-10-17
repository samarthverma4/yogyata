"""
Interview Agents Module (Resume/HR Interview Intelligence Engine)
Provides Resume-grounded question generation, STAR evaluation, adaptive probing,
difficulty control, and candidate scorecards.
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

# Provide an 'app' compatibility alias so existing internal module imports
# (e.g. `from app.agents...` or `from app.schemas...`) continue to resolve cleanly.
_self = sys.modules[__name__]
sys.modules.setdefault("app", _self)

from interview_agents.agents.hr_behavioral_agent import HRBehavioralAgent
from interview_agents.agents.question_generator import QuestionGeneratorAgent
from interview_agents.agents.answer_evaluator import AnswerEvaluatorAgent
from interview_agents.agents.followup_generator import FollowUpQuestionGeneratorAgent
from interview_agents.agents.difficulty_controller import DifficultyControllerAgent
from interview_agents.agents.report_generator import ReportGeneratorAgent
from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.agents.interview_type_router import InterviewTypeRouter
from interview_agents.graph.state import InterviewState

try:
    from interview_agents.graph.workflow import build_interview_graph
except ImportError:
    build_interview_graph = None

__all__ = [
    "HRBehavioralAgent",
    "QuestionGeneratorAgent",
    "AnswerEvaluatorAgent",
    "FollowUpQuestionGeneratorAgent",
    "DifficultyControllerAgent",
    "ReportGeneratorAgent",
    "BaseInterviewAgent",
    "BaseChildAgent",
    "InterviewTypeRouter",
    "InterviewState",
    "build_interview_graph",
]
