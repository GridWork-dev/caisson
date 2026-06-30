"""Member-management pure helpers (ADR-0109) — AsyncMock over discord-shaped objects, no gateway."""

from __future__ import annotations

from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import discord

from caisson_support_bot.config import SelfAssignRole, Settings
from caisson_support_bot.member_mgmt import (
    assign_default_role,
    build_role_view,
    edition_role_id,
    grant_edition,
    member_can_manage_role,
    role_outranks_bot,
    toggle_role,
    welcome_member,
)


def _forbidden() -> discord.Forbidden:
    """A constructible discord.Forbidden (HTTPException subclass) for AsyncMock side_effects."""
    resp = MagicMock()
    resp.status = 403
    resp.reason = "Forbidden"
    return discord.Forbidden(resp, "missing perms")


class _FakeRole:
    """Minimal role with position ordering — exercises role_outranks_bot's `>=` without a gateway."""

    def __init__(self, position: int, name: str = "r") -> None:
        self.position = position
        self.name = name

    def __ge__(self, other: _FakeRole) -> bool:
        return self.position >= other.position

    def __lt__(self, other: _FakeRole) -> bool:
        return self.position < other.position


def _settings(**kw: object) -> Settings:
    """A duck-typed Settings stand-in for the pure helpers (they read a few attrs, not the whole model)."""
    return cast(Settings, SimpleNamespace(**kw))


def _role(position: int) -> discord.Role:
    """A duck-typed Role stand-in exercising the `>=` ordering used by role_outranks_bot."""
    return cast(discord.Role, _FakeRole(position))


def test_edition_role_id_maps_and_handles_unknown() -> None:
    settings = _settings(
        role_compliance_id=111,
        role_ai_kit_id=222,
        role_local_first_id=None,
        role_agentic_id=444,
    )
    assert edition_role_id(settings, "compliance") == 111
    assert edition_role_id(settings, "ai-kit") == 222
    assert edition_role_id(settings, "local-first") is None  # configured None
    assert edition_role_id(settings, "nope") is None  # unknown slug


def test_role_outranks_bot() -> None:
    bot_top = _role(5)
    assert role_outranks_bot(_role(5), bot_top) is True  # equal ⇒ cannot manage
    assert role_outranks_bot(_role(6), bot_top) is True
    assert role_outranks_bot(_role(4), bot_top) is False


def _member(*, admin: bool, top: int) -> discord.Member:
    return cast(
        discord.Member,
        SimpleNamespace(
            guild_permissions=SimpleNamespace(administrator=admin), top_role=_role(top)
        ),
    )


def test_member_can_manage_role_blocks_escalation() -> None:
    # admin can manage anything, regardless of position
    assert member_can_manage_role(_member(admin=True, top=1), _role(99)) is True
    # a non-admin mod can manage a role BELOW their top, but never at/above it (no self-escalation)
    mod = _member(admin=False, top=5)
    assert member_can_manage_role(mod, _role(4)) is True
    assert member_can_manage_role(mod, _role(5)) is False  # equal ⇒ blocked
    assert member_can_manage_role(mod, _role(6)) is False  # above ⇒ blocked


async def test_assign_default_role_success() -> None:
    member = MagicMock()
    member.add_roles = AsyncMock()
    role = MagicMock()
    assert await assign_default_role(member, role, reason="join") is True
    member.add_roles.assert_awaited_once_with(role, reason="join")


async def test_assign_default_role_forbidden_returns_false() -> None:
    member = MagicMock()
    member.add_roles = AsyncMock(side_effect=_forbidden())
    assert await assign_default_role(member, MagicMock(), reason="join") is False  # swallowed


async def test_toggle_role_adds_then_removes() -> None:
    role = MagicMock()
    member = MagicMock()
    member.roles = []  # absent ⇒ add
    member.add_roles = AsyncMock()
    member.remove_roles = AsyncMock()
    assert await toggle_role(member, role, reason="btn") == "added"
    member.add_roles.assert_awaited_once()

    member2 = MagicMock()
    member2.roles = [role]  # present ⇒ remove
    member2.add_roles = AsyncMock()
    member2.remove_roles = AsyncMock()
    assert await toggle_role(member2, role, reason="btn") == "removed"
    member2.remove_roles.assert_awaited_once()


async def test_grant_edition_adds_edition_and_customer() -> None:
    member = MagicMock()
    member.add_roles = AsyncMock()
    ed, cust = MagicMock(), MagicMock()
    await grant_edition(member, edition_role=ed, customer_role=cust, reason="buy")
    member.add_roles.assert_awaited_once_with(ed, cust, reason="buy")


async def test_grant_edition_without_customer() -> None:
    member = MagicMock()
    member.add_roles = AsyncMock()
    ed = MagicMock()
    await grant_edition(member, edition_role=ed, customer_role=None, reason="buy")
    member.add_roles.assert_awaited_once_with(ed, reason="buy")


async def test_welcome_member_sends_channel_and_dm() -> None:
    member = MagicMock()
    member.send = AsyncMock()
    channel = MagicMock()
    channel.send = AsyncMock()
    await welcome_member(member, channel=channel, channel_text="hi", dm_text="dm")
    channel.send.assert_awaited_once_with("hi")
    member.send.assert_awaited_once_with("dm")


async def test_welcome_member_swallows_closed_dm() -> None:
    member = MagicMock()
    member.send = AsyncMock(side_effect=_forbidden())  # DMs closed
    channel = MagicMock()
    channel.send = AsyncMock()
    await welcome_member(member, channel=channel, channel_text="hi", dm_text="dm")  # must not raise
    channel.send.assert_awaited_once()


def test_build_role_view_none_when_empty() -> None:
    assert build_role_view(_settings(self_assign_roles=[])) is None


def test_build_role_view_has_buttons() -> None:
    settings = _settings(
        self_assign_roles=[
            SelfAssignRole(role_id=1, label="A"),
            SelfAssignRole(role_id=2, label="B"),
        ]
    )
    view = build_role_view(settings)
    assert view is not None
    ids = [getattr(c, "custom_id", None) for c in view.children]
    assert "caisson:selfrole:1" in ids
    assert "caisson:selfrole:2" in ids
