"""Discord front-end (ADR-0105): a `/ask` slash command + an `#ask-ai` channel listener.

Both surfaces route through one ``RagPipeline``. The answer-shaping and escalation orchestration live
in pure async functions (``format_answer`` / ``handle_question``) that take abstract ports, so they are
unit-tested with fakes and never need a live gateway — the discord.py callbacks are thin adapters over
them. The live gateway, the real OpenRouter key, and Postgres are the operator-gated deploy seam.
"""

from __future__ import annotations

from collections.abc import Callable

import discord
import httpx
from discord import app_commands
from discord.ext import commands

from .config import Settings
from .contracts import AnswerResult
from .escalation import Escalator, IssueTracker, ThreadOpener, TicketStore
from .linear_client import LinearIssueTracker
from .member_mgmt import add_persistent_views, member_has_priority_support, register_member_commands
from .rag import RagPipeline

# Discord hard-caps a message at 2000 chars; keep headroom for the sources footer.
_MAX_REPLY = 1900


def _unique(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for s in seq:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def format_answer(result: AnswerResult) -> str:
    """Render a resolved answer with a deduped sources footer (citations are the grounding proof)."""
    body = result.answer.strip()
    cites = _unique(result.citations)[:6]
    if cites:
        footer = "\n\n**Sources:** " + ", ".join(f"`{c}`" for c in cites)
    else:
        footer = ""
    if len(body) + len(footer) > _MAX_REPLY:
        body = body[: _MAX_REPLY - len(footer) - 1].rstrip() + "…"
    return body + footer


async def handle_question(
    *,
    question: str,
    pipeline: RagPipeline,
    escalator_factory: Callable[[], Escalator],
    max_chars: int = 2000,
) -> str:
    """Answer a question, escalating (thread + ticket) when it can't be grounded. Returns user-facing text.

    Pure over its ports — the caller binds ``escalator_factory`` to the right channel. This is the unit
    the handler tests exercise; the discord callbacks below just collect the question and send the text.
    """
    cleaned = question.strip()[:max_chars]
    if not cleaned:
        return "Ask me a question about Caisson and I'll answer from the docs."

    result = await pipeline.answer(cleaned)
    if result.resolved:
        return format_answer(result)

    # Unresolved ⇒ escalate. brief is always present on the unresolved path (rag.py invariant).
    if result.brief is not None:
        await escalator_factory().escalate(result.brief)
    return (
        "I couldn't answer that confidently from the Caisson docs, so I've opened a thread and tagged a "
        "human with a brief — someone will follow up. "
    )


class _DiscordThreadOpener:
    """ThreadOpener bound to a specific channel; opens a public thread and posts the brief. Best-effort.

    ``body`` embeds user-controlled text (the escalated question, RAG-considered sources) plus, when
    configured, the support-role ping. The bot-wide ``AllowedMentions.none()`` default (set on the
    ``commands.Bot`` in ``make_bot``) already makes any ``@everyone``/user/role mention INERT unless
    re-allowed here — so only the one configured ``mention_role_id`` is re-enabled, never an arbitrary
    role/user a question might contain.
    """

    def __init__(
        self, channel: discord.abc.Messageable, *, mention_role_id: int | None = None
    ) -> None:
        self._channel = channel
        self._allowed_mentions = discord.AllowedMentions(
            roles=[discord.Object(id=mention_role_id)] if mention_role_id is not None else False
        )

    async def open_thread(self, *, title: str, body: str) -> int | None:
        create = getattr(self._channel, "create_thread", None)
        if create is None:
            # Not a thread-capable channel (e.g. a DM): post inline so the brief isn't lost.
            await self._channel.send(body, allowed_mentions=self._allowed_mentions)
            return None
        try:
            thread = await create(name=title[:100], type=discord.ChannelType.public_thread)
            await thread.send(body, allowed_mentions=self._allowed_mentions)
            return thread.id
        # Forbidden subclasses HTTPException, so this also covers permission errors.
        except discord.HTTPException:
            await self._channel.send(
                body, allowed_mentions=self._allowed_mentions
            )  # fall back inline.
            return None


def _linear_issue_tracker(
    settings: Settings, http_client: httpx.AsyncClient | None
) -> IssueTracker | None:
    """Build the Linear sink iff all three settings + an httpx client are present (ADR-0206).

    Any of the four missing means the Linear code path never runs — no partial configuration.
    """
    if (
        http_client is None
        or not settings.linear_api_key
        or not settings.linear_team_id
        or not settings.linear_triage_state_id
    ):
        return None
    return LinearIssueTracker(
        api_key=settings.linear_api_key,
        team_id=settings.linear_team_id,
        state_id=settings.linear_triage_state_id,
        client=http_client,
    )


def _escalator_factory(
    settings: Settings,
    store: TicketStore | None,
    channel: discord.abc.Messageable,
    issue_tracker: IssueTracker | None = None,
    author: discord.Member | discord.User | None = None,
) -> Callable[[], Escalator]:
    mention = f"<@&{settings.support_human_role_id}>" if settings.support_human_role_id else None
    # ADR-0278 Track K: resolved once per request, from whatever member context the caller has (a
    # bare discord.User — e.g. a DM — carries no roles, so it never signals priority; fail-closed).
    priority = member_has_priority_support(
        settings, author if isinstance(author, discord.Member) else None
    )

    def make() -> Escalator:
        opener: ThreadOpener = _DiscordThreadOpener(
            channel, mention_role_id=settings.support_human_role_id
        )
        return Escalator(
            store=store,
            thread_opener=opener,
            issue_tracker=issue_tracker,
            human_mention=mention,
            priority=priority,
        )

    return make


def make_bot(
    *,
    settings: Settings,
    pipeline: RagPipeline,
    store: TicketStore | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> commands.Bot:
    """Construct the discord.py bot. The listener intent is only requested if a channel is configured.

    ``http_client`` is the bot's already-pooled outbound client (see ``__main__.py``); passing it
    enables the Linear triage sink when its three settings are also configured (ADR-0206). Tests
    that omit it simply never construct the Linear sink.
    """
    issue_tracker = _linear_issue_tracker(settings, http_client)
    intents = discord.Intents.default()
    if settings.support_channel_id is not None:
        intents.message_content = True  # required to read #ask-ai messages.
    if settings.member_role_id is not None:
        # Privileged: enables on_member_join + the member cache. Requires the "Server Members Intent"
        # toggle in the Developer Portal — otherwise the gateway refuses to connect (ADR-0109).
        intents.members = True

    # Bot-wide mention floor (WARN finding): a user's question (or the LLM's answer) could embed
    # @everyone/@here or an arbitrary user/role mention; every send() inherits this default unless a
    # call site explicitly re-allows a specific, intentional mention (see _DiscordThreadOpener).
    bot = commands.Bot(
        command_prefix="!caisson-unused!",
        intents=intents,
        allowed_mentions=discord.AllowedMentions.none(),
    )

    @bot.event
    async def setup_hook() -> None:  # pyright: ignore[reportUnusedFunction]
        add_persistent_views(bot, settings)  # re-bind persistent self-assign views after restart.
        await bot.tree.sync()

    @bot.tree.command(
        name="ask", description="Ask a question about Caisson (answered from the docs)."
    )
    @app_commands.describe(question="Your question about Caisson")
    async def ask(interaction: discord.Interaction, question: str) -> None:  # pyright: ignore[reportUnusedFunction]
        await interaction.response.defer(thinking=True)
        reply = await handle_question(
            question=question,
            pipeline=pipeline,
            escalator_factory=_escalator_factory(
                settings,
                store,
                interaction.channel,  # type: ignore[arg-type]
                issue_tracker,
                author=interaction.user,
            ),
            max_chars=settings.max_question_chars,
        )
        await interaction.followup.send(reply)

    @bot.event
    async def on_message(message: discord.Message) -> None:  # pyright: ignore[reportUnusedFunction]
        if message.author.bot or message.author == bot.user:
            return
        if settings.support_channel_id is None or message.channel.id != settings.support_channel_id:
            return
        async with message.channel.typing():
            reply = await handle_question(
                question=message.content,
                pipeline=pipeline,
                escalator_factory=_escalator_factory(
                    settings, store, message.channel, issue_tracker, author=message.author
                ),
                max_chars=settings.max_question_chars,
            )
        await message.reply(reply)

    register_member_commands(bot, settings)
    return bot
