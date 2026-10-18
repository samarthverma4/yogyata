from __future__ import annotations

import logging
import re
from typing import Any

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.services.admin_api_client import AdminAPIClient
from interview_agents.services.calendar_service import get_calendar_provider
from interview_agents.schemas.admin_task import AdminTaskPlan, AdminTaskResponse

logger = logging.getLogger(__name__)


class AdminTaskAgent(BaseInterviewAgent):
    """Orchestrates administrative tasks by parsing natural language and calling Node.js backend APIs."""

    def execute_task(self, task_description: str) -> AdminTaskResponse:
        """
        Parse task, execute the derived plan of actions, and return a summary response.
        """
        if not self.has_llm:
            return AdminTaskResponse(
                success=False,
                message="No LLM service configured. Admin automation requires an operational LLM.",
                errors=["LLM service is missing"],
            )

        prompt_payload = {"task": task_description}
        try:
            plan = self.openai_service.generate_structured(
                "admin_task_agent.txt",
                prompt_payload,
                AdminTaskPlan,
            )
        except Exception as exc:
            logger.exception("Failed to parse admin task using LLM")
            return AdminTaskResponse(
                success=False,
                message="Failed to parse the task description.",
                errors=[str(exc)],
            )

        if not plan.actions:
            return AdminTaskResponse(
                success=True,
                message="No actions were identified for this task.",
            )

        api_client = AdminAPIClient()
        actions_executed: list[dict[str, Any]] = []
        errors: list[str] = []

        # Ensure authentication works before executing any actions
        try:
            api_client._ensure_authenticated()
        except Exception as exc:
            return AdminTaskResponse(
                success=False,
                message="Failed to authenticate with GLAMIS Node.js backend.",
                errors=[str(exc)],
            )

        for action in plan.actions:
            try:
                if action.action_type == "schedule_interview":
                    itype = action.interview_type
                    if not itype:
                        errors.append("Schedule action requested but no interview type was specified.")
                        continue

                    # Retrieve matching details payload
                    details_model = None
                    if itype == "company":
                        details_model = action.company_details
                    elif itype == "subject":
                        details_model = action.subject_details
                    elif itype == "written":
                        details_model = action.written_details
                    elif itype == "verbal":
                        details_model = action.verbal_details
                    elif itype == "svar":
                        details_model = action.svar_details

                    if not details_model:
                        errors.append(f"No scheduling payload provided for interview type '{itype}'")
                        continue

                    # Serialize to dict using aliases so `from_time` maps to `from`
                    payload = details_model.model_dump(by_alias=True, exclude_none=True)
                    
                    # Call API
                    res = api_client.create_interview(itype, payload)
                    action_entry: dict[str, Any] = {
                        "action": "schedule_interview",
                        "interview_type": itype,
                        "name": payload.get("name"),
                        "result": res,
                    }

                    # Optional calendar sync — silently skipped if unconfigured
                    try:
                        calendar = get_calendar_provider()
                        cal_date = payload.get("date") or ""
                        cal_from = payload.get("from") or payload.get("from_time") or "09:00"
                        cal_to = payload.get("to") or payload.get("to_time") or "10:00"
                        interview_name = payload.get("name") or f"{itype.title()} Interview"
                        students = payload.get("students") or []
                        cal_event = calendar.create_event(
                            title=f"GLAMIS: {interview_name}",
                            date=cal_date,
                            from_time=cal_from,
                            to_time=cal_to,
                            description=f"Type: {itype} | Students: {len(students)}",
                        )
                        if cal_event.status != "skipped":
                            action_entry["calendar_event_id"] = cal_event.event_id
                            action_entry["calendar_link"] = cal_event.link
                    except Exception:
                        logger.debug("Calendar sync skipped for action", exc_info=True)

                    actions_executed.append(action_entry)

                elif action.action_type == "download_attendance":
                    target_name_or_id = action.interview_name_or_id or ""
                    target_ids = action.interview_ids or []
                    
                    if target_name_or_id:
                        target_ids.append(target_name_or_id)

                    resolved_ids: list[str] = []
                    for tid in target_ids:
                        # If it looks like a MongoDB ID (24-char hex), use it directly
                        if re.match(r"^[0-9a-fA-F]{24}$", tid):
                            resolved_ids.append(tid)
                        else:
                            # It's a name, resolve it via fetch_interview_details
                            logger.info("Resolving interview name '%s' to ID...", tid)
                            details = api_client.fetch_interview_details()
                            found_id = None
                            for iv in details:
                                iv_name = iv.get("name", "")
                                iv_id = iv.get("_id") or iv.get("id")
                                if iv_id and (tid.lower() in iv_name.lower() or iv_name.lower() in tid.lower()):
                                    found_id = str(iv_id)
                                    break
                            if found_id:
                                resolved_ids.append(found_id)
                            else:
                                errors.append(f"Could not resolve interview name or ID '{tid}'")

                    if not resolved_ids:
                        errors.append("No valid interview IDs could be resolved for attendance download.")
                        continue

                    # Download attendance CSV
                    csv_data = api_client.download_attendance(resolved_ids)
                    actions_executed.append({
                        "action": "download_attendance",
                        "resolved_ids": resolved_ids,
                        "csv_snippet": csv_data[:200] + "\n..." if len(csv_data) > 200 else csv_data,
                        "csv_full": csv_data,
                    })

                elif action.action_type == "fetch_status_counts":
                    counts = api_client.fetch_status_counts()
                    actions_executed.append({
                        "action": "fetch_status_counts",
                        "result": counts,
                    })

                elif action.action_type == "unsupported":
                    msg = action.message or "Requested operation is currently unsupported by the backend."
                    errors.append(msg)

                else:
                    errors.append(f"Unknown action type: '{action.action_type}'")

            except Exception as exc:
                logger.exception("Error executing admin action: %s", action.action_type)
                errors.append(f"Action '{action.action_type}' failed: {exc}")

        success = len(errors) == 0
        message = "All tasks executed successfully." if success else "Some admin tasks failed or were unsupported."

        return AdminTaskResponse(
            success=success,
            message=message,
            actions_executed=actions_executed,
            errors=errors,
        )
