"""Pure handler logic (format_answer / handle_question / handle_escalate_reply) — no live gateway."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import discord

from caisson_support_bot.bot import (
    _escalator_factory,
    format_answer,
    handle_escalate_reply,
    handle_question,
)
from caisson_support_bot.config import Settings
from caisson_support_bot.contracts import AnswerResult, ConfidenceTier
from caisson_support_bot.escalation import Escalator, InMemoryTicketStore
from caisson_support_bot.inference import FakeInference
from caisson_support_bot.rag import SENTINEL, RagPipeline

from .conftest import FakeRetriever, FakeThreadOpener, chunk, sample_brief


def test_format_answer_appends_deduped_sources_footer() -> None:
    result = AnswerResult(
        resolved=True,
        answer="Here is the answer.",
        citations=["a.md", "a.md", "b.md"],
    )
    out = format_answer(result)
    assert out.startswith("Here is the answer.")
    assert "**Sources:**" in out
    assert out.count("a.md") == 1  # deduped


def test_format_answer_truncates_overlong_body() -> None:
    result = AnswerResult(resolved=True, answer="x" * 5000, citations=["a.md"])
    out = format_answer(result)
    assert len(out) <= 1900
    assert out.endswith("a.md`")


def test_format_answer_medium_tier_hedges_and_hints_escalate() -> None:
    result = AnswerResult(
        resolved=True,
        answer="Best-effort answer.",
        citations=["a.md"],
        tier=ConfidenceTier.medium,
    )
    out = format_answer(result)
    assert "not fully confident" in out.lower()
    assert "Best-effort answer." in out
    assert "**Sources:**" in out
    assert "reply `escalate`" in out.lower() or "escalate" in out.lower()


def test_format_answer_high_tier_unchanged_from_default() -> None:
    # tier defaults to HIGH; rendering must be byte-identical to the pre-picker behavior.
    plain = AnswerResult(resolved=True, answer="Plain answer.", citations=["a.md"])
    explicit_high = AnswerResult(
        resolved=True, answer="Plain answer.", citations=["a.md"], tier=ConfidenceTier.high
    )
    assert format_answer(plain) == format_answer(explicit_high)
    assert "not fully confident" not in format_answer(plain).lower()


async def test_handle_question_resolved_returns_answer_no_escalation() -> None:
    docs = FakeRetriever([chunk("packages/billing/README.md", "Billing uses HMAC.")])
    pipe = RagPipeline(
        docs=docs, inference=FakeInference(reply="Billing uses HMAC.\nCONFIDENCE: 0.95")
    )
    store = InMemoryTicketStore()

    def factory() -> Escalator:
        return Escalator(store=store, thread_opener=FakeThreadOpener())

    out = await handle_question(
        question="how does billing verify?", pipeline=pipe, escalator_factory=factory
    )
    assert "Billing uses HMAC." in out
    assert "packages/billing/README.md" in out
    assert store.tickets == []  # resolved ⇒ no escalation


async def test_handle_question_unresolved_escalates() -> None:
    pipe = RagPipeline(docs=FakeRetriever([]), inference=FakeInference(reply="unused"))
    store = InMemoryTicketStore()
    opener = FakeThreadOpener()

    def factory() -> Escalator:
        return Escalator(store=store, thread_opener=opener, human_mention="<@&1>")

    out = await handle_question(
        question="something obscure", pipeline=pipe, escalator_factory=factory
    )
    assert "human" in out.lower()
    assert len(store.tickets) == 1
    assert len(opener.opened) == 1
    assert store.tickets[0].ai_brief.question == "something obscure"


async def test_handle_question_sentinel_escalates() -> None:
    docs = FakeRetriever([chunk("a.md", "weak context")])
    pipe = RagPipeline(docs=docs, inference=FakeInference(reply=SENTINEL))
    store = InMemoryTicketStore()

    def factory() -> Escalator:
        return Escalator(store=store, thread_opener=FakeThreadOpener())

    await handle_question(question="ambiguous", pipeline=pipe, escalator_factory=factory)
    assert len(store.tickets) == 1


async def test_handle_question_empty_input_prompts() -> None:
    pipe = RagPipeline(docs=FakeRetriever([]), inference=FakeInference())
    store = InMemoryTicketStore()
    out = await handle_question(
        question="   ", pipeline=pipe, escalator_factory=lambda: Escalator(store=store)
    )
    assert "Ask me" in out
    assert store.tickets == []  # no escalation on an empty prompt


def _settings(**overrides: object) -> Settings:
    return Settings(
        discord_token="x-discord",
        openrouter_api_key="x-openrouter",
        docs_service_url="https://docs.test",  # type: ignore[arg-type]
        docs_service_token="x-docs",
        **overrides,  # type: ignore[arg-type]
    )


def _mock_channel() -> discord.abc.Messageable:
    # No `create_thread` on the spec ⇒ _DiscordThreadOpener falls back to a plain send (mirrors
    # test_bot_mentions.py's not-thread-capable fixture) — the escalation path under test here is
    # the priority signal, not thread creation.
    channel = MagicMock(spec=["send"])
    channel.send = AsyncMock()
    return channel


async def test_escalator_factory_flags_priority_when_author_holds_the_role() -> None:
    # ADR-0278 Track K: _escalator_factory resolves the priority signal ONCE per request from
    # whatever member context the caller (bot.py's /ask or #ask-ai listener) hands it.
    settings = _settings(role_priority_support_id=999)
    holder = MagicMock(spec=discord.Member)
    holder.roles = [MagicMock(id=999)]

    factory = _escalator_factory(settings, None, _mock_channel(), author=holder)
    ticket = await factory().escalate(sample_brief())
    assert ticket.priority is True


async def test_escalator_factory_normal_lane_when_role_unheld_or_no_member_context() -> None:
    settings = _settings(role_priority_support_id=999)
    non_holder = MagicMock(spec=discord.Member)
    non_holder.roles = [MagicMock(id=1)]

    ticket = await _escalator_factory(
        settings, None, _mock_channel(), author=non_holder
    )().escalate(sample_brief())
    assert ticket.priority is False

    # A bare discord.User (e.g. a DM) carries no guild roles — never a priority signal.
    dm_author = MagicMock(spec=discord.User)
    ticket = await _escalator_factory(settings, None, _mock_channel(), author=dm_author)().escalate(
        sample_brief()
    )
    assert ticket.priority is False


# --------------------------------------------------------------------------------------------------
# handle_escalate_reply (2026-07-10 picker) — the cheap reply-'escalate' handler MEDIUM-tier answers
# point at.
# --------------------------------------------------------------------------------------------------
async def test_escalate_reply_files_the_same_escalation_as_low_tier() -> None:
    store = InMemoryTicketStore()
    opener = FakeThreadOpener()

    def factory() -> Escalator:
        return Escalator(store=store, thread_opener=opener)

    out = await handle_escalate_reply(
        content="escalate",
        is_reply_to_bot=True,
        referenced_content="Best-effort answer.",
        escalator_factory=factory,
    )
    assert out is not None
    assert "escalated" in out.lower()
    assert len(store.tickets) == 1
    assert store.tickets[0].question == "Best-effort answer."
    assert len(opener.opened) == 1


async def test_escalate_reply_is_case_and_whitespace_tolerant() -> None:
    store = InMemoryTicketStore()

    def factory() -> Escalator:
        return Escalator(store=store)

    out = await handle_escalate_reply(
        content="  Escalate  ",
        is_reply_to_bot=True,
        referenced_content="ans",
        escalator_factory=factory,
    )
    assert out is not None
    assert len(store.tickets) == 1


async def test_escalate_reply_ignored_when_not_a_reply_to_the_bot() -> None:
    store = InMemoryTicketStore()

    def factory() -> Escalator:
        return Escalator(store=store)

    out = await handle_escalate_reply(
        content="escalate",
        is_reply_to_bot=False,
        referenced_content=None,
        escalator_factory=factory,
    )
    assert out is None
    assert store.tickets == []


async def test_escalate_reply_ignored_when_content_is_not_the_keyword() -> None:
    store = InMemoryTicketStore()

    def factory() -> Escalator:
        return Escalator(store=store)

    out = await handle_escalate_reply(
        content="thanks, that helped!",
        is_reply_to_bot=True,
        referenced_content="ans",
        escalator_factory=factory,
    )
    assert out is None
    assert store.tickets == []


async def test_escalate_reply_missing_referenced_content_still_escalates() -> None:
    store = InMemoryTicketStore()

    def factory() -> Escalator:
        return Escalator(store=store)

    out = await handle_escalate_reply(
        content="escalate", is_reply_to_bot=True, referenced_content=None, escalator_factory=factory
    )
    assert out is not None
    assert len(store.tickets) == 1
    assert "unavailable" in store.tickets[0].question.lower()
