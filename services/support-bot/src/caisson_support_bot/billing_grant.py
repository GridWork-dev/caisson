"""The bot's inbound HTTP surface: liveness + the authed billing-grant + site-escalate pushes.

One aiohttp application serves the container's single inbound port. ``GET /health`` keeps the
ADR-0105 liveness contract (unauthenticated, readiness-keyed status). ``POST /billing-grant`` (ADR-0203)
is the push target ``services/license`` calls after a purchase grant commits and ``apps/site`` calls
after a buyer links Discord (the backfill). ``POST /escalate`` is the push target ``apps/site``'s
Ask-AI widget calls when it cannot answer a question — it files through the SAME ``Escalator`` +
Linear Triage sink (ADR-0206) the Discord bot's own escalations use, so a site-originated question a
human needs to see gets the same ticket/Triage-issue treatment a Discord one does. Both POST routes
are registered ONLY when their own token is configured — unset means the route 404s and the bot runs
unaffected (fail-closed, the config-gating rule every optional surface here follows).

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
from typing import TYPE_CHECKING, Annotated

import discord
from aiohttp import web
from discord.ext import commands
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from .bot import linear_issue_tracker
from .config import Settings
from .contracts import Brief
from .escalation import Escalator, IssueTracker, TicketStore
from .lifecycle import PrivilegedWorkClosed, PrivilegedWorkGate
from .member_mgmt import (
    PRIORITY_SUPPORT_ENTITLEMENT_ID,
    edition_role_id,
    editions_for_entitlements,
    priority_support_role_id,
    role_outranks_bot,
)

if TYPE_CHECKING:  # pragma: no cover - typing only (avoids a real import cycle at module load)
    import httpx

    # `aiohttp.web.Handler` does NOT exist at runtime (checked against the pinned 3.14.3) — the
    # canonical export is `aiohttp.typedefs.Handler`. Under `from __future__ import annotations` a
    # wrong name here is a silent no-op rather than an ImportError, so pyright is the only thing
    # that catches it; keep this import here rather than inlining a Callable alias.
    from aiohttp.typedefs import Handler


class BillingGrantRequest(BaseModel):
    """POST /billing-grant body — purchased entitlement ids, verbatim from the caller's grant."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    # A Discord snowflake in string form (JSON numbers would lose precision past 2^53).
    discord_user_id: str = Field(pattern=r"^[0-9]{1,32}$")
    # Purchased ids (editions / bundle / module slugs) — bounded like the pricebook's own schema.
    entitlements: list[Annotated[str, StringConstraints(min_length=1, max_length=128)]] = Field(
        min_length=1, max_length=64
    )


