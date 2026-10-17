from __future__ import annotations

import json
import re
from typing import Any


_JSON_BLOCK_PATTERN = re.compile(r"```json\s*(.*?)\s*```", re.IGNORECASE | re.DOTALL)
_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def extract_json(text: Any) -> Any:
    """Extract and parse JSON from an LLM response."""

    if isinstance(text, (dict, list)):
        return text

    if not text:
        raise ValueError("Empty response received from the model.")

    cleaned_text = str(text).strip()

    # Try a direct parse first. A response whose string VALUES contain their own
    # nested ```json fences (e.g. a coding question embedding example input/output
    # blocks inside its "question" text) is still perfectly valid JSON overall -
    # but the fence-stripping regex below is non-greedy and matches the FIRST
    # ```json...``` it finds anywhere in the text, which can be one of those
    # nested example blocks rather than the real outer wrapper. That silently
    # replaces a well-formed response with a fragment of its own string content
    # (and that fragment is often not valid JSON on its own, e.g. it uses single
    # quotes). Only fall back to the fence/object-extraction heuristics below if
    # the text isn't already clean JSON as-is.
    try:
        return json.loads(cleaned_text)
    except (json.JSONDecodeError, ValueError):
        pass

    block_match = _JSON_BLOCK_PATTERN.search(cleaned_text)
    if block_match:
        candidate = block_match.group(1).strip()
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            pass
        cleaned_text = candidate

    object_match = _OBJECT_PATTERN.search(cleaned_text)
    if object_match:
        cleaned_text = object_match.group(0)

    return json.loads(cleaned_text)


def safe_json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)
