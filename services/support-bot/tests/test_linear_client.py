"""LinearIssueTracker over httpx MockTransport — the two pinned API gotchas (ADR-0206):
bare (non-Bearer) Authorization, and HTTP 200 with a top-level GraphQL `errors` array as failure.
"""

from __future__ import annotations

import httpx

from caisson_support_bot.linear_client import LinearIssueTracker

from .conftest import make_client


async def test_create_issue_sends_bare_authorization_header_and_explicit_ids() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {"url": "https://linear.app/caisson/issue/CAI-1"},
                    }
                }
            },
        )

    async with make_client(handler) as client:
        tracker = LinearIssueTracker(
            api_key="lin_api_secret", team_id="team-1", state_id="state-1", client=client
        )
        url = await tracker.create_issue(title="Support escalation: q", description="the brief")

    # Linear personal keys are NOT bearer tokens — exact header value, no "Bearer " prefix.
    assert seen["auth"] == "lin_api_secret"
    body = str(seen["body"]).replace(" ", "")
    assert '"teamId":"team-1"' in body
    assert '"stateId":"state-1"' in body
    assert '"title":"Supportescalation:q"' in body
    assert url == "https://linear.app/caisson/issue/CAI-1"


async def test_http_200_with_graphql_errors_array_is_treated_as_failure() -> None:
    # The documented Linear quirk: a rejected mutation can still be a 200 — status alone is not enough.
    async with make_client(
        lambda req: httpx.Response(200, json={"errors": [{"message": "Argument Validation Error"}]})
    ) as client:
        tracker = LinearIssueTracker(api_key="k", team_id="t", state_id="s", client=client)
        url = await tracker.create_issue(title="t", description="d")

    assert url is None


async def test_non_200_status_returns_none() -> None:
    async with make_client(
        lambda req: httpx.Response(401, json={"error": "unauthorized"})
    ) as client:
        tracker = LinearIssueTracker(api_key="k", team_id="t", state_id="s", client=client)
        assert await tracker.create_issue(title="t", description="d") is None


async def test_network_failure_returns_none_not_raise() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("boom", request=request)

    async with make_client(handler) as client:
        tracker = LinearIssueTracker(api_key="k", team_id="t", state_id="s", client=client)
        assert await tracker.create_issue(title="t", description="d") is None


async def test_malformed_json_body_returns_none() -> None:
    async with make_client(lambda req: httpx.Response(200, text="not json")) as client:
        tracker = LinearIssueTracker(api_key="k", team_id="t", state_id="s", client=client)
        assert await tracker.create_issue(title="t", description="d") is None


async def test_missing_issue_url_in_response_returns_none() -> None:
    async with make_client(
        lambda req: httpx.Response(
            200, json={"data": {"issueCreate": {"success": True, "issue": None}}}
        )
    ) as client:
        tracker = LinearIssueTracker(api_key="k", team_id="t", state_id="s", client=client)
        assert await tracker.create_issue(title="t", description="d") is None
