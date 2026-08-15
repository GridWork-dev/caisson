"""The inbound billing-grant surface (ADR-0203) — aiohttp TestClient over a mocked gateway."""

from __future__ import annotations

from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import discord
import pytest
from aiohttp.test_utils import TestClient, TestServer
from discord.ext import commands

from caisson_support_bot.billing_grant import bearer_ok, build_app
from caisson_support_bot.config import Settings
from caisson_support_bot.escalation import InMemoryTicketStore
from caisson_support_bot.member_mgmt import editions_for_entitlements

TOKEN = "grant-token-value"
ESCALATE_TOKEN = "escalate-token-value"


def _settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "discord_token": "x-discord",
        "openrouter_api_key": "x-openrouter",
        "docs_service_url": "https://docs.test",
        "docs_service_token": "x-docs",
        "billing_grant_token": TOKEN,
        "role_compliance_id": 111,
        "role_ai_kit_id": 222,
        "role_local_first_id": 333,
        "role_agentic_id": 444,
        "customer_role_id": 555,
        "role_priority_support_id": 666,
        # The no-guild-pin default most cases here want; conftest's `_scrub_ambient_env`
        # autouse fixture (root-causing the old ambient-GUILD_ID leak) keeps this predictable
        # regardless of what the operator shell has sourced.
        "guild_id": None,
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


class _FakeRole:
    """Duck-typed Role: id/name plus the position ordering role_outranks_bot compares with."""

    def __init__(self, role_id: int, name: str, position: int = 1) -> None:
        self.id = role_id
        self.name = name
        self.position = position

    def __ge__(self, other: _FakeRole) -> bool:
        return self.position >= other.position

    def __lt__(self, other: _FakeRole) -> bool:
        return self.position < other.position


def _role(role_id: int, name: str, position: int = 1) -> _FakeRole:
    return _FakeRole(role_id, name, position)


def _guild_with_member(
    member_found: bool = True, guild_id: int = 1
) -> tuple[SimpleNamespace, SimpleNamespace]:
    """A guild whose role/member lookups behave like the live gateway cache."""
    roles = {
        111: _role(111, "Compliance"),
        222: _role(222, "AI Kit"),
        333: _role(333, "Local-first"),
        444: _role(444, "Agentic"),
        555: _role(555, "Customer"),
        666: _role(666, "Priority Support"),
    }
    member = SimpleNamespace(add_roles=AsyncMock(), guild=None)
    guild = SimpleNamespace(
        id=guild_id,
        get_role=lambda rid: roles.get(rid),
        get_member=lambda uid: member if member_found else None,
        fetch_member=AsyncMock(side_effect=discord.HTTPException(MagicMock(status=404), "nf")),
        me=SimpleNamespace(top_role=_role(999, "Bot", position=100)),
    )
    member.guild = guild
    return guild, member


def _bot(guild: SimpleNamespace | list[SimpleNamespace] | None, ready: bool = True) -> commands.Bot:
    guilds = guild if isinstance(guild, list) else [guild] if guild is not None else []
    bot = SimpleNamespace(
        guilds=guilds,
        get_guild=lambda gid: next((g for g in guilds if g.id == gid), None),
        is_ready=lambda: ready,
    )
    return cast(commands.Bot, bot)


async def _client(bot: commands.Bot, settings: Settings) -> TestClient:
    client = TestClient(TestServer(build_app(bot=bot, settings=settings)))
    await client.start_server()
    return client


async def _escalate_client(
    bot: commands.Bot, settings: Settings, store: InMemoryTicketStore | None = None
) -> TestClient:
    client = TestClient(TestServer(build_app(bot=bot, settings=settings, store=store)))
    await client.start_server()
    return client


