from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from interview_agents.config.settings import get_settings
from interview_agents.graph.state import InterviewState

settings = get_settings()


def build_interview_graph(orchestrator) -> Any:
    """Build the LangGraph workflow for the interview lifecycle."""

    workflow: StateGraph = StateGraph(InterviewState)
    workflow.add_node("load_context", orchestrator.load_context)
    workflow.add_node("evaluate_answer", orchestrator.evaluate_answer)
    workflow.add_node("adjust_difficulty", orchestrator.adjust_difficulty)
    workflow.add_node("generate_followup", orchestrator.generate_followup)
    workflow.add_node("generate_question", orchestrator.generate_question)
    if hasattr(orchestrator, "generate_coding_question_node"):
        workflow.add_node("generate_coding_question", orchestrator.generate_coding_question_node)
    workflow.add_node("generate_report", orchestrator.generate_report)

    workflow.set_entry_point("load_context")
    workflow.add_conditional_edges("load_context", orchestrator.route_from_context)
    workflow.add_edge("evaluate_answer", "adjust_difficulty")
    workflow.add_conditional_edges("adjust_difficulty", orchestrator.route_after_adjustment)
    workflow.add_edge("generate_followup", END)
    workflow.add_edge("generate_question", END)
    if hasattr(orchestrator, "generate_coding_question_node"):
        workflow.add_edge("generate_coding_question", END)
    workflow.add_edge("generate_report", END)

    return workflow.compile()
