"""Member management (ADR-0109): server-ops surfaces layered onto the support bot.

Scope (ADR-0109 extends ADR-0105 — same bot, not a second process):
  • **Join auto-role + welcome** — on ``on_member_join`` assign the default ``Member`` role and post a
    welcome. REQUIRES the privileged ``members`` intent, so it is GATED on ``member_role_id`` being set
    (the operator enables "Server Members Intent" in the Developer Portal first; without the toggle the
    gateway refuses to connect, so we never enable the intent unless this is configured).
  • **Self-assign role buttons** — a persistent ``discord.ui.View`` (``timeout=None`` + fixed
    ``custom_id`` per button) so the message survives a restart; re-registered via ``bot.add_view`` in
    ``setup_hook``. Needs no privileged intent (a click is an interaction).
  • **Moderation slash commands** — ``/kick`` ``/ban`` ``/timeout`` ``/role-add`` ``/role-remove``,
    DOUBLE-gated: ``default_permissions`` hides them in the client UI, ``checks.has_permissions`` is the
    runtime guarantee. ``/kick``/``/ban``/``/timeout`` add a THIRD gate, ``may_moderate`` — the
    permission flag alone says nothing about caller-vs-target rank, so it also requires the caller (and
    the bot) to outrank the target and the target to not be the guild owner. A central ``tree.error``
    handler answers a denied check ephemerally.
  • **Purchase → edition role** — ``/grant-role`` (admin) maps an edition to its role + the ``Customer``
    umbrella. The billing-push HTTP variant lives in ``billing_grant.py`` (ADR-0201 — the ADR-0109
    deferral closed once services/license became a real caller); both paths share the pure helpers here.

Design rule (mirrors ``bot.py``): the gateway callbacks are thin adapters over PURE async helpers
(``assign_default_role`` / ``toggle_role`` / ``grant_edition`` / ``welcome_member``) that take
``discord``-shaped objects, so they unit-test with ``AsyncMock`` and never need a live gateway.

Permission/hierarchy floor (``identity/security.md`` analogue): the bot's own role must sit ABOVE every
role it manages — Discord raises ``discord.Forbidden`` otherwise. ``role_outranks_bot`` gives a clean
ephemeral error instead of a raw 403. For ``/kick``/``/ban``/``/timeout``, Discord enforces hierarchy
against the BOT's role only, never the invoking moderator's — ``may_moderate`` closes that gap so a
low-ranked mod can't action a same-or-higher-ranked member (or the owner) through the bot. The mod-command
secret here is Discord's own permission system, not a token compare, so there is no timing-safe surface
(unlike the deferred webhook).
"""

from __future__ import annotations

import datetime

import discord
from discord import app_commands
from discord.ext import commands

from .config import Settings

# Edition slug → the Settings attribute holding that edition's role id. The slugs are the CANONICAL
# entitlement ids (`packages/registry-schema` EDITIONS / the pricebook `entitlements` values) — the
# billing push (ADR-0201) sends purchased ids verbatim, so this map must speak the same vocabulary.
# They are also the public `/grant-role` choices. The Settings attribute names keep their original
# spelling (`role_local_first_id` / `role_agentic_id`) so deployed env vars stay valid.
_EDITION_ROLE_ATTR: dict[str, str] = {
    "compliance": "role_compliance_id",
    "ai-kit": "role_ai_kit_id",
    "local-ai": "role_local_first_id",
    "agent-dev": "role_agentic_id",
}

# The bundle sentinel purchased id (pricebook PURCHASE_BOOK) — entitles every edition (ADR-0071).
BUNDLE_ENTITLEMENT_ID = "bundle"


def editions_for_entitlements(entitlements: list[str]) -> list[str]:
    """Map purchased entitlement ids (sent verbatim by the billing push) to edition slugs with a role.

    ``bundle`` expands to every edition; ids with no role mapping (à-la-carte module slugs, credit
    packs) drop out — the caller still adds the ``Customer`` umbrella for any successful purchase.
    Order-preserving and de-duplicated so the grant reason stays stable.
    """
    out: list[str] = []
    for eid in entitlements:
        expanded = list(_EDITION_ROLE_ATTR) if eid == BUNDLE_ENTITLEMENT_ID else [eid]
        for edition in expanded:
            if edition in _EDITION_ROLE_ATTR and edition not in out:
                out.append(edition)
    return out


