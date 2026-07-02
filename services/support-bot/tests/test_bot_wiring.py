"""The Linear sink is env-gated all-or-nothing (ADR-0206): 3 settings + an http client, or off."""

from __future__ import annotations

import httpx

from caisson_support_bot.bot import _linear_issue_tracker
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