def test_bearer_ok_timing_safe_compare() -> None:
    assert bearer_ok(f"Bearer {TOKEN}", TOKEN) is True
    assert bearer_ok("Bearer wrong", TOKEN) is False
    assert bearer_ok(TOKEN, TOKEN) is False  # missing Bearer prefix
    assert bearer_ok(None, TOKEN) is False
    assert bearer_ok(f"Bearer {TOKEN}", "") is False  # unconfigured ⇒ fail closed


def test_editions_for_entitlements_expands_bundle_and_drops_unknown() -> None:
    assert editions_for_entitlements(["compliance"]) == ["compliance"]
    assert editions_for_entitlements(["bundle"]) == [
        "compliance",
        "ai-kit",
        "local-ai",
        "agent-dev",
    ]
    # De-dup + module slugs/credit packs drop out (Customer umbrella is the caller's job).
    assert editions_for_entitlements(["bundle", "compliance", "field-crypto"]) == [
        "compliance",
        "ai-kit",
        "local-ai",
        "agent-dev",
    ]
    assert editions_for_entitlements(["field-crypto"]) == []


async def test_route_not_served_when_unconfigured() -> None:
    guild, _ = _guild_with_member()
    client = await _client(_bot(guild), _settings(billing_grant_token=None))
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 404  # fail-closed: the route does not exist without its token
        health = await client.get("/health")
        assert health.status == 200  # liveness unaffected
    finally:
        await client.close()


async def test_rejects_bad_token_before_parsing() -> None:
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            data=b"not even json",
            headers={"Authorization": "Bearer wrong"},
        )
        assert res.status == 401
        member.add_roles.assert_not_awaited()
    finally:
        await client.close()


async def test_rejects_invalid_body_strict() -> None:
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        for body in (
            {"discord_user_id": "42", "entitlements": []},  # empty grant is meaningless
            {"discord_user_id": "not-a-snowflake", "entitlements": ["compliance"]},
            {"discord_user_id": "42", "entitlements": ["compliance"], "extra": 1},  # unknown field
        ):
            res = await client.post(
                "/billing-grant", json=body, headers={"Authorization": f"Bearer {TOKEN}"}
            )
            assert res.status == 400
        member.add_roles.assert_not_awaited()
    finally:
        await client.close()


async def test_unknown_member_404s() -> None:
    guild, _ = _guild_with_member(member_found=False)
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 404
    finally:
        await client.close()


