"""Pure handler logic (format_answer / handle_question) — no live gateway."""

from __future__ import annotations

from caisson_support_bot.bot import format_answer, handle_question
from caisson_support_bot.contracts import AnswerResult
from caisson_support_bot.escalation import Escalator, InMemoryTicketStore
from caisson_support_bot.inference import FakeInference
from caisson_support_bot.rag import SENTINEL, RagPipeline

from .conftest import FakeRetriever, FakeThreadOpener, chunk


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


async def test_handle_question_resolved_returns_answer_no_escalation() -> None:
    docs = FakeRetriever([chunk("packages/billing/README.md", "Billing uses HMAC.")])
    pipe = RagPipeline(docs=docs, inference=FakeInference(reply="Billing uses HMAC."))
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
