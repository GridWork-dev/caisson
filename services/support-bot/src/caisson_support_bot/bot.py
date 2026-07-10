"""Discord front-end (ADR-0105): a `/ask` slash command + an `#ask-ai` channel listener.

Both surfaces route through one ``RagPipeline``. The answer-shaping and escalation orchestration live
in pure async functions (``format_answer`` / ``handle_question``) that take abstract ports, so they are
unit-tested with fakes and never need a live gateway — the discord.py callbacks are thin adapters over
them. The live gateway, the real OpenRouter key, and Postgres are the operator-gated deploy seam.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

import discord
import httpx
from discord import app_commands
from discord.ext import commands

from .analytics import AnswerAnalytics
from .chat_slack import SlackThreadOpener
from .config import Settings
from .contracts import AnswerResult, Brief, ConfidenceTier
from .escalation import ChatPlatform, Escalator, IssueTracker, TicketStore
from .linear_client import LinearIssueTracker
from .member_mgmt import add_persistent_views, member_has_priority_support, register_member_commands
from .rag import RagPipeline

# Discord hard-caps a message at 2000 chars; keep headroom for the sources footer.
_MAX_REPLY = 1900

# MEDIUM-tier answer-shaping (2026-07-10 picker). The hint points at `handle_escalate_reply` below —
# the cheapest real escalation path: a bare reply to the bot's own message.
_MEDIUM_HEDGE_PREFIX = (
    "I'm not fully confident in this, but here's my best answer from the docs:\n\n"
)
_MEDIUM_ESCALATE_HINT = "\n\nNot fully confident in this one — reply `escalate` to page a human."

# The reply-keyword a user can send (as a Discord reply to one of the bot's own messages) to force
# an escalation on the spot — see `handle_escalate_reply`.
_ESCALATE_KEYWORD = "escalate"


def _unique(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for s in seq:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def format_answer(result: AnswerResult) -> str:
    """Render a resolved answer with a deduped sources footer (citations are the grounding proof).

    HIGH tier renders exactly as before (unchanged behavior). MEDIUM tier (2026-07-10 picker)
    prefixes a hedge and appends a plain trailing line pointing at the reply-`escalate` handler
    (``handle_escalate_reply`` below) — the cheapest real escalation path that already exists.
    """
    body = result.answer.strip()
    if result.tier is ConfidenceTier.medium:
        body = _MEDIUM_HEDGE_PREFIX + body
    cites = _unique(result.citations)[:6]
    if cites:
        footer = "\n\n**Sources:** " + ", ".join(f"`{c}`" for c in cites)
    else:
        footer = ""
    if result.tier is ConfidenceTier.medium:
        footer += _MEDIUM_ESCALATE_HINT
    if len(body) + len(footer) > _MAX_REPLY:
        body = body[: _MAX_REPLY - len(footer) - 1].rstrip() + "…"
    return body + footer


async def handle_question(
    *,
    question: str,
    pipeline: RagPipeline,
    escalator_factory: Callable[[], Escalator],
    max_chars: int = 2000,
    on_result: Callable[[str, AnswerResult], Awaitable[None]] | None = None,
) -> str:
    """Answer a question, escalating (thread + ticket) when it can't be grounded. Returns user-facing text.

    Pure over its ports — the caller binds ``escalator_factory`` to the right channel. This is the unit
    the handler tests exercise; the discord callbacks below just collect the question and send the text.
    ``on_result`` (2026-07-10 telemetry) observes every pipeline verdict — (cleaned_question, result) —
    before answer-shaping; the analytics sink is fail-soft internally, so it is awaited inline.
    """
    cleaned = question.strip()[:max_chars]
    if not cleaned:
        return "Ask me a question about Caisson and I'll answer from the docs."

    result = await pipeline.answer(cleaned)
    if on_result is not None:
        await on_result(cleaned, result)
    if result.resolved:
        return format_answer(result)

    # Unresolved ⇒ escalate. brief is always present on the unresolved path (rag.py invariant).
    if result.brief is not None:
        await escalator_factory().escalate(result.brief)
    return (
        "I couldn't answer that confidently from the Caisson docs, so I've opened a thread and tagged a "
        "human with a brief — someone will follow up. "
    )


async def handle_escalate_reply(
    *,
    content: str,
    is_reply_to_bot: bool,
    referenced_content: str | None,
    escalator_factory: Callable[[], Escalator],
) -> str | None:
    """Handle a bare 'escalate' reply to one of the bot's own answers (2026-07-10 picker) — the
    cheapest real escalation path MEDIUM-tier answers point at (``format_answer``'s hint). Files the
    SAME Linear Triage + thread + ticket escalation the LOW tier already uses.

    Returns the confirmation text to send, or ``None`` if this message is not an escalate reply — the
    caller then falls through to the normal RAG pipeline (``on_message`` below).
    """
    if not is_reply_to_bot or content.strip().lower() != _ESCALATE_KEYWORD:
        return None
    brief = Brief(
        question=referenced_content or "(escalation requested; original answer unavailable)",
        summary="User explicitly requested escalation via a reply to a bot answer.",
    )
    await escalator_factory().escalate(brief)
    return "Escalated — a human will follow up."


class _DiscordThreadOpener:
    """ChatPlatform bound to a specific channel; opens a public thread and posts the brief. Best-effort.

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


def linear_issue_tracker(
    settings: Settings, http_client: httpx.AsyncClient | None
) -> IssueTracker | None:
    """Build the Linear sink iff all three settings + an httpx client are present (ADR-0206).

    Any of the four missing means the Linear code path never runs — no partial configuration.
    Public (not `_`-prefixed): `billing_grant.py`'s POST /escalate reuses this exact builder so the
    site-originated escalation sink can never drift from the Discord bot's own gating.
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


def _build_chat_platform(
    settings: Settings,
    channel: discord.abc.Messageable,
    http_client: httpx.AsyncClient | None,
) -> ChatPlatform:
    """Select the escalation-notify driver per ``settings.chat_platform`` (ADR-0287). The bot's own
    surface (``/ask``, ``#ask-ai``) stays Discord regardless — this only picks where the escalation
    brief posts. Discord is the default and always available (it reuses the live channel the
    question arrived on).

    Slack requires a pooled ``httpx`` client. ``Settings``' own validator already guarantees
    ``slack_bot_token``/``slack_escalation_channel_id`` are set together with ``chat_platform=
    'slack'``, so a missing client is the only remaining gap — and it FAILS CLOSED (raises) rather
    than silently routing the escalation to the live Discord channel instead of the operator's
    configured Slack channel. An operator who explicitly chose Slack must never see their
    escalation silently land somewhere else with no warning; ``make_bot`` always supplies a client
    in production, so this only fires on a bot-wiring bug or an incomplete test construction.
    """
    if settings.chat_platform == "slack":
        if http_client is None:
            raise RuntimeError(
                "chat_platform='slack' requires a pooled httpx client, but none was supplied — "
                "refusing to silently route this escalation to Discord instead. make_bot always "
                "passes one in production; this indicates a bot-wiring bug."
            )
        bot_token = settings.slack_bot_token
        channel_id = settings.slack_escalation_channel_id
        if bot_token is None or channel_id is None:
            # Unreachable given Settings' fail-closed validator — kept as an explicit narrowing
            # guard (never an `assert`, which strips under -O) rather than a silent Discord degrade.
            raise RuntimeError(
                "chat_platform='slack' but slack_bot_token/slack_escalation_channel_id are unset "
                "— Settings' validator should have refused construction."
            )
        return SlackThreadOpener(bot_token=bot_token, channel_id=channel_id, client=http_client)
    return _DiscordThreadOpener(channel, mention_role_id=settings.support_human_role_id)


def _human_mention(settings: Settings) -> str | None:
    """The platform-appropriate escalation mention (ADR-0287). Discord and Slack use INCOMPATIBLE
    mention syntaxes — Discord's role-mention `<@&roleId>` posted verbatim into Slack renders as
    dead text and pings nobody, so the active ``chat_platform`` selects which setting (and which
    syntax) is used, rather than always emitting the Discord form.
    """
    if settings.chat_platform == "slack":
        return settings.slack_escalation_mention
    return f"<@&{settings.support_human_role_id}>" if settings.support_human_role_id else None


def _escalator_factory(
    settings: Settings,
    store: TicketStore | None,
    channel: discord.abc.Messageable,
    issue_tracker: IssueTracker | None = None,
    author: discord.Member | discord.User | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> Callable[[], Escalator]:
    mention = _human_mention(settings)
    # ADR-0278 Track K: resolved once per request, from whatever member context the caller has (a
    # bare discord.User — e.g. a DM — carries no roles, so it never signals priority; fail-closed).
    priority = member_has_priority_support(
        settings, author if isinstance(author, discord.Member) else None
    )

    def make() -> Escalator:
        opener = _build_chat_platform(settings, channel, http_client)
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
    analytics: AnswerAnalytics | None = None,
) -> commands.Bot:
    """Construct the discord.py bot. The listener intent is only requested if a channel is configured.

    ``http_client`` is the bot's already-pooled outbound client (see ``__main__.py``); passing it
    enables the Linear triage sink when its three settings are also configured (ADR-0206). Tests
    that omit it simply never construct the Linear sink. ``analytics`` (2026-07-10) is the
    env-gated per-answer telemetry sink — None means no capture code runs at all.
    """
    issue_tracker = linear_issue_tracker(settings, http_client)

    def observe(surface: str, user_id: str) -> Callable[[str, AnswerResult], Awaitable[None]] | None:
        """Bind the telemetry callback for one interaction, or None when analytics is off."""
        if analytics is None:
            return None
        sink = analytics  # local binding so the closure sees a non-None type

        async def on_result(question: str, result: AnswerResult) -> None:
            await sink.capture_answer(
                question=question, result=result, surface=surface, user_id=user_id
            )

        return on_result
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
                http_client=http_client,
            ),
            max_chars=settings.max_question_chars,
            on_result=observe("ask", str(interaction.user.id)),
        )
        await interaction.followup.send(reply)

    @bot.event
    async def on_message(message: discord.Message) -> None:  # pyright: ignore[reportUnusedFunction]
        if message.author.bot or message.author == bot.user:
            return
        if settings.support_channel_id is None or message.channel.id != settings.support_channel_id:
            return

        # Reply-'escalate' (2026-07-10 picker): a bare "escalate" reply to one of the bot's own
        # messages forces the same Linear Triage escalation the LOW tier uses, without re-running
        # the pipeline.
        ref = message.reference.resolved if message.reference is not None else None
        is_reply_to_bot = isinstance(ref, discord.Message) and ref.author == bot.user
        escalate_reply = await handle_escalate_reply(
            content=message.content,
            is_reply_to_bot=is_reply_to_bot,
            referenced_content=ref.content if isinstance(ref, discord.Message) else None,
            escalator_factory=_escalator_factory(
                settings,
                store,
                message.channel,
                issue_tracker,
                author=message.author,
                http_client=http_client,
            ),
        )
        if escalate_reply is not None:
            if analytics is not None:
                await analytics.capture_escalate_reply(
                    user_id=str(message.author.id),
                    referenced_answer=ref.content if isinstance(ref, discord.Message) else None,
                )
            await message.reply(escalate_reply)
            return

        async with message.channel.typing():
            reply = await handle_question(
                question=message.content,
                pipeline=pipeline,
                escalator_factory=_escalator_factory(
                    settings,
                    store,
                    message.channel,
                    issue_tracker,
                    author=message.author,
                    http_client=http_client,
                ),
                max_chars=settings.max_question_chars,
                on_result=observe("channel", str(message.author.id)),
            )
        await message.reply(reply)

    register_member_commands(bot, settings)
    return bot
