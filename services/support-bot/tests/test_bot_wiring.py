"""The Linear sink is env-gated all-or-nothing (ADR-0206): 3 settings + an http client, or off.

Also covers the ChatPlatform selector (ADR-0287): Settings' fail-closed slack-requires-both-settings
validator, and `_build_chat_platform`'s Discord/Slack driver selection.
"""

from __future__ import annotations

import httpx
import pytest
from pydantic import ValidationError

from caisson_support_bot.bot import (
    _build_chat_platform,
    _DiscordThreadOpener,
    _linear_issue_tracker,
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
        assert _linear_issue_tracker(_settings(), client) is None


async def test_off_when_client_missing() -> None:
    settings = _settings(linear_api_key="k", linear_team_id="t", linear_triage_state_id="s")
    assert _linear_issue_tracker(settings, None) is None


async def test_off_when_partially_configured() -> None:
    # team id set, state id missing — no partial Linear sink.
    settings = _settings(linear_api_key="k", linear_team_id="t")
    async with httpx.AsyncClient() as client:
        assert _linear_issue_tracker(settings, client) is None


async def test_on_when_fully_configured() -> None:
    settings = _settings(linear_api_key="k", linear_team_id="t", linear_triage_state_id="s")
    async with httpx.AsyncClient() as client:
        tracker = _linear_issue_tracker(settings, client)
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


def test_chat_platform_slack_degrades_to_discord_without_http_client() -> None:
    # No pooled httpx client (e.g. a bare test construction) — never silently drop escalation.
    settings = _settings(
        chat_platform="slack", slack_bot_token="xoxb-x", slack_escalation_channel_id="C1"
    )
    platform = _build_chat_platform(settings, object(), None)  # type: ignore[arg-type]
    assert isinstance(platform, _DiscordThreadOpener)
