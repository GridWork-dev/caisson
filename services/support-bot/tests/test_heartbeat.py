"""The GCE dead-man heartbeat is env-gated and produces a custom gauge point."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from caisson_support_bot import heartbeat as heartbeat_module
from caisson_support_bot.config import Settings
from caisson_support_bot.heartbeat import METRIC_TYPE, run_heartbeat, write_heartbeat


def _settings(**overrides: object) -> Settings:
    return Settings(
        discord_token="x-discord",
        openrouter_api_key="x-openrouter",
        docs_service_url="https://docs.test",  # type: ignore[arg-type]
        docs_service_token="x-docs",
        **overrides,  # type: ignore[arg-type]
    )


def test_heartbeat_is_disabled_by_default() -> None:
    assert _settings().heartbeat_enabled is False


def test_enabled_heartbeat_requires_a_google_cloud_project() -> None:
    with pytest.raises(ValidationError):
        _settings(heartbeat_enabled=True)
    assert (
        _settings(heartbeat_enabled=True, google_cloud_project="caisson-prod").google_cloud_project
        == "caisson-prod"
    )


@pytest.mark.parametrize(
    "project_id",
    [
        "abcde",  # five characters is below Google's six-character floor
        "a" + ("b" * 29) + "c",  # 31 characters exceeds Google's limit
        "caisson-prod-",  # project IDs cannot end in a hyphen
    ],
)
def test_google_cloud_project_matches_the_gcp_project_id_contract(project_id: str) -> None:
    with pytest.raises(ValidationError):
        _settings(heartbeat_enabled=True, google_cloud_project=project_id)


async def test_write_heartbeat_builds_a_global_custom_gauge() -> None:
    client = AsyncMock()

    await write_heartbeat(client=client, project_id="caisson-prod", now_s=1234.5)

    kwargs = client.create_time_series.await_args.kwargs
    assert kwargs["name"] == "projects/caisson-prod"
    assert kwargs["timeout"] == 5.0
    series = kwargs["time_series"][0]
    assert series.metric.type == METRIC_TYPE
    assert series.resource.type == "global"
    assert series.resource.labels["project_id"] == "caisson-prod"
    assert series.points[0].value.bool_value is True
    assert series.points[0].interval.end_time.timestamp() == 1234.5


async def test_heartbeat_emits_only_while_gateway_is_ready() -> None:
    client = AsyncMock()
    stop = asyncio.Event()
    ready = False

    async def wait_once_then_stop() -> None:
        await asyncio.sleep(0)
        stop.set()

    stopper = asyncio.create_task(wait_once_then_stop())
    await run_heartbeat(
        client=client,
        project_id="caisson-prod",
        interval_s=0.01,
        stop=stop,
        is_gateway_ready=lambda: ready,
    )
    await stopper
    client.create_time_series.assert_not_awaited()

    ready = True
    stop = asyncio.Event()

    async def stop_after_emit(*_args: object, **_kwargs: object) -> None:
        stop.set()

    client.create_time_series.side_effect = stop_after_emit
    await run_heartbeat(
        client=client,
        project_id="caisson-prod",
        interval_s=0.01,
        stop=stop,
        is_gateway_ready=lambda: ready,
    )
    client.create_time_series.assert_awaited_once()


async def test_heartbeat_client_initialization_failure_is_visible_and_fail_soft(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def fail_client() -> None:
        raise RuntimeError("credential discovery failed")

    monkeypatch.setattr(heartbeat_module, "MetricServiceAsyncClient", fail_client)

    await run_heartbeat(
        project_id="caisson-prod",
        interval_s=60.0,
        stop=asyncio.Event(),
        is_gateway_ready=lambda: True,
    )

    assert "client initialization failed (RuntimeError)" in capsys.readouterr().err
