"""Reads from Supabase on behalf of the signed-in user.

Every query carries the caller's own access token, so PostgREST applies the same row level
security the browser gets. This service holds no service-role key: it cannot read anything
the user could not read themselves, which keeps the blast radius of a bug here small.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from .config import Settings


class AuthError(Exception):
    """The caller's token is missing, expired or rejected by Supabase."""


class Supabase:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self.s = settings
        self._client = client or httpx.AsyncClient(timeout=settings.request_timeout_s)
        self._token_cache: dict[str, tuple[float, str]] = {}

    async def aclose(self) -> None:
        await self._client.aclose()

    def _headers(self, token: str) -> dict[str, str]:
        return {"apikey": self.s.supabase_anon_key, "Authorization": f"Bearer {token}"}

    async def user_id(self, token: str) -> str:
        """Verify the token with Supabase and return the user id.

        Asking Supabase directly avoids holding a JWT secret or tracking which signing
        algorithm the project uses. Results are cached briefly to keep this off the hot path.
        """
        now = time.monotonic()
        if (hit := self._token_cache.get(token)) and hit[0] > now:
            return hit[1]

        try:
            r = await self._client.get(f"{self.s.supabase_url}/auth/v1/user", headers=self._headers(token))
        except httpx.HTTPError as exc:
            raise AuthError(f"could not reach Supabase: {exc}") from exc

        if r.status_code != 200:
            raise AuthError("invalid or expired session")
        uid = (r.json() or {}).get("id")
        if not uid:
            raise AuthError("token did not identify a user")

        self._token_cache[token] = (now + self.s.token_cache_ttl_s, uid)
        return uid

    async def select(self, token: str, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        """GET from PostgREST under the caller's RLS. Returns [] when the user may see nothing."""
        try:
            r = await self._client.get(
                f"{self.s.supabase_url}/rest/v1/{table}", headers=self._headers(token), params=params
            )
        except httpx.HTTPError as exc:
            raise AuthError(f"could not reach Supabase: {exc}") from exc
        if r.status_code == 401:
            raise AuthError("invalid or expired session")
        r.raise_for_status()
        return r.json() or []

    async def one(self, token: str, table: str, params: dict[str, str]) -> dict[str, Any] | None:
        rows = await self.select(token, table, {**params, "limit": "1"})
        return rows[0] if rows else None
