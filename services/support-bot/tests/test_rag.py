"""RagPipeline decision paths: grounded answer vs the three escalation triggers (ADR-0009 binding)."""

from __future__ import annotations

from caisson_support_bot.docs_client import DocsUnavailableError
from caisson_support_bot.inference import FakeInference
from caisson_support_bot.rag import SENTINEL, RagPipeline

from .conftest import FakeRetriever, chunk


async def test_resolved_answer_carries_citations() -> None:
    docs = FakeRetriever(
        [chunk("packages/credits/README.md", "Credits are integer units.", pkg="@caisson/credits")]
    )
    pipe = RagPipeline(docs=docs, inference=FakeInference(reply="Credits are integer units."))
    result = await pipe.answer("how do credits work?")
    assert result.resolved is True
    assert result.answer == "Credits are integer units."
    assert result.citations == ["packages/credits/README.md"]
    assert result.brief is None


async def test_grounded_prompt_includes_context_and_question() -> None:
    docs = FakeRetriever([chunk("a.md", "ALPHA-TEXT")])
    fake = FakeInference(reply="ok")
    pipe = RagPipeline(docs=docs, inference=fake)
    await pipe.answer("MY-QUESTION")
    system, user = fake.calls[0]
    assert SENTINEL in system  # the model is told how to signal insufficiency
    assert "ALPHA-TEXT" in user and "source: a.md" in user
    assert "MY-QUESTION" in user


async def test_empty_retrieval_escalates() -> None:
    pipe = RagPipeline(docs=FakeRetriever([]), inference=FakeInference(reply="should-not-be-used"))
    result = await pipe.answer("obscure question")
    assert result.resolved is False
    assert result.brief is not None
    assert "No documentation matched" in result.brief.summary
    assert result.brief.sources_considered == []


async def test_sentinel_escalates_with_sources() -> None:
    docs = FakeRetriever([chunk("a.md", "weak", pkg="@caisson/a"), chunk("b.md", "weaker")])
    pipe = RagPipeline(docs=docs, inference=FakeInference(reply=SENTINEL))
    result = await pipe.answer("ambiguous")
    assert result.resolved is False
    assert result.brief is not None
    assert result.brief.sources_considered == ["a.md", "b.md"]
    assert result.brief.suggested_owner == "@caisson/a"  # first chunk with a pkg


async def test_sentinel_boundary_escalates_lead_but_not_mention() -> None:
    # A reply that LEADS with the sentinel (model disobeyed "nothing else") still escalates — safe.
    docs = FakeRetriever([chunk("a.md", "ctx")])
    lead = RagPipeline(docs=docs, inference=FakeInference(reply=f"{SENTINEL} — not enough detail"))
    assert (await lead.answer("q")).resolved is False
    # A grounded answer that merely MENTIONS the token mid-sentence is a real answer, not an escalation
    # (the word-boundary fix — Greptile P2: a bare startswith/substring would wrongly escalate this).
    mention = RagPipeline(
        docs=docs,
        inference=FakeInference(reply=f"The {SENTINEL} token signals a refusal."),
    )
    res = await mention.answer("what does the token mean?")
    assert res.resolved is True
    assert res.answer.startswith(f"The {SENTINEL}")


async def test_retrieval_failure_escalates() -> None:
    docs = FakeRetriever(error=DocsUnavailableError("down"))
    pipe = RagPipeline(docs=docs, inference=FakeInference(reply="x"))
    result = await pipe.answer("q")
    assert result.resolved is False
    assert result.brief is not None
    assert "unavailable" in result.brief.summary.lower()