# --------------------------------------------------------------------------------------------------
# Pure helpers (unit-tested with AsyncMock — no live gateway).
# --------------------------------------------------------------------------------------------------
def edition_role_id(settings: Settings, edition: str) -> int | None:
    """Resolve an edition slug to its configured role id, or ``None`` if unknown/unset."""
    attr = _EDITION_ROLE_ATTR.get(edition)
    if attr is None:
        return None
    value = getattr(settings, attr)
    return value if isinstance(value, int) else None


def role_outranks_bot(role: discord.Role, bot_top_role: discord.Role) -> bool:
    """``True`` when ``role`` is at or above the bot's highest role — the bot cannot manage it.

    Discord orders roles; a bot can only add/remove/edit roles strictly BELOW its own top role. Callers
    use this to fail fast with a clear message instead of surfacing a raw ``Forbidden``.
    """
    return role >= bot_top_role


def member_can_manage_role(member: discord.Member, role: discord.Role) -> bool:
    """``True`` when ``member`` may NATIVELY manage ``role`` — they're an admin, or ``role`` sits BELOW
    their own highest role.

    Critical guard: the BOT is the API actor for ``add_roles``/``remove_roles``, so Discord enforces
    hierarchy only against the BOT's top role, never the invoking moderator's. Without this check a
    Manage-Roles holder positioned below a valuable role (e.g. Staff, or a paid edition role) could have
    the bot grant that higher role to themselves — an escalation Discord's native UI would refuse.
    """
    if member.guild_permissions.administrator:
        return True
    return role < member.top_role


def may_moderate(
    actor: discord.Member,
    target: discord.Member,
    *,
    guild_owner_id: int | None,
    bot_top_role: discord.Role,
) -> bool:
    """``True`` when ``actor`` (acting through the bot) may kick/ban/timeout ``target``.

    ``app_commands.checks.has_permissions`` only verifies the actor holds the permission FLAG (e.g.
    ``kick_members``) — it says nothing about ``actor`` outranking THIS ``target``. Without this check a
    low-ranked mod holding the flag could kick/ban/timeout a same-or-higher-ranked member (another mod,
    staff, or the owner) the bot would otherwise refuse via Discord's own hierarchy — which is enforced
    against the BOT's top role, never the invoking moderator's. Mirrors Discord's native rule: the target
    must not be the guild owner, and must sit strictly BELOW both the actor's and the bot's top role.
    """
    if target.id == guild_owner_id:
        return False
    return actor.top_role > target.top_role and bot_top_role > target.top_role


async def assign_default_role(member: discord.Member, role: discord.Role, *, reason: str) -> bool:
    """Add ``role`` to ``member``; return ``False`` (never raise) on a permission/hierarchy failure."""
    try:
        await member.add_roles(role, reason=reason)
        return True
    except discord.Forbidden:
        # Bot role too low or missing Manage Roles — surfaced by the caller; never crashes the listener.
        return False


async def toggle_role(member: discord.Member, role: discord.Role, *, reason: str) -> str:
    """Toggle ``role`` on ``member``. Returns ``"added"`` or ``"removed"``. Raises ``Forbidden`` up."""
    if role in member.roles:
        await member.remove_roles(role, reason=reason)
        return "removed"
    await member.add_roles(role, reason=reason)
    return "added"


async def grant_edition(
    member: discord.Member,
    *,
    edition_role: discord.Role,
    customer_role: discord.Role | None,
    reason: str,
) -> None:
    """Grant the edition role plus the ``Customer`` umbrella (when configured) in one call."""
    roles = [edition_role] + ([customer_role] if customer_role is not None else [])
    await member.add_roles(*roles, reason=reason)


async def welcome_member(
    member: discord.Member,
    *,
    channel: discord.abc.Messageable | None,
    channel_text: str,
    dm_text: str | None = None,
) -> None:
    """Best-effort welcome: post to ``channel`` (when set) and DM the member (when ``dm_text`` set).

    Both sends are swallowed on failure — a closed-DM ``Forbidden`` or a missing channel must never
    crash the join listener.
    """
    if channel is not None:
        try:
            # channel_text embeds member.mention (the join ping is the point); scope the bot-wide
            # AllowedMentions.none() re-allow to exactly this member, never any other stray mention.
            await channel.send(
                channel_text, allowed_mentions=discord.AllowedMentions(users=[member])
            )
        except discord.HTTPException:
            pass
    if dm_text is not None:
        try:
            await member.send(dm_text)
        except discord.HTTPException:
            pass


