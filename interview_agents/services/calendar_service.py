"""
Calendar service — abstract provider + Google Calendar implementation.
Closes the 'AI Scheduling Agent — no Calendar API' diagram gap.

Usage (after configuring GOOGLE_CALENDAR_CREDENTIALS_JSON and GOOGLE_CALENDAR_ID in .env):
    provider = get_calendar_provider()
    event = provider.create_event(
        title="DSA Mock Interview — Batch A",
        date="2026-01-20",
        from_time="10:00",
        to_time="12:00",
        attendees=["student@gla.ac.in"],
        description="Subject: DSA | Difficulty: Medium",
    )
"""
from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import lru_cache

logger = logging.getLogger(__name__)


@dataclass
class CalendarEvent:
    event_id: str
    title: str
    date: str
    from_time: str
    to_time: str
    link: str = ""
    status: str = "created"
    raw: dict = field(default_factory=dict)


class CalendarProvider(ABC):
    """Abstract base class for calendar integrations."""

    @abstractmethod
    def create_event(
        self,
        title: str,
        date: str,
        from_time: str,
        to_time: str,
        attendees: list[str] | None = None,
        description: str = "",
    ) -> CalendarEvent:
        ...

    @abstractmethod
    def update_event(self, event_id: str, **kwargs) -> CalendarEvent:
        ...

    @abstractmethod
    def delete_event(self, event_id: str) -> bool:
        ...


class GoogleCalendarProvider(CalendarProvider):
    """
    Google Calendar integration via google-api-python-client.

    Required env vars:
        GOOGLE_CALENDAR_CREDENTIALS_JSON  — path to service-account credentials file
        GOOGLE_CALENDAR_ID                — target calendar ID (e.g. primary or a@group.calendar.google.com)
        GOOGLE_CALENDAR_TIMEZONE          — e.g. Asia/Kolkata (default: Asia/Kolkata)
    """

    SCOPES = ["https://www.googleapis.com/auth/calendar"]

    def __init__(self) -> None:
        creds_path = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS_JSON", "")
        self.calendar_id = os.environ.get("GOOGLE_CALENDAR_ID", "primary")
        self.timezone = os.environ.get("GOOGLE_CALENDAR_TIMEZONE", "Asia/Kolkata")

        if not creds_path or not os.path.isfile(creds_path):
            raise RuntimeError(
                "Google Calendar: GOOGLE_CALENDAR_CREDENTIALS_JSON must point to a valid "
                "service-account JSON file. Set the env var and restart the server."
            )

        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            creds = service_account.Credentials.from_service_account_file(
                creds_path, scopes=self.SCOPES
            )
            self._service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        except ImportError:
            raise RuntimeError(
                "google-api-python-client is not installed. "
                "Run: pip install google-api-python-client google-auth"
            )

    def create_event(
        self,
        title: str,
        date: str,
        from_time: str,
        to_time: str,
        attendees: list[str] | None = None,
        description: str = "",
    ) -> CalendarEvent:
        body = {
            "summary": title,
            "description": description,
            "start": {"dateTime": f"{date}T{from_time}:00", "timeZone": self.timezone},
            "end": {"dateTime": f"{date}T{to_time}:00", "timeZone": self.timezone},
        }
        if attendees:
            body["attendees"] = [{"email": e} for e in attendees]

        result = self._service.events().insert(calendarId=self.calendar_id, body=body).execute()
        return CalendarEvent(
            event_id=result["id"],
            title=result.get("summary", title),
            date=date,
            from_time=from_time,
            to_time=to_time,
            link=result.get("htmlLink", ""),
            status="created",
            raw=result,
        )

    def update_event(self, event_id: str, **kwargs) -> CalendarEvent:
        existing = self._service.events().get(calendarId=self.calendar_id, eventId=event_id).execute()
        if "title" in kwargs:
            existing["summary"] = kwargs["title"]
        if "description" in kwargs:
            existing["description"] = kwargs["description"]
        result = self._service.events().update(
            calendarId=self.calendar_id, eventId=event_id, body=existing
        ).execute()
        return CalendarEvent(
            event_id=result["id"],
            title=result.get("summary", ""),
            date=result["start"]["dateTime"][:10],
            from_time=result["start"]["dateTime"][11:16],
            to_time=result["end"]["dateTime"][11:16],
            link=result.get("htmlLink", ""),
            status="updated",
            raw=result,
        )

    def delete_event(self, event_id: str) -> bool:
        try:
            self._service.events().delete(calendarId=self.calendar_id, eventId=event_id).execute()
            return True
        except Exception:
            logger.warning("Failed to delete Google Calendar event %s", event_id, exc_info=True)
            return False


class NoOpCalendarProvider(CalendarProvider):
    """Silent no-op used when calendar credentials are not configured."""

    def create_event(self, title, date, from_time, to_time, attendees=None, description="") -> CalendarEvent:
        logger.info("Calendar sync skipped (no provider configured): %s on %s", title, date)
        return CalendarEvent(event_id="", title=title, date=date, from_time=from_time, to_time=to_time, status="skipped")

    def update_event(self, event_id, **kwargs) -> CalendarEvent:
        return CalendarEvent(event_id=event_id, title="", date="", from_time="", to_time="", status="skipped")

    def delete_event(self, event_id) -> bool:
        return True


@lru_cache(maxsize=1)
def get_calendar_provider() -> CalendarProvider:
    """Return the configured CalendarProvider, defaulting to NoOp if unconfigured."""
    provider_name = os.environ.get("CALENDAR_PROVIDER", "").lower()
    if provider_name == "google":
        try:
            return GoogleCalendarProvider()
        except RuntimeError as e:
            logger.warning("Google Calendar init failed (%s) — falling back to NoOp", e)
    return NoOpCalendarProvider()
