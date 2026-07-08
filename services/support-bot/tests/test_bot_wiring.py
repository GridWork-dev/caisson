"""The Linear sink is env-gated all-or-nothing (ADR-0206): 3 settings + an http client, or off.

Also covers the ChatPlatform selector (ADR-0287): Settings' fail-closed slack-requires-both-settings
validator, `_build_chat_platform`'s Discord/Slack driver selection (fail-closed, never a silent
wrong-platform degrade), and `_human_mention`'s platform-appropriate mention syntax.
"""

from __future__ import annotations

import httpx
import pytest
from pydantic import ValidationError

from caisson_support_bot.bot import (
    _build_chat_platform,
    _DiscordThreadOpener,
    _human_mention,
    linear_issue_tracker,
)
from caisson_support_bot.chat_slack import SlackThreadOpener
from caisson_support_bot.config import Settings
from caisson_support_bot.linear_client import LinearIssueTracker


def _settings(**overrides: object) -> Settings:
    return Settings(
        discord_token="x-discord",
        openrouter_api_key="x-openrouter",
        docs_service_url="https://docs.test",  # type: ignore[arg-type]
        docs_service_token="x-docs",
        **overrides,  # type: ignore[arg-type]
    )


async def test_off_when_no_linear_settings() -> None:
    async with httpx.AsyncClient() as client:
        assert linear_issue_tracker(_settings(), client) is None


async def test_off_when_client_missing() -> None:
    settings = _settings(linear_api_key="k", linear_team_id="t", linear_triage_state_id="s")
    assert linear_issue_tracker(settings, None) is None


async def test_off_when_partially_configured() -> None:
    # team id set, state id missing — no partial Linear sink.
    settings = _settings(linear_api_key="k", linear_team_id="t")
    async with httpx.AsyncClient() as client:
        assert linear_issue_tracker(settings, client) is None


async def test_on_when_fully_configured() -> None:
    settings = _settings(linear_api_key="k", linear_team_id="t", linear_triage_state_id="s")
    async with httpx.AsyncClient() as client:
        tracker = linear_issue_tracker(settings, client)
    assert isinstance(tracker, LinearIssueTracker)


def test_settings_slack_requires_both_slack_settings() -> None:
    with pytest.raises(ValidationError):
        _settings(chat_platform="slack")
    with pytest.raises(ValidationError):
        _settings(chat_platform="slack", slack_bot_token="xoxb-x")
    with pytest.raises(ValidationError):
        _settings(chat_platform="slack", slack_escalation_channel_id="C1")
    # Both set: constructs fine.
    _settings(chat_platform="slack", slack_bot_token="xoxb-x", slack_escalation_channel_id="C1")


async def test_chat_platform_discord_by_default() -> None:
    settings = _settings()
    async with httpx.AsyncClient() as client:
        platform = _build_chat_platform(settings, object(), client)  # type: ignore[arg-type]
    assert isinstance(platform, _DiscordThreadOpener)


async def test_chat_platform_slack_when_configured() -> None:
    settings = _settings(
        chat_platform="slack", slack_bot_token="xoxb-x", slack_escalation_channel_id="C1"
    )
    async with httpx.AsyncClient() as client:
        platform = _build_chat_platform(settings, object(), client)  # type: ignore[arg-type]
    assert isinstance(platform, SlackThreadOpener)


def test_chat_platform_slack_without_http_client_fails_closed() -> None:
    # No pooled httpx client — FAILS CLOSED (raises), never silently degrades to routing the
    # escalation into the live Discord channel instead of the operator's configured Slack channel.
    settings = _settings(
        chat_platform="slack", slack_bot_token="xoxb-x", slack_escalation_channel_id="C1"
    )
    with pytest.raises(RuntimeError):
        _build_chat_platform(settings, object(), None)  # type: ignore[arg-type]


def test_human_mention_discord_role_syntax_by_default() -> None:
    settings = _settings(support_human_role_id=4242)
    assert _human_mention(settings) == "<@&4242>"


def test_human_mention_none_when_discord_role_unset() -> None:
    # Explicit None override — the operator's real shell env may carry a live SUPPORT_HUMAN_ROLE_ID
    # (pydantic-settings reads OS env for any field the test doesn't override).
    settings = _settings(support_human_role_id=None)
    assert _human_mention(settings) is None


def test_human_mention_slack_syntax_on_slack_platform_never_the_discord_literal() -> None:
    settings = _settings(
        chat_platform="slack",
        slack_bot_token="xoxb-x",
        slack_escalation_channel_id="C1",
        slack_escalation_mention="<!subteam^S0123>",
        # A Discord role id is ALSO set, to prove the Slack path never emits its `<@&…>` literal —
        # posting that string into Slack renders as dead text and pings nobody (ADR-0287 P2-01).
        support_human_role_id=4242,
    )
    mention = _human_mention(settings)
    assert mention == "<!subteam^S0123>"
    assert mention is not None
    assert "<@&" not in mention


def test_human_mention_none_on_slack_when_no_mention_configured() -> None:
    # A Slack deployment with no slack_escalation_mention posts to the channel only — same
    # unset-degrades-to-no-ping behavior as Discord's support_human_role_id, never the Discord
    # literal as a fallback.
    settings = _settings(
        chat_platform="slack",
        slack_bot_token="xoxb-x",
        slack_escalation_channel_id="C1",
        support_human_role_id=4242,
    )
    assert _human_mention(settings) is None
