from .assistant import confirm_action, run_agent
from .tools import build_specs


def list_tools() -> list[dict]:
    return [{"name": s.name, "description": s.description, "effect": s.effect, "arguments": s.args.model_json_schema().get("properties", {})}
            for s in build_specs().values()]


__all__ = ["run_agent", "confirm_action", "list_tools"]
