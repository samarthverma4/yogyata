from __future__ import annotations

from interview_agents.memory.memory_manager import MemoryManager
from interview_agents.services.openai_service import OpenAIService


class BaseInterviewAgent:
    """Base class shared by all interview agents."""

    def __init__(self, openai_service: OpenAIService | None, memory: MemoryManager):
        self.openai_service = openai_service
        self.memory = memory

    @property
    def has_llm(self) -> bool:
        return self.openai_service is not None