# --------------------------------------------------------------------------------------------------
# Persistent self-assign role buttons.
# --------------------------------------------------------------------------------------------------
class _RoleButton(discord.ui.Button["RoleButtonView"]):
    """One self-assign toggle button. Fixed ``custom_id`` so the view persists across restarts."""

    def __init__(self, role_id: int, label: str) -> None:
        super().__init__(
            style=discord.ButtonStyle.secondary,
            label=label,
            custom_id=f"caisson:selfrole:{role_id}",
        )
        self._role_id = role_id

    async def callback(self, interaction: discord.Interaction) -> None:
        member = interaction.user
        guild = interaction.guild
        if guild is None or not isinstance(member, discord.Member):
            await interaction.response.send_message("Use this inside the server.", ephemeral=True)
            return
        role = guild.get_role(self._role_id)
        if role is None:
            await interaction.response.send_message("That role no longer exists.", ephemeral=True)
            return
        try:
            action = await toggle_role(member, role, reason="self-assign button")
        except discord.Forbidden:
            await interaction.response.send_message(
                "I can't manage that role (it's above my role, or I'm missing Manage Roles).",
                ephemeral=True,
            )
            return
        verb = "Added" if action == "added" else "Removed"
        await interaction.response.send_message(f"{verb} **{role.name}**.", ephemeral=True)


class RoleButtonView(discord.ui.View):
    """A persistent view holding one toggle button per configured self-assign role."""

    def __init__(self, roles: list[tuple[int, str]]) -> None:
        super().__init__(timeout=None)  # persistence condition: no timeout.
        for role_id, label in roles:
            self.add_item(_RoleButton(role_id, label))


def _self_assign_pairs(settings: Settings) -> list[tuple[int, str]]:
    """The configured self-assign roles as ``(role_id, label)`` pairs (possibly empty)."""
    return [(r.role_id, r.label) for r in settings.self_assign_roles]


def build_role_view(settings: Settings) -> RoleButtonView | None:
    """Build the self-assign view, or ``None`` when no self-assign roles are configured."""
    pairs = _self_assign_pairs(settings)
    return RoleButtonView(pairs) if pairs else None


def add_persistent_views(bot: commands.Bot, settings: Settings) -> None:
    """Re-register the persistent self-assign view on startup (called from ``setup_hook``)."""
    view = build_role_view(settings)
    if view is not None:
        bot.add_view(view)


