"""Framework-agnostic example of how a backend can call yogyata-ai. This is NOT a web app: each handler takes and returns
plain JSON-compatible dicts, so you can wrap it in FastAPI/Flask/Django/a queue worker.

    python examples/backend_integration.py

Integration rules shown here:
 * validate and authenticate in YOUR layer; pass only data the user is allowed to submit
 * persist the returned `session` yourself and send it back on the next call (the package keeps no state)
 * only your authenticated human-review workflow may supply `reviewed_results` / call `record_review`
 * map ValueError / pydantic.ValidationError to HTTP 4xx; treat anything else as 5xx
 * actions are executed by YOUR code, and only after the user explicitly confirms in your UI
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pydantic import ValidationError  # noqa: E402

from yogyata_ai import skill_gap  # noqa: E402
from yogyata_ai.agent import confirm_action, run_agent  # noqa: E402
from yogyata_ai.common.llm import CallableLLM  # noqa: E402
from yogyata_ai.practical_tasks import record_review  # noqa: E402
from yogyata_ai.resume_intelligence import analyze  # noqa: E402


def handle(route: str, body: dict) -> tuple[int, dict]:
    """Tiny dispatcher standing in for your web framework."""
    try:
        if route == "POST /resume/analyze":
            return 200, analyze({"resume_text": body["resume_text"]})
        if route == "POST /skill-gap":
            return 200, skill_gap.analyze_skill_gap(body)
        if route == "POST /agent/run":
            return 200, run_agent(body, llm=optional_llm())
        if route == "POST /agent/confirm":  # call ONLY from the click handler of an authenticated user
            return 200, confirm_action(body["session"], body["action_id"], user_confirmed=bool(body["user_confirmed"]))
        if route == "POST /internal/reviews":  # call ONLY from your authenticated reviewer workflow
            return 200, {"evidence": record_review(body)}
        return 404, {"error": "unknown route"}
    except (ValidationError, ValueError, KeyError) as exc:
        return 422, {"error": type(exc).__name__, "detail": str(exc)[:300]}
    except Exception:  # log the details server-side; never leak internals
        return 500, {"error": "internal_error"}


def optional_llm():
    """Return None for deterministic mode, or wrap your own provider client. This package never reads API keys.

    Example (pseudo-code; replace with your client):
        return CallableLLM(lambda system, prompt, timeout: my_client.generate(system=system, prompt=prompt, timeout=timeout))
    """
    return None


if __name__ == "__main__":
    demo_opps = json.loads((ROOT / "data/demo/opportunities.json").read_text(encoding="utf-8"))["opportunities"]
    status, out = handle("POST /agent/run", {"target_role": "data_analyst", "opportunities": demo_opps[:3],
                                             "user_message": "make a roadmap and save it",
                                             "session": {"profile": {"weekly_hours": 6, "timeline_weeks": 6}}})
    print("agent/run ->", status, "| stages:", out["stages_run"], "| proposed:", [(a["id"], a["kind"], a["status"]) for a in out["proposed_actions"]])
    # ...your UI shows the proposal; the user clicks "Confirm"...
    act = out["proposed_actions"][0]
    status, conf = handle("POST /agent/confirm", {"session": out["session"], "action_id": act["id"], "user_confirmed": True})
    print("agent/confirm ->", status, "| handoff for YOUR backend to execute:", conf["handoff"])
    print("bad input ->", handle("POST /skill-gap", {"profile": {}, "role_id": "astronaut"}))
    _ = CallableLLM  # imported to show where the adapter lives
