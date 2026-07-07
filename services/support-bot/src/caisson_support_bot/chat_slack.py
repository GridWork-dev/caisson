"""Slack driver for the ``ChatPlatform`` port (ADR-0287), beside the Discord implementation
(``bot.py``'s ``_DiscordThreadOpener``). Posts the escalation brief via Slack's Web API
``chat.postMessage`` — best-effort: any failure (network, non-2xx, or Slack's own ``ok: false``
envelope, which it returns on an HTTP 200 for most rejected calls) is caught and logged to stderr,
never raised, so a Slack outage can never sink ``Escalator.escalate()`` — the same posture
``linear_client.LinearIssueTracker`` already takes for its own vendor.

Slack has no separate "thread name" concept the way Discord threads do — a Slack thread is just a
reply (``thread_ts``) to its parent message's own timestamp, so ``title`` is folded into the posted
text as a bold header line rather than mapped to a distinct field.

Return-value note: ``ChatPlatform.open_thread`` returns ``int | None`` (matching Discord's numeric
snowflake thread id), but Slack's message timestamp (``ts``) is a decimal STRING (e.g.
``"1721234567.123456"``), and the persisted ``Ticket.discord_thread_id`` column is a Postgres
``bigint`` keyed to Discord's id shape by both name and type. Widening that contract to a
platform-neutral id is a schema migration — out of scope for a driver addition (ADR-0287 scopes this
to the transport seam only). This driver always returns ``None`` for the thread id: the SAME value
Discord's own driver already returns from its non-thread-capable-channel fallback, so the message
still posts and the ticket still persists; only the "audit-trail thread id" slot goes unset for Slack.
"""

from __future__ import annotations

import sys

import httpx

_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage"


class SlackThreadOpener:
    """``ChatPlatform`` bound to one Slack channel via a bot token. Best-effort — never raises.

    Config (bot token, channel id) is injected by the caller (``bot.py``, sourced from ``Settings``)
    — this driver never reads Slack env vars itself, matching every other production driver in this
    codebase (``linear_client.LinearIssueTracker``, ``inference.OpenRouterInference``).
    """

    def __init__(self, *, bot_token: str, channel_id: str, client: httpx.AsyncClient) -> None:
        self._bot_token = bot_token
        self._channel_id = channel_id
        self._client = client

    async def open_thread(self, *, title: str, body: str) -> int | None:
        """Post the escalation message. Always resolves — see the module docstring for why the
        return value is always ``None`` (Slack's `ts` doesn't fit this port's `int` id contract)."""
        text = f"*{title}*\n{body}"
        try:
            resp = await self._client.post(
                _POST_MESSAGE_URL,
                json={"channel": self._channel_id, "text": text},
                headers={"Authorization": f"Bearer {self._bot_token}"},
            )
        except httpx.HTTPError as exc:  # timeout, connect error, etc. — Slack being "down".
            sys.stderr.write(f"[slack] chat.postMessage request failed: {exc}\n")
            return None

        if resp.status_code != 200:
            sys.stderr.write(
                f"[slack] chat.postMessage returned {resp.status_code}: {resp.text[:500]}\n"
            )
            return None

        try:
            data = resp.json()
        except ValueError as exc:  # json.JSONDecodeError subclasses ValueError.
            sys.stderr.write(f"[slack] chat.postMessage returned an unparseable body: {exc}\n")
            return None

        # HTTP 200 does not mean success: Slack signals a rejected call via `ok: false` + `error`
        # (e.g. "invalid_auth", "channel_not_found", "not_in_channel") — the same "2xx isn't success"
        # trap `linear_client.py` already documents for a different vendor's envelope.
        if not isinstance(data, dict) or not data.get("ok"):
            error = data.get("error") if isinstance(data, dict) else "malformed response"
            sys.stderr.write(f"[slack] chat.postMessage rejected: {error}\n")
            return None

        return None