async def test_happy_path_grants_edition_roles_plus_customer() -> None:
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["bundle"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 200
        body = await res.json()
        assert body["ok"] is True
        assert body["granted"] == ["Compliance", "AI Kit", "Local-first", "Agentic", "Customer"]
        member.add_roles.assert_awaited_once()
        granted_ids = [r.id for r in member.add_roles.await_args.args]
        assert granted_ids == [111, 222, 333, 444, 555]
    finally:
        await client.close()


async def test_credit_pack_grants_customer_only() -> None:
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["field-crypto"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 200
        assert (await res.json())["granted"] == ["Customer"]
        granted_ids = [r.id for r in member.add_roles.await_args.args]
        assert granted_ids == [555]
    finally:
        await client.close()


async def test_priority_support_grants_role_plus_customer() -> None:
    # ADR-0278/0288: a standalone entitlement id, not swept into the edition map.
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["priority-support"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 200
        assert (await res.json())["granted"] == ["Priority Support", "Customer"]
        granted_ids = [r.id for r in member.add_roles.await_args.args]
        assert granted_ids == [666, 555]
    finally:
        await client.close()


async def test_priority_support_role_unset_fails_closed_to_standard_support() -> None:
    # No configured role id ⇒ the grant no-ops on priority-support (still grants Customer) —
    # never guesses a role. Mirrors member_has_priority_support's own fail-closed contract.
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings(role_priority_support_id=None))
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["priority-support"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 200
        assert (await res.json())["granted"] == ["Customer"]
        granted_ids = [r.id for r in member.add_roles.await_args.args]
        assert granted_ids == [555]
    finally:
        await client.close()


async def test_bundle_purchase_never_grants_priority_support() -> None:
    # The other half of the fail-closed guard: a plain edition/bundle buy must never sweep in the
    # priority-support role (member_has_priority_support's own docstring rationale).
    guild, member = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["bundle"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 200
        granted_ids = [r.id for r in member.add_roles.await_args.args]
        assert 666 not in granted_ids
    finally:
        await client.close()


async def test_multi_guild_without_guild_id_refuses() -> None:
    # Two guilds, no GUILD_ID: the grant target is ambiguous — refuse, never guess a server.
    g1, stranger = _guild_with_member(guild_id=1)
    g2, member = _guild_with_member(guild_id=2)
    client = await _client(_bot([g1, g2]), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 503
        stranger.add_roles.assert_not_awaited()
        member.add_roles.assert_not_awaited()
    finally:
        await client.close()


async def test_guild_id_pins_the_grant_guild() -> None:
    # The buyer also shares an EARLIER foreign guild with the bot — the old first-match lookup
    # would have granted there; GUILD_ID pins the grant to the Caisson guild.
    g1, foreign_member = _guild_with_member(guild_id=1)
    g2, member = _guild_with_member(guild_id=2)
    client = await _client(_bot([g1, g2]), _settings(guild_id=2))
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 200
        member.add_roles.assert_awaited_once()
        foreign_member.add_roles.assert_not_awaited()
    finally:
        await client.close()


async def test_guild_id_not_joined_refuses() -> None:
    g1, member = _guild_with_member(guild_id=1)
    client = await _client(_bot(g1), _settings(guild_id=99))
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 503
        member.add_roles.assert_not_awaited()
    finally:
        await client.close()


async def test_grant_failure_returns_502_never_crashes() -> None:
    guild, member = _guild_with_member()
    resp = MagicMock()
    resp.status = 403
    resp.reason = "Forbidden"
    member.add_roles.side_effect = discord.Forbidden(resp, "missing perms")
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 502
        assert (await res.json())["ok"] is False
    finally:
        await client.close()


async def test_not_ready_returns_503() -> None:
    guild, _ = _guild_with_member()
    client = await _client(_bot(guild, ready=False), _settings())
    try:
        res = await client.post(
            "/billing-grant",
            json={"discord_user_id": "42", "entitlements": ["compliance"]},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert res.status == 503
        health = await client.get("/health")
        assert health.status == 503
    finally:
        await client.close()


@pytest.mark.parametrize("path", ["/health"])
async def test_health_contract_kept(path: str) -> None:
    guild, _ = _guild_with_member()
    client = await _client(_bot(guild), _settings(billing_grant_token=None))
    try:
        res = await client.get(path)
        assert res.status == 200
        assert await res.json() == {"ok": True}
    finally:
        await client.close()


# --- the house security-header floor (identity/security.md, CLOUD-AUDIT F-10) ----------------------


async def test_health_carries_the_security_header_floor() -> None:
    """The finding as filed: /health answered 200 with none of the three headers."""
    guild, _ = _guild_with_member()
    client = await _client(_bot(guild), _settings(billing_grant_token=None))
    try:
        res = await client.get("/health")
        assert res.status == 200
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["X-Frame-Options"] == "DENY"
        assert res.headers["Strict-Transport-Security"] == "max-age=63072000; includeSubDomains"
    finally:
        await client.close()


async def test_authed_route_responses_carry_the_security_header_floor() -> None:
    """A 401 is still a production response — the floor is not scoped to the happy path."""
    guild, _ = _guild_with_member()
    client = await _client(_bot(guild), _settings())
    try:
        res = await client.post("/billing-grant", json={})
        assert res.status == 401
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["X-Frame-Options"] == "DENY"
        assert res.headers["Strict-Transport-Security"] == "max-age=63072000; includeSubDomains"
    finally:
        await client.close()


async def test_framework_raised_404_carries_the_security_header_floor() -> None:
    """The arm a return-only middleware silently misses.

    aiohttp RAISES ``web.HTTPException`` for a router miss rather than returning it, so a middleware
    that only decorates ``await handler(request)``'s return value leaves every 404 bare — and with
    both POST tokens unset, a 404 is what an unauthenticated scanner actually receives here.
    """
    guild, _ = _guild_with_member()
    client = await _client(
        _bot(guild), _settings(billing_grant_token=None, site_escalate_token=None)
    )
    try:
        res = await client.post("/billing-grant", json={})
        assert res.status == 404
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["X-Frame-Options"] == "DENY"
        assert res.headers["Strict-Transport-Security"] == "max-age=63072000; includeSubDomains"
    finally:
        await client.close()


# --- POST /escalate (apps/site Ask-AI parity — reuses the same Escalator/Linear sink) --------------


async def test_escalate_route_not_served_when_unconfigured() -> None:
    guild, _ = _guild_with_member()
    client = await _client(_bot(guild), _settings(site_escalate_token=None))
    try:
        res = await client.post(
            "/escalate",
            json={"question": "does compliance do HIPAA?", "reason": "no_match"},
            headers={"Authorization": f"Bearer {ESCALATE_TOKEN}"},
        )
        assert res.status == 404  # fail-closed: the route does not exist without its token
    finally:
        await client.close()


async def test_escalate_rejects_bad_token_before_parsing() -> None:
    guild, _ = _guild_with_member()
    client = await _escalate_client(_bot(guild), _settings(site_escalate_token=ESCALATE_TOKEN))
    try:
        res = await client.post(
            "/escalate", data=b"not even json", headers={"Authorization": "Bearer wrong"}
        )
        assert res.status == 401
    finally:
        await client.close()


async def test_escalate_rejects_invalid_body_strict() -> None:
    guild, _ = _guild_with_member()
    client = await _escalate_client(_bot(guild), _settings(site_escalate_token=ESCALATE_TOKEN))
    try:
        for body in (
            {"question": "", "reason": "no_match"},  # empty question
            {"question": "q"},  # missing reason
            {"question": "q", "reason": "no_match", "extra": 1},  # unknown field (.strict analogue)
        ):
            res = await client.post(
                "/escalate", json=body, headers={"Authorization": f"Bearer {ESCALATE_TOKEN}"}
            )
            assert res.status == 400
    finally:
        await client.close()


async def test_escalate_happy_path_files_a_ticket() -> None:
    guild, _ = _guild_with_member()
    store = InMemoryTicketStore()
    client = await _escalate_client(
        _bot(guild), _settings(site_escalate_token=ESCALATE_TOKEN), store=store
    )
    try:
        res = await client.post(
            "/escalate",
            json={"question": "does compliance do HIPAA?", "reason": "no_match"},
            headers={"Authorization": f"Bearer {ESCALATE_TOKEN}"},
        )
        assert res.status == 200
        assert (await res.json())["ok"] is True
        assert len(store.tickets) == 1
        assert store.tickets[0].question == "does compliance do HIPAA?"
        assert (
            store.tickets[0].discord_thread_id is None
        )  # no Discord channel context for a site push
    finally:
        await client.close()


async def test_escalate_without_a_store_still_accepts_the_push() -> None:
    # Best-effort by construction (mirrors the Discord bot's own escalation ports): a deployment with
    # no DATABASE_URL still accepts the push and never 500s, it just files nothing durable.
    guild, _ = _guild_with_member()
    client = await _escalate_client(_bot(guild), _settings(site_escalate_token=ESCALATE_TOKEN))
    try:
        res = await client.post(
            "/escalate",
            json={"question": "q", "reason": "spend_cap"},
            headers={"Authorization": f"Bearer {ESCALATE_TOKEN}"},
        )
        assert res.status == 200
    finally:
        await client.close()