# --------------------------------------------------------------------------------------------------
# Command + listener registration (thin adapters over the pure helpers above).
# --------------------------------------------------------------------------------------------------
def register_member_commands(bot: commands.Bot, settings: Settings) -> None:
    """Attach the member-management listeners + slash commands to an existing bot.

    ``on_member_join`` is registered ONLY when ``member_role_id`` is set (it needs the privileged
    ``members`` intent, which ``make_bot`` enables under the same condition). The slash commands and the
    self-assign buttons need no privileged intent and are always registered.
    """
    member_role_id = settings.member_role_id
    if member_role_id is not None:

        @bot.event
        async def on_member_join(member: discord.Member) -> None:  # pyright: ignore[reportUnusedFunction]
            guild = member.guild
            role = guild.get_role(member_role_id)
            if role is not None:
                await assign_default_role(member, role, reason="auto-role on join")
            channel: discord.abc.Messageable | None = None
            if settings.welcome_channel_id is not None:
                resolved = guild.get_channel(settings.welcome_channel_id)
                if isinstance(resolved, discord.TextChannel):
                    channel = resolved
            ask = (
                f" Ask anything in <#{settings.support_channel_id}> or with `/ask`."
                if settings.support_channel_id is not None
                else " Ask anything with `/ask`."
            )
            await welcome_member(
                member,
                channel=channel,
                channel_text=f"Welcome {member.mention} to **{guild.name}**!{ask}",
                dm_text=f"Welcome to {guild.name}! I'm the Caisson support bot — {ask.strip()}",
            )

    # --- moderation ---
    @bot.tree.command(name="kick", description="Kick a member from the server.")
    @app_commands.describe(member="Member to kick", reason="Audit-log reason")
    @app_commands.guild_only()
    @app_commands.default_permissions(kick_members=True)
    @app_commands.checks.has_permissions(kick_members=True)
    async def kick(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction, member: discord.Member, reason: str | None = None
    ) -> None:
        guild, invoker = interaction.guild, interaction.user
        if (
            guild is None
            or not isinstance(invoker, discord.Member)
            or not may_moderate(
                invoker, member, guild_owner_id=guild.owner_id, bot_top_role=guild.me.top_role
            )
        ):
            await interaction.response.send_message(
                "You can't kick them — they're the server owner, or their role is at/above yours (or mine).",
                ephemeral=True,
            )
            return
        try:
            await member.kick(reason=reason)
            await interaction.response.send_message(f"Kicked {member}.", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message(
                "I can't kick them — their role is at/above mine, or I'm missing Kick Members.",
                ephemeral=True,
            )

    @bot.tree.command(name="ban", description="Ban a member from the server.")
    @app_commands.describe(member="Member to ban", reason="Audit-log reason")
    @app_commands.guild_only()
    @app_commands.default_permissions(ban_members=True)
    @app_commands.checks.has_permissions(ban_members=True)
    async def ban(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction, member: discord.Member, reason: str | None = None
    ) -> None:
        guild, invoker = interaction.guild, interaction.user
        if (
            guild is None
            or not isinstance(invoker, discord.Member)
            or not may_moderate(
                invoker, member, guild_owner_id=guild.owner_id, bot_top_role=guild.me.top_role
            )
        ):
            await interaction.response.send_message(
                "You can't ban them — they're the server owner, or their role is at/above yours (or mine).",
                ephemeral=True,
            )
            return
        try:
            await member.ban(reason=reason, delete_message_days=0)
            await interaction.response.send_message(f"Banned {member}.", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message(
                "I can't ban them — their role is at/above mine, or I'm missing Ban Members.",
                ephemeral=True,
            )

    @bot.tree.command(name="timeout", description="Time a member out for N minutes.")
    @app_commands.describe(member="Member", minutes="1–40320 (28 days max)", reason="Reason")
    @app_commands.guild_only()
    @app_commands.default_permissions(moderate_members=True)
    @app_commands.checks.has_permissions(moderate_members=True)
    async def timeout(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction,
        member: discord.Member,
        minutes: app_commands.Range[int, 1, 40320],
        reason: str | None = None,
    ) -> None:
        guild, invoker = interaction.guild, interaction.user
        if (
            guild is None
            or not isinstance(invoker, discord.Member)
            or not may_moderate(
                invoker, member, guild_owner_id=guild.owner_id, bot_top_role=guild.me.top_role
            )
        ):
            await interaction.response.send_message(
                "You can't time them out — they're the server owner, or their role is at/above yours "
                "(or mine).",
                ephemeral=True,
            )
            return
        try:
            await member.timeout(datetime.timedelta(minutes=minutes), reason=reason)
            await interaction.response.send_message(
                f"Timed out {member} for {minutes}m.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.response.send_message(
                "I can't time them out — their role is at/above mine, or I'm missing Moderate Members.",
                ephemeral=True,
            )

    @bot.tree.command(name="role-add", description="Add a role to a member.")
    @app_commands.describe(member="Member", role="Role to add")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_roles=True)
    @app_commands.checks.has_permissions(manage_roles=True)
    async def role_add(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction, member: discord.Member, role: discord.Role
    ) -> None:
        invoker = interaction.user
        if not isinstance(invoker, discord.Member) or not member_can_manage_role(invoker, role):
            await interaction.response.send_message(
                "You can't manage that role — it's at or above your own highest role.",
                ephemeral=True,
            )
            return
        if interaction.guild is not None and role_outranks_bot(role, interaction.guild.me.top_role):
            await interaction.response.send_message(
                f"**{role.name}** is at/above my role — move my role up to manage it.",
                ephemeral=True,
            )
            return
        try:
            await member.add_roles(role, reason=f"role-add by {interaction.user}")
            await interaction.response.send_message(
                f"Added **{role.name}** to {member}.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.response.send_message("I'm missing Manage Roles.", ephemeral=True)

    @bot.tree.command(name="role-remove", description="Remove a role from a member.")
    @app_commands.describe(member="Member", role="Role to remove")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_roles=True)
    @app_commands.checks.has_permissions(manage_roles=True)
    async def role_remove(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction, member: discord.Member, role: discord.Role
    ) -> None:
        invoker = interaction.user
        if not isinstance(invoker, discord.Member) or not member_can_manage_role(invoker, role):
            await interaction.response.send_message(
                "You can't manage that role — it's at or above your own highest role.",
                ephemeral=True,
            )
            return
        if interaction.guild is not None and role_outranks_bot(role, interaction.guild.me.top_role):
            await interaction.response.send_message(
                f"**{role.name}** is at/above my role — move my role up to manage it.",
                ephemeral=True,
            )
            return
        try:
            await member.remove_roles(role, reason=f"role-remove by {interaction.user}")
            await interaction.response.send_message(
                f"Removed **{role.name}** from {member}.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.response.send_message("I'm missing Manage Roles.", ephemeral=True)

    # --- purchase → edition role (manual; the billing-webhook variant is deferred to the Paddle phase) ---
    @bot.tree.command(name="grant-role", description="Grant a customer their edition role.")
    @app_commands.describe(member="Customer", edition="Edition purchased")
    @app_commands.choices(
        edition=[app_commands.Choice(name=e, value=e) for e in _EDITION_ROLE_ATTR]
    )
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_roles=True)
    @app_commands.checks.has_permissions(manage_roles=True)
    async def grant_role(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction,
        member: discord.Member,
        edition: app_commands.Choice[str],
    ) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message("Server only.", ephemeral=True)
            return
        role_id = edition_role_id(settings, edition.value)
        role = guild.get_role(role_id) if role_id is not None else None
        if role is None:
            await interaction.response.send_message(
                f"No role configured for **{edition.value}**.", ephemeral=True
            )
            return
        invoker = interaction.user
        if not isinstance(invoker, discord.Member) or not member_can_manage_role(invoker, role):
            await interaction.response.send_message(
                "You can't grant that role — it's at or above your own highest role.",
                ephemeral=True,
            )
            return
        if role_outranks_bot(role, guild.me.top_role):
            await interaction.response.send_message(
                f"**{role.name}** is at/above my role — move my role up.", ephemeral=True
            )
            return
        customer = (
            guild.get_role(settings.customer_role_id)
            if settings.customer_role_id is not None
            else None
        )
        try:
            await grant_edition(
                member,
                edition_role=role,
                customer_role=customer,
                reason=f"purchase:{edition.value} by {interaction.user}",
            )
        except discord.Forbidden:
            await interaction.response.send_message("I'm missing Manage Roles.", ephemeral=True)
            return
        await interaction.response.send_message(
            f"Granted **{role.name}** to {member}.", ephemeral=True
        )

    # --- post the self-assign role picker (admin, one-time) ---
    @bot.tree.command(name="post-roles", description="Post the self-assign role buttons here.")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    async def post_roles(interaction: discord.Interaction) -> None:  # pyright: ignore[reportUnusedFunction]
        view = build_role_view(settings)
        if view is None:
            await interaction.response.send_message(
                "No self-assign roles are configured (set SELF_ASSIGN_ROLES).", ephemeral=True
            )
            return
        await interaction.response.send_message(
            "**Pick your roles** — toggle any that apply:", view=view
        )

    # --- centralized check-failure handler (ephemeral; unknown errors surface to logging) ---
    @bot.tree.error
    async def on_app_command_error(  # pyright: ignore[reportUnusedFunction]
        interaction: discord.Interaction, error: app_commands.AppCommandError
    ) -> None:
        if isinstance(error, app_commands.MissingPermissions):
            msg = "You don't have permission to use this command."
        elif isinstance(error, app_commands.CheckFailure):
            msg = "You can't use this command here."
        else:
            raise error
        if interaction.response.is_done():
            await interaction.followup.send(msg, ephemeral=True)
        else:
            await interaction.response.send_message(msg, ephemeral=True)
