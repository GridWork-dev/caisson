"""LIVE Discord billing-grant proof (seam 2, ADR-0224 F3=B / ADR-0203).

The FULL grant half of seam 2: the license-side leg (services/license/live/discord-grant.live.test.ts)
proves the license service authenticates to the deployed bot; THIS leg proves the piece only a real
gateway can vouch for — a real ``POST /billing-grant`` lands a real role on a real member via
``member.add_roles``, then removes it. The unit suite (tests/test_billing_grant.py) drives ``build_app``
over a MOCKED gateway; here the app is served over a genuine discord.py connection to the real guild.

F3=B fixtures (ADR-0224): the reserved test member is the operator's own account (the guild owner) and
the grant target is a throwaway role ``caisson-proof``. The test maps the Customer umbrella onto that
proof role (``customer_role_id = DISCORD_PROOF_ROLE_ID``) and sends a Customer-only entitlement, so the
ONLY role granted is the throwaway one — never a real edition role — and the teardown removes it.

Marked ``@pytest.mark.live`` (module-level) so ``uv run pytest tests`` never collects it, and it also
self-skips without DISCORD_TOKEN + GUILD_ID + DISCORD_PROOF_USER_ID + DISCORD_PROOF_ROLE_ID +
BILLING_GRANT_TOKEN. Run it with ``uv run pytest -m live -k billing_grant``.
"""

from __future__ import annotations

import asyncio
import os

import discord
import pytest
from aiohttp.test_utils import TestClient, TestServer
from discord.ext import commands

from caisson_support_bot.billing_grant import build_app
from caisson_support_bot.config import Settings

pytestmark = pytest.mark.live

DISCORD_TOKEN = os.environ.get("DISCORD_TOKEN", "")
GUILD_ID = os.environ.get("GUILD_ID", "")
PROOF_USER_ID = os.environ.get("DISCORD_PROOF_USER_ID", "")  # the guild owner (ADR-0224 F3=B)
PROOF_ROLE_ID = os.environ.get("DISCORD_PROOF_ROLE_ID", "")  # the throwaway `caisson-proof` role
GRANT_TOKEN = os.environ.get("BILLING_GRANT_TOKEN", "")

HAVE_CREDS = all(
    len(v) > 0 for v in (DISCORD_TOKEN, GUILD_ID, PROOF_USER_ID, PROOF_ROLE_ID, GRANT_TOKEN)
)
requires_creds = pytest.mark.skipif(
    not HAVE_CREDS,
    reason="Discord live creds absent (DISCORD_TOKEN/GUILD_ID/DISCORD_PROOF_USER_ID/DISCORD_PROOF_ROLE_ID/BILLING_GRANT_TOKEN)",
)


def _proof_settings() -> Settings:
    """Real bot config with the Customer umbrella pointed at the throwaway proof role."""
    return Settings(
        discord_token=DISCORD_TOKEN,
        openrouter_api_key="unused-in-billing-grant",  # required field; the grant path never reads it
        docs_service_url="https://docs.invalid",  # type: ignore[arg-type]  # required field; never called by /billing-grant
        docs_service_token="unused-in-billing-grant",
        billing_grant_token=GRANT_TOKEN,
        guild_id=int(GUILD_ID),
        customer_role_id=int(
            PROOF_ROLE_ID
        ),  # map the umbrella onto caisson-proof — the only role granted
    )  # type: ignore[arg-type]


@requires_creds
async def test_full_grant_lands_the_proof_role_then_removes_it() -> None:
    intents = (
        discord.Intents.default()
    )  # no privileged members intent — fetch_member is a REST call
    bot = commands.Bot(command_prefix="!caisson-proof!", intents=intents)
    # login() awaited directly: wait_until_ready() raises if the client is uninitialised, and a
    # backgrounded start() may not have begun login before the wait — so split login/connect.
    await bot.login(DISCORD_TOKEN)
    gateway = asyncio.create_task(bot.connect())
    try:
        await asyncio.wait_for(bot.wait_until_ready(), timeout=30)
        guild = bot.get_guild(int(GUILD_ID))
        assert guild is not None, "bot is not in GUILD_ID — check the token/guild fixtures"
        proof_role = guild.get_role(int(PROOF_ROLE_ID))
        assert proof_role is not None, "caisson-proof role not found in the guild"

        client = TestClient(TestServer(build_app(bot=bot, settings=_proof_settings())))
        await client.start_server()
        try:
            res = await client.post(
                "/billing-grant",
                json={"discord_user_id": PROOF_USER_ID, "entitlements": ["field-crypto"]},
                headers={"Authorization": f"Bearer {GRANT_TOKEN}"},
            )
            assert res.status == 200
            body = await res.json()
            assert body["ok"] is True
            # Customer-only entitlement mapped onto the proof role ⇒ exactly the proof role is granted.
            assert body["granted"] == [proof_role.name]

            # Independent confirmation: a fresh REST fetch shows the member now holds the proof role —
            # the real add_roles the mocked unit test can only assert was awaited.
            member = await guild.fetch_member(int(PROOF_USER_ID))
            assert any(r.id == int(PROOF_ROLE_ID) for r in member.roles)
        finally:
            await client.close()
    finally:
        # Teardown: strip the throwaway role so no proof state lingers (best-effort — a cleanup failure
        # must not mask the assertion above), then close the gateway.
        try:
            guild = bot.get_guild(int(GUILD_ID))
            if guild is not None:
                role = guild.get_role(int(PROOF_ROLE_ID))
                member = guild.get_member(int(PROOF_USER_ID))
                if member is None:
                    member = await guild.fetch_member(int(PROOF_USER_ID))
                if role is not None and member is not None:
                    await member.remove_roles(role, reason="live-harness proof teardown (ADR-0224)")
        finally:
            await bot.close()
            gateway.cancel()
