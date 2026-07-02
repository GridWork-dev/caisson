"""Linear GraphQL client — files a Triage issue for each unresolved escalation (ADR-0206).

Best-effort by construction: the ``IssueTracker`` port promises escalation must succeed even when
Linear is down, so every failure mode here (network/timeout, non-2xx, an unparseable body, or a
top-level GraphQL ``errors`` array on an HTTP-200 response) is caught, logged to stderr (the
``telemetry.py`` convention — no logging framework in this codebase), and turned into ``None``. It
never raises.

Two verified API quirks are pinned by tests so they cannot regress silently:
  * Linear personal API keys authenticate with a bare ``Authorization: <key>`` header — no
    ``Bearer `` prefix (unlike ``docs_client.py``'s Bearer convention).
  * The GraphQL endpoint can return HTTP 200 with a top-level ``errors`` array when the mutation is
    rejected (bad input, permission denial) — a 2xx status alone does not mean success.
"""

from __future__ import annotations

import sys

import httpx

_GRAPHQL_URL = "https://api.linear.app/graphql"

_ISSUE_CREATE_MUTATION = """
mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      url
    }
  }
}
"""


class LinearIssueTracker:
    """IssueTracker impl: POSTs ``issueCreate`` with an explicit team + Triage state (ADR-0206).

    The team + state are passed explicitly on every create rather than relying on a Business-tier
    triage automation — plan-independent and testable.
    """

    def __init__(
        self, *, api_key: str, team_id: str, state_id: str, client: httpx.AsyncClient
    ) -> None:
        self._api_key = api_key
        self._team_id = team_id
        self._state_id = state_id
        self._client = client

    async def create_issue(self, *, title: str, description: str) -> str | None:
        """File the Triage issue. Never raises — returns the issue URL, or None on any failure."""
        payload = {
            "query": _ISSUE_CREATE_MUTATION,
            "variables": {
                "input": {
                    "teamId": self._team_id,
                    "stateId": self._state_id,
                    "title": title,
                    "description": description,
                }
            },
        }
        try:
            resp = await self._client.post(
                _GRAPHQL_URL,
                json=payload,
                # Linear personal keys are NOT bearer tokens — no "Bearer " prefix (verified quirk).
                headers={"Authorization": self._api_key},
            )
        except httpx.HTTPError as exc:  # timeout, connect error, etc. — Linear being "down".
            sys.stderr.write(f"[linear] issueCreate request failed: {exc}\n")
            return None

        if resp.status_code != 200:
            sys.stderr.write(
                f"[linear] issueCreate returned {resp.status_code}: {resp.text[:500]}\n"
            )
            return None

        try:
            body = resp.json()
        except ValueError as exc:  # json.JSONDecodeError subclasses ValueError.
            sys.stderr.write(f"[linear] issueCreate returned an unparseable body: {exc}\n")
            return None

        # HTTP 200 does not mean success: a rejected mutation surfaces as a top-level `errors` array.
        errors = body.get("errors") if isinstance(body, dict) else None
        if errors:
            sys.stderr.write(f"[linear] issueCreate returned GraphQL errors: {errors}\n")
            return None

        try:
            return str(body["data"]["issueCreate"]["issue"]["url"])
        except (KeyError, TypeError):
            sys.stderr.write(f"[linear] issueCreate response missing issue url: {body}\n")
            return None
