"""The bot's inbound HTTP surface: liveness + the authed billing-grant push (ADR-0201).

One aiohttp application serves the container's single inbound port. ``GET /health`` keeps the
ADR-0105 liveness contract (unauthenticated, readiness-keyed status). ``POST /billing-grant`` is the
push target ``services/license`` calls after a purchase grant commits and ``apps/site`` calls after a
buyer links Discord (the backfill). It is registered ONLY when ``billing_grant_token`` is configured —
unset means the route 404s and the bot runs unaffected (fail-closed, the config-gating rule every
optional surface here follows).

Security posture (identity/security.md):
  • Bearer auth BEFORE any body read; the token is variable-length, so both sides are SHA-256-digested
    to fixed 32-byte values and compared with ``hmac.compare_digest`` (the variable-length timing-safe
    rule — a raw length-mismatch short-circuit would leak the token length).
  • The body is pydantic-``extra="forbid"`` validated (the Zod-``.strict()`` analogue) with bounded
    fields; ``client_max_size`` caps the payload before parsing.
  • The grant reuses the SAME pure helpers ``/grant-role`` uses (``edition_role_id`` /
    ``role_outranks_bot``), so the manual and pushed paths cannot drift. The pushed path has no
    invoking moderator — the caller is the platform itself, authenticated by the Bearer — so the
    ``member_can_manage_role`` invoker check does not apply; the bot-hierarchy check still does.

aiohttp is discord.py's own HTTP stack (already pinned in uv.lock) — no new dependency class.
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from typing import Annotated

import discord
from aiohttp import web
from discord.ext import commands
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from .config import Settings
from .member_mgmt import edition_role_id, editions_for_entitlements, role_outranks_bot


class BillingGrantRequest(BaseModel):
    """POST /billing-grant body — purchased entitlement ids, verbatim from the caller's grant."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    # A Discord snowflake in string form (JSON numbers would lose precision past 2^53).
    discord_user_id: str = Field(pattern=r"^[0-9]{1,32}$")
    # Purchased ids (editions / bundle / module slugs) — bounded like the pricebook's own schema.
    entitlements: list[Annotated[str, StringConstraints(min_length=1, max_length=128)]] = Field(
        min_length=1, max_length=64
    )


def bearer_ok(header: str | None, expected: str) -> bool:
    """Timing-safe Bearer check (variable-length rule: SHA-256 both sides, then compare_digest)."""
    if not expected or header is None or not header.startswith("Bearer "):
        return False
    presented = header[len("Bearer ") :]
    return hmac.compare_digest(
        hashlib.sha256(presented.encode()).digest(),
        hashlib.sha256(expected.encode()).digest(),
    )


async def find_member(bot: commands.Bot, user_id: int) -> discord.Member | None:
    """Resolve a member across the bot's guilds — cache first, then a single REST fetch per guild.

    ``fetch_member`` needs no privileged intent (it is a targeted REST call, unlike bulk member
    enumeration). NotFound/Forbidden in one guild just means "try the next"; ``None`` means the user
    shares no guild with the bot — the caller answers 404 so the push's log shows the miss.
    """
    for guild in bot.guilds:
        member = guild.get_member(user_id)
        if member is not None:
            return member
        try:
            return await guild.fetch_member(user_id)
        except discord.HTTPException:
            continue
    return None


@dataclass(frozen=True)
class _Deps:
    bot: commands.Bot
    settings: Settings
    token: str


_DEPS: web.AppKey[_Deps] = web.AppKey("caisson_billing_grant_deps")


async def _handle_health(request: web.Request) -> web.Response:
    deps = request.app[_DEPS]
    ready = deps.bot.is_ready()
    return web.json_response({"ok": ready}, status=200 if ready else 503)


async def _handle_billing_grant(request: web.Request) -> web.Response:
    deps = request.app[_DEPS]
    # Auth FIRST — before any body read, mirroring the license service's verify-before-parse posture.
    if not bearer_ok(request.headers.get("Authorization"), deps.token):
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)
    if not deps.bot.is_ready():
        # The gateway is not up yet — the caller's fetch fails visibly and its push is fire-and-forget;
        # the site backfill can simply be retried by re-visiting the page.
        return web.json_response({"ok": False, "error": "bot not ready"}, status=503)

    try:
        payload = BillingGrantRequest.model_validate_json(await request.read())
    except ValidationError:
        # Never echo the rejected body back (redaction-safe, the parseStrict convention).
        return web.json_response({"ok": False, "error": "invalid body"}, status=400)

    member = await find_member(deps.bot, int(payload.discord_user_id))
    if member is None:
        return web.json_response({"ok": False, "error": "member not found"}, status=404)
    guild = member.guild

    # Editions with a configured role, plus the Customer umbrella (any successful purchase). Roles the
    # bot cannot manage (at/above its top role) are skipped rather than failing the whole grant.
    roles: list[discord.Role] = []
    for edition in editions_for_entitlements(list(payload.entitlements)):
        role_id = edition_role_id(deps.settings, edition)
        role = guild.get_role(role_id) if role_id is not None else None
        if role is not None and not role_outranks_bot(role, guild.me.top_role):
            roles.append(role)
    if deps.settings.customer_role_id is not None:
        customer = guild.get_role(deps.settings.customer_role_id)
        if customer is not None and not role_outranks_bot(customer, guild.me.top_role):
            roles.append(customer)
    if not roles:
        # Nothing configured/manageable for these entitlements — a benign no-op, not an error.
        return web.json_response({"ok": True, "granted": []})

    try:
        reason = f"billing-grant: {', '.join(payload.entitlements[:8])}"[:400]
        await member.add_roles(*roles, reason=reason)
    except discord.HTTPException:
        # Forbidden (hierarchy/permission misconfig) or a transient API failure — surface non-2xx so
        # the caller's fire-and-forget log line shows it; never crash the bot.
        return web.json_response({"ok": False, "error": "role grant failed"}, status=502)
    return web.json_response({"ok": True, "granted": [r.name for r in roles]})


def build_app(*, bot: commands.Bot, settings: Settings) -> web.Application:
    """The inbound app: /health always; /billing-grant only when its token is configured."""
    app = web.Application(client_max_size=64 * 1024)
    app[_DEPS] = _Deps(bot=bot, settings=settings, token=settings.billing_grant_token or "")
    app.router.add_get("/health", _handle_health)
    if settings.billing_grant_token:
        app.router.add_post("/billing-grant", _handle_billing_grant)
    return app


async def serve_http(
    *,
    bot: commands.Bot,
    settings: Settings,
    port: int,
    host: str = "0.0.0.0",  # noqa: S104 - container inbound bind; the intended surface (was health.py's).
) -> web.AppRunner:
    """Start the inbound HTTP server; the caller owns ``await runner.cleanup()`` on shutdown."""
    runner = web.AppRunner(build_app(bot=bot, settings=settings))
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    return runner
