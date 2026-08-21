"""Entrypoint and deployment contracts that do not contact Discord or Postgres."""

import tomllib
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from caisson_support_bot import __main__ as entrypoint

PACKAGE_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.asyncio
async def test_database_pool_uses_the_bounded_runtime_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pool = AsyncMock()
    create_pool = AsyncMock(return_value=pool)
    monkeypatch.setattr(entrypoint.asyncpg, "create_pool", create_pool)

    result = await entrypoint._create_database_pool("postgres://example.test/db")

    assert result is pool
    create_pool.assert_awaited_once_with(
        "postgres://example.test/db",
        min_size=0,
        max_size=2,
        max_inactive_connection_lifetime=20.0,
        timeout=4.0,
        command_timeout=25.0,
        server_settings={
            "statement_timeout": "25000",
            "idle_in_transaction_session_timeout": "25000",
        },
    )


def test_gce_deploy_contract_maps_only_named_secret_containers() -> None:
    contract = tomllib.loads((PACKAGE_ROOT / "gce-deploy.toml").read_text())

    assert contract["containers"]["support-bot"]["secret_env"] == {
        "DISCORD_TOKEN": "bot-discord-token",
        "DATABASE_URL": "bot-database-url",
        "BILLING_GRANT_TOKEN": "bot-http-bearer",
    }
    assert contract["containers"]["cloudflared"]["secret_env"] == {
        "TUNNEL_TOKEN": "bot-tunnel-credentials"
    }
