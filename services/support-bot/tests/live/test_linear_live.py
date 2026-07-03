"""LIVE Linear Triage sink proof (seam 3, ADR-0224 / ADR-0206).

The unit suite (tests/test_linear_client.py) pins the two API quirks against an httpx MockTransport:
the bare (non-``Bearer``) Authorization header and the HTTP-200-with-``errors`` failure. THIS leg
proves the one thing a double cannot — the REAL Linear GraphQL API accepts the real personal key with
that exact bare-header auth and returns a real ``issue.url``. A rotated/wrong-scoped LINEAR_API_KEY, a
stale team id, or a Triage-state id from another workspace passes every unit test and fails HERE.

Linear issues are cheap + archivable (unlike WORM objects), so the proof files one real Triage issue
with a unique per-run title, asserts the returned url, then archives it by that title in teardown.

Marked ``@pytest.mark.live`` (module-level) so ``uv run pytest tests`` never collects it, and it also
self-skips without LINEAR_API_KEY + LINEAR_TEAM_ID + LINEAR_TRIAGE_STATE_ID. Run it with
``uv run pytest -m live -k linear``.
"""

from __future__ import annotations

import os
import uuid

import httpx
import pytest

from caisson_support_bot.linear_client import LinearIssueTracker

pytestmark = pytest.mark.live

API_KEY = os.environ.get("LINEAR_API_KEY", "")
TEAM_ID = os.environ.get("LINEAR_TEAM_ID", "")
STATE_ID = os.environ.get("LINEAR_TRIAGE_STATE_ID", "")

HAVE_CREDS = all(len(v) > 0 for v in (API_KEY, TEAM_ID, STATE_ID))
requires_creds = pytest.mark.skipif(
    not HAVE_CREDS,
    reason="Linear live creds absent (LINEAR_API_KEY/LINEAR_TEAM_ID/LINEAR_TRIAGE_STATE_ID)",
)

_GRAPHQL_URL = "https://api.linear.app/graphql"


async def _archive_by_title(client: httpx.AsyncClient, title: str) -> None:
    """Best-effort teardown: find the just-created issue by its unique title and archive it."""
    find = "query($t:String!){ issues(filter:{title:{eq:$t}}, first:1){ nodes{ id } } }"
    resp = await client.post(
        _GRAPHQL_URL,
        json={"query": find, "variables": {"t": title}},
        headers={"Authorization": API_KEY},  # bare key, no Bearer — same quirk as the product client
    )
    nodes = resp.json().get("data", {}).get("issues", {}).get("nodes", [])
    if not nodes:
        return
    issue_id = nodes[0]["id"]
    archive = "mutation($id:String!){ issueArchive(id:$id){ success } }"
    await client.post(
        _GRAPHQL_URL,
        json={"query": archive, "variables": {"id": issue_id}},
        headers={"Authorization": API_KEY},
    )


@requires_creds
async def test_files_and_archives_a_real_triage_issue() -> None:
    title = f"[live-harness proof] delete me {uuid.uuid4()}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        tracker = LinearIssueTracker(
            api_key=API_KEY, team_id=TEAM_ID, state_id=STATE_ID, client=client
        )
        try:
            url = await tracker.create_issue(
                title=title,
                description="Automated live-harness proof (ADR-0224). Archived on teardown — safe to delete.",
            )
            # The real API returned a real issue url — the bare-header auth + explicit team/state held.
            assert url is not None
            assert url.startswith("https://linear.app/")
        finally:
            await _archive_by_title(client, title)
