"""Provider-agnostic LLM adapter with a deterministic mock for tests and offline mode.

No provider is hard-coded. A backend developer wires a real provider by wrapping their own client:

    llm = CallableLLM(lambda system, prompt, timeout: my_client.generate(system, prompt, timeout=timeout))

Everything an LLM returns is treated as untrusted: it must parse as JSON and validate against a
Pydantic model, otherwise callers fall back to deterministic logic (see `call_llm_json`).
"""
from __future__ import annotations

import json
import re
from typing import Callable, Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from .config import Settings

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Raised by adapters when the model is unavailable or times out."""


class LLMAdapter(Protocol):
    def complete(self, system: str, prompt: str, *, timeout: float = 20.0) -> str: ...


class CallableLLM:
    """Wrap any function (system, prompt, timeout) -> str as an adapter."""

    def __init__(self, fn: Callable[[str, str, float], str]):
        self._fn = fn

    def complete(self, system: str, prompt: str, *, timeout: float = 20.0) -> str:
        try:
            return self._fn(system, prompt, timeout)
        except LLMError:
            raise
        except Exception as exc:  # provider errors become one predictable type
            raise LLMError(f"LLM call failed: {type(exc).__name__}") from exc


class MockLLM:
    """Scripted responses for tests/demos. Records every call so tests can inspect prompts.

    `responses` may be a list (consumed in order, last one repeats) or a callable(system, prompt) -> str.
    Use `MockLLM(error=LLMError("down"))` to simulate an outage.
    """

    def __init__(self, responses: list[str] | Callable[[str, str], str] | None = None,
                 error: Exception | None = None):
        self._responses = responses if responses is not None else ["{}"]
        self._error = error
        self.calls: list[dict] = []

    def complete(self, system: str, prompt: str, *, timeout: float = 20.0) -> str:
        self.calls.append({"system": system, "prompt": prompt, "timeout": timeout})
        if self._error:
            raise self._error
        if callable(self._responses):
            return self._responses(system, prompt)
        idx = min(len(self.calls) - 1, len(self._responses) - 1)
        return self._responses[idx]


def get_llm(settings: Settings | None = None) -> LLMAdapter | None:
    """Return an adapter, or None when the LLM is disabled (the default).

    Only provider "mock" is built in. Real providers are injected by the integrator via CallableLLM.
    """
    settings = settings or Settings.from_env()
    if settings.llm_provider == "mock":
        return MockLLM()
    return None


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)


def parse_json_object(text: str) -> dict:
    """Extract the first JSON object from model output; raise ValueError if none parses."""
    cleaned = _FENCE.sub("", (text or "").strip())
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("no JSON object in LLM output")
        obj = json.loads(cleaned[start : end + 1])
    if not isinstance(obj, dict):
        raise ValueError("LLM output is not a JSON object")
    return obj


def call_llm_json(llm: LLMAdapter | None, system: str, prompt: str, model: type[T],
                  *, timeout: float = 20.0) -> tuple[T | None, str | None]:
    """Call the LLM and validate its output. Returns (parsed_model, None) or (None, error_reason).

    Never raises: unavailable service, timeout, malformed JSON and schema violations all yield
    (None, reason) so the caller can use its deterministic fallback.
    """
    if llm is None:
        return None, "llm_disabled"
    try:
        raw = llm.complete(system, prompt, timeout=timeout)
    except LLMError as exc:
        return None, f"llm_unavailable: {exc}"
    except Exception as exc:  # defensive: custom adapters may raise anything
        return None, f"llm_error: {type(exc).__name__}"
    try:
        return model(**parse_json_object(raw)), None
    except (ValueError, ValidationError, TypeError) as exc:
        return None, f"invalid_llm_output: {type(exc).__name__}"
