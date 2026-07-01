"""Mention-safety floor (WARN finding, bot.py:130): a user's question or the LLM's answer could embed
`@everyone`/`@here` or an arbitrary user/role mention. These tests prove the bot-wide
``AllowedMentions.none()`` default is set, and that the one deliberate re-allow (the escalation
thread's configured support-role ping) never widens back to `@everyone` or an arbitrary user/role.
"""

from __future__ import annotations

from typing import cast
from unittest.mock import AsyncMock, MagicMock

import discord

from caisson_support_bot.bot import _DiscordThreadOpener, make_bot
from caisson_support_bot.config import Settings
from caisson_support_bot.rag import RagPipeline


def test_make_bot_sets_bot_wide_no_mentions_default(settings: Settings) -> None:
    bot = make_bot(settings=settings, pipeline=cast(RagPipeline, MagicMock()))
    mentions = bot.allowed_mentions
    assert mentions is not None
    assert mentions.everyone is False
    assert mentions.users is False
    assert mentions.roles is False
    assert mentions.replied_user is False


async def test_thread_opener_scopes_mention_to_configured_role_only() -> None:
    """A mention-laden body only re-allows the one configured support-role ping."""
    thread = MagicMock()
    thread.id = 555
    thread.send = AsyncMock()
    channel = MagicMock()
    channel.create_thread = AsyncMock(return_value=thread)
    opener = _DiscordThreadOpener(channel, mention_role_id=4242)

    result = await opener.open_thread(title="Escalation", body="@everyone <@999888777> please help")

    assert result == 555
    thread.send.assert_awaited_once()
    _, kwargs = thread.send.call_args
    # Merging against the bot-wide none() default is what actually happens on a live send() — this
    # is the real wire payload discord.py builds; only the configured role id may ping.
    merged = discord.AllowedMentions.none().merge(kwargs["allowed_mentions"]).to_dict()
    assert merged == {"parse": [], "roles": [4242]}


async def test_thread_opener_suppresses_all_mentions_when_no_role_configured() -> None:
    channel = MagicMock(spec=["send"])  # no create_thread ⇒ not thread-capable, posts inline.
    channel.send = AsyncMock()
    opener = _DiscordThreadOpener(channel, mention_role_id=None)

    result = await opener.open_thread(title="t", body="@everyone <@999> <@&123> ping")

    assert result is None
    channel.send.assert_awaited_once()
    _, kwargs = channel.send.call_args
    merged = discord.AllowedMentions.none().merge(kwargs["allowed_mentions"]).to_dict()
    assert merged == {"parse": []}
