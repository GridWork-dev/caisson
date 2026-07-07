"""SlackThreadOpener over httpx MockTransport — mirrors test_linear_client.py's coverage shape
for the same class of vendor-API quirk: HTTP 200 with `ok: false` as a rejected call (ADR-0287).
"""

from __future__ import annotations

import httpx

from caisson_support_bot.chat_slack import SlackThreadOpener

from .conftest import make_client


async def test_open_thread_posts_bearer_auth_and_channel_plus_bold_title() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = request.read().decode()
        return httpx.Response(200, json={"ok": True, "ts": "1721234567.123456"})

    async with make_client(handler) as client:
        opener = SlackThreadOpener(bot_token="xoxb-secret", channel_id="C0123456789", client=client)
        result = await opener.open_thread(title="Support: q", body="the brief")

    assert seen["auth"] == "Bearer xoxb-secret"
    body = str(seen["body"]).replace(" ", "")
    assert '"channel":"C0123456789"' in body
    assert '"text":"*Support:q*\\nthebrief"' in body
    # See the module docstring: Slack's `ts` doesn't fit this port's `int` id contract, so a
    # successful post still resolves None — matching Discord's own non-thread-capable fallback.
    assert result is None


async def test_ok_false_response_is_treated_as_failure_despite_http_200() -> None:
    # The Slack analog of Linear's documented "200 isn't success" quirk: a rejected call still
    # returns HTTP 200 with `ok: false` + an `error` code.
    async with make_client(
        lambda req: httpx.Response(200, json={"ok": False, "error": "channel_not_found"})
    ) as client:
        opener = SlackThreadOpener(bot_token="k", channel_id="C1", client=client)
        assert await opener.open_thread(title="t", body="d") is None


async def test_non_200_status_returns_none() -> None:
    async with make_client(
        lambda req: httpx.Response(401, json={"ok": False, "error": "invalid_auth"})
    ) as client:
        opener = SlackThreadOpener(bot_token="k", channel_id="C1", client=client)
        assert await opener.open_thread(title="t", body="d") is None


async def test_network_failure_returns_none_not_raise() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("boom", request=request)

    async with make_client(handler) as client:
        opener = SlackThreadOpener(bot_token="k", channel_id="C1", client=client)
        assert await opener.open_thread(title="t", body="d") is None


async def test_malformed_json_body_returns_none() -> None:
    async with make_client(lambda req: httpx.Response(200, text="not json")) as client:
        opener = SlackThreadOpener(bot_token="k", channel_id="C1", client=client)
        assert await opener.open_thread(title="t", body="d") is None