class SiteEscalateRequest(BaseModel):
    """POST /escalate body — a question the site Ask-AI widget could not answer.

    Bounds mirror the site's own AskBody (`apps/site/lib/ask-ai/handler.ts`): a question up to 2000
    chars, plus a short machine-readable reason the widget already has (its EscalationReason union).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    question: str = Field(min_length=1, max_length=2000)
    reason: str = Field(min_length=1, max_length=64)


def bearer_ok(header: str | None, expected: str) -> bool:
    """Timing-safe Bearer check (variable-length rule: SHA-256 both sides, then compare_digest)."""
    if not expected or header is None or not header.startswith("Bearer "):
        return False
    presented = header[len("Bearer ") :]
    return hmac.compare_digest(
        hashlib.sha256(presented.encode()).digest(),
        hashlib.sha256(expected.encode()).digest(),
    )


def grant_guild(bot: commands.Bot, settings: Settings) -> discord.Guild | None:
    """The ONE guild billing grants apply to — never "whichever guild matched first".

    ``guild_id`` set → that guild or nothing. Unset → the bot's sole guild, and ``None`` when the
    bot sits in several (ambiguous — the configured role ids belong to exactly one server, so
    granting in "the first guild that knows the user" could target the wrong server). Fail-closed.
    """
    if settings.guild_id is not None:
        return bot.get_guild(settings.guild_id)
    if len(bot.guilds) == 1:
        return bot.guilds[0]
    return None


async def find_member(guild: discord.Guild, user_id: int) -> discord.Member | None:
    """Resolve a member in the grant guild — cache first, then a single REST fetch.

    ``fetch_member`` needs no privileged intent (it is a targeted REST call, unlike bulk member
    enumeration). ``None`` means the user is not in the guild — the caller answers 404 so the
    push's log shows the miss.
    """
    member = guild.get_member(user_id)
    if member is not None:
        return member
    try:
        return await guild.fetch_member(user_id)
    except discord.HTTPException:
        return None


@dataclass(frozen=True)
class _Deps:
    bot: commands.Bot
    settings: Settings
    token: str
    escalate_token: str
    store: TicketStore | None
    issue_tracker: IssueTracker | None
    work_gate: PrivilegedWorkGate


_DEPS: web.AppKey[_Deps] = web.AppKey("caisson_billing_grant_deps")

# The house production-response header floor (identity/security.md, Headers). Byte-identical to the
# TypeScript services' own SECURITY_HEADERS consts (services/docs/src/app.ts, services/license/src/
# app.ts, packages/mcp-server/src/http.ts) — this service was the only surface in the fleet missing
# them (CLOUD-AUDIT F-10: /health answered 200 with none of the three).
#
# Applied in the app's response path, NOT at the edge, because this origin is reachable directly on
# caisson-support-bot-production.up.railway.app — the same shape as the F-03 bypass, where an edge
# gate bound a hostname and the Railway origin answered around it.
SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
}


@web.middleware
async def _security_headers(request: web.Request, handler: Handler) -> web.StreamResponse:
    """Set the header floor on every response, including aiohttp's own generated errors.

    aiohttp surfaces a router miss (404 — the state both POST routes sit in when their token is
    unset), a method mismatch (405), and a ``client_max_size`` overflow (413) by RAISING
    ``web.HTTPException`` rather than returning it, so a middleware that only decorates the returned
    response would leave exactly the responses an unauthenticated scanner sees bare.
    """
    try:
        response = await handler(request)
    except web.HTTPException as exc:
        exc.headers.update(SECURITY_HEADERS)
        raise
    response.headers.update(SECURITY_HEADERS)
    return response


async def _handle_health(request: web.Request) -> web.Response:
    deps = request.app[_DEPS]
    ready = deps.bot.is_ready()
    return web.json_response({"ok": ready}, status=200 if ready else 503)


async def _handle_site_escalate(request: web.Request) -> web.Response:
    deps = request.app[_DEPS]
    # Auth FIRST — before any body read, mirroring /billing-grant's own posture.
    if not bearer_ok(request.headers.get("Authorization"), deps.escalate_token):
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)
    try:
        async with deps.work_gate.track():
            try:
                payload = SiteEscalateRequest.model_validate_json(await request.read())
            except ValidationError:
                return web.json_response({"ok": False, "error": "invalid body"}, status=400)

            # Reuses the SAME Escalator + Linear Triage sink the Discord bot's own unresolved
            # questions file through (ADR-0206) — no second Linear client, no second ticket table.
            brief = Brief(
                question=payload.question,
                summary=f"Escalated from the site Ask-AI widget (reason: {payload.reason}).",
            )
            await Escalator(store=deps.store, issue_tracker=deps.issue_tracker).escalate(brief)
            return web.json_response({"ok": True})
    except PrivilegedWorkClosed:
        return web.json_response({"ok": False, "error": "shutting down"}, status=503)


async def _handle_billing_grant(request: web.Request) -> web.Response:
    deps = request.app[_DEPS]
    # Auth FIRST — before any body read, mirroring the license service's verify-before-parse posture.
    if not bearer_ok(request.headers.get("Authorization"), deps.token):
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)
    try:
        async with deps.work_gate.track():
            return await _apply_billing_grant(request, deps)
    except PrivilegedWorkClosed:
        return web.json_response({"ok": False, "error": "shutting down"}, status=503)


async def _apply_billing_grant(request: web.Request, deps: _Deps) -> web.Response:
    """Validate and apply one retry-safe grant while the shutdown gate tracks this task."""
    if not deps.bot.is_ready():
        # The gateway is not up yet — the caller's fetch fails visibly and its push is fire-and-forget;
        # the site backfill can simply be retried by re-visiting the page.
        return web.json_response({"ok": False, "error": "bot not ready"}, status=503)

    try:
        payload = BillingGrantRequest.model_validate_json(await request.read())
    except ValidationError:
        # Never echo the rejected body back (redaction-safe, the parseStrict convention).
        return web.json_response({"ok": False, "error": "invalid body"}, status=400)

    guild = grant_guild(deps.bot, deps.settings)
    if guild is None:
        # No unambiguous grant target (GUILD_ID unset while the bot sits in several guilds, or the
        # bot is not in the configured guild) — refuse rather than guess a server.
        return web.json_response({"ok": False, "error": "grant guild unresolved"}, status=503)
    member = await find_member(guild, int(payload.discord_user_id))
    if member is None:
        return web.json_response({"ok": False, "error": "member not found"}, status=404)

    # Idempotency is explicit rather than merely relying on Discord add_roles' set-like semantics:
    # a retry filters every role the member already holds and becomes a no-op.
    existing_role_ids = {role.id for role in member.roles}
    roles: list[discord.Role] = []

    def add_if_grantable(role: discord.Role | None) -> None:
        if (
            role is not None
            and role.id not in existing_role_ids
            and all(candidate.id != role.id for candidate in roles)
            and not role_outranks_bot(role, guild.me.top_role)
        ):
            roles.append(role)

    for edition in editions_for_entitlements(list(payload.entitlements)):
        role_id = edition_role_id(deps.settings, edition)
        add_if_grantable(guild.get_role(role_id) if role_id is not None else None)
    # Priority-support (ADR-0278/0288): a standalone id, deliberately outside `editions_for_
    # entitlements` (a plain bundle purchase must never grant it). Fail-closed like every other
    # role here — an unset role id or an unmanageable role is a benign no-op, never an error.
    if PRIORITY_SUPPORT_ENTITLEMENT_ID in payload.entitlements:
        role_id = priority_support_role_id(deps.settings)
        add_if_grantable(guild.get_role(role_id) if role_id is not None else None)
    if deps.settings.customer_role_id is not None:
        add_if_grantable(guild.get_role(deps.settings.customer_role_id))
    if not roles:
        # Nothing configured/manageable for these entitlements — a benign no-op, not an error.
        return web.json_response({"ok": True, "granted": []})

    try:
        reason = f"billing-grant: {', '.join(payload.entitlements[:8])}"[:400]
        await member.add_roles(*roles, reason=reason)
    except discord.HTTPException:
        # A caller retry is safe: already-applied roles are filtered on its next attempt.
        return web.json_response({"ok": False, "error": "role grant failed"}, status=502)
    return web.json_response({"ok": True, "granted": [r.name for r in roles]})


def build_app(
    *,
    bot: commands.Bot,
    settings: Settings,
    store: TicketStore | None = None,
    http_client: httpx.AsyncClient | None = None,
    work_gate: PrivilegedWorkGate | None = None,
) -> web.Application:
    """The inbound app: /health always; /billing-grant and /escalate each only when their own token
    is configured. ``store``/``http_client`` back /escalate's ticket persistence + Linear sink
    (``__main__.py`` passes the SAME instances the Discord bot's own escalations use); omitting them
    (as every existing test does) degrades /escalate to "accepts the push, files nothing durable" —
    never a 500.
    """
    app = web.Application(client_max_size=64 * 1024, middlewares=[_security_headers])
    app[_DEPS] = _Deps(
        bot=bot,
        settings=settings,
        token=settings.billing_grant_token or "",
        escalate_token=settings.site_escalate_token or "",
        store=store,
        issue_tracker=linear_issue_tracker(settings, http_client),
        work_gate=work_gate or PrivilegedWorkGate(),
    )
    app.router.add_get("/health", _handle_health)
    if settings.billing_grant_token:
        app.router.add_post("/billing-grant", _handle_billing_grant)
    if settings.site_escalate_token:
        app.router.add_post("/escalate", _handle_site_escalate)
    return app


async def serve_http(
    *,
    bot: commands.Bot,
    settings: Settings,
    port: int,
    store: TicketStore | None = None,
    http_client: httpx.AsyncClient | None = None,
    work_gate: PrivilegedWorkGate | None = None,
    host: str = "0.0.0.0",  # noqa: S104 - container inbound bind; the intended surface (was health.py's).
) -> web.AppRunner:
    """Start the inbound HTTP server; the caller owns ``await runner.cleanup()`` on shutdown."""
    runner = web.AppRunner(
        build_app(
            bot=bot,
            settings=settings,
            store=store,
            http_client=http_client,
            work_gate=work_gate,
        )
    )
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    return runner
