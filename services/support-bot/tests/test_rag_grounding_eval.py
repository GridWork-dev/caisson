"""Offline eval baseline for RAG retrieval grounding — the Python-side counterpart to the
``@caisson/ai-evals`` cassette-replay pattern used on the TypeScript surfaces (packages/ai-evals):
a small, fixed, high-signal case set run through the REAL pipeline (``RagPipeline.answer``) with the
network legs swapped for the repo's existing hermetic doubles (``FakeRetriever``/``FakeInference``
from ``conftest.py``) — no cassette file is needed here because there is no model judge to replay,
only a deterministic fake standing in for the model's reply. Zero network by construction: this is a
plain (non-``live``) test module, so it always runs in the default ``uv run pytest`` suite.

Where ``test_rag.py`` exhaustively unit-tests each individual decision branch (injection defense,
fence-breakout, framing leaks), this file pins one narrower contract end-to-end: for a given
question and retrieval result, does the pipeline's answer stay grounded — citing only documents
that were actually retrieved — or correctly refuse rather than hallucinate? Each case fails if that
contract breaks, whether the pipeline starts fabricating citations, stops escalating on missing
context, or forces an answer out of an insufficiency signal.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from caisson_support_bot.contracts import ScoredChunk
from caisson_support_bot.docs_client import DocsUnavailableError
from caisson_support_bot.inference import FakeInference
from caisson_support_bot.rag import SENTINEL, RagPipeline

from .conftest import FakeRetriever, chunk


@dataclass(frozen=True)
class GroundingCase:
    id: str
    question: str
    chunks: list[ScoredChunk] = field(default_factory=list)
    reply: str | None = None
    retrieval_error: Exception | None = None
    expect_resolved: bool = True
    # For a resolved case: the exact citation set the answer must carry (== the retrieved sources,
    # never more, never fewer — the structural anti-hallucination check).
    expect_citations: list[str] | None = None
    # For an escalated case: the exact `sources_considered` the brief must carry.
    expect_sources_considered: list[str] | None = None


GROUNDING_DOC = "packages/credits/README.md"
OTHER_DOC = "packages/billing/README.md"

CASES: list[GroundingCase] = [
    GroundingCase(
        id="grounded-single-source-cites-the-retrieved-doc",
        question="how do credits work?",
        chunks=[chunk(GROUNDING_DOC, "Credits are integer units, never floats.")],
        reply=f"Credits are integer units, never floats. [{GROUNDING_DOC}]",
        expect_resolved=True,
        expect_citations=[GROUNDING_DOC],
    ),
    GroundingCase(
        id="grounded-multi-source-citations-exactly-match-retrieval-no-fabrication",
        question="how does billing relate to credits?",
        chunks=[
            chunk(GROUNDING_DOC, "Credits are integer units."),
            chunk(OTHER_DOC, "Billing charges integer credits per module."),
        ],
        reply=f"Billing charges integer credits [{OTHER_DOC}], which are integer units [{GROUNDING_DOC}].",
        expect_resolved=True,
        # Citations must be EXACTLY the two retrieved sources — no third, invented source, and none
        # dropped, regardless of what the reply text itself mentions.
        expect_citations=[GROUNDING_DOC, OTHER_DOC],
    ),
    GroundingCase(
        id="empty-retrieval-escalates-never-a-fabricated-answer",
        question="what is the CEO's personal phone number?",
        chunks=[],
        reply="should-never-be-used",
        expect_resolved=False,
        expect_sources_considered=[],
    ),
    GroundingCase(
        id="insufficient-context-sentinel-escalates-despite-nonempty-retrieval",
        question="what is the exact SLA credit for a Tier-3 outage?",
        chunks=[chunk(OTHER_DOC, "Billing charges integer credits per module.")],
        reply=SENTINEL,
        expect_resolved=False,
        expect_sources_considered=[OTHER_DOC],
    ),
    GroundingCase(
        id="retrieval-service-down-escalates-instead-of-answering-blind",
        question="how do credits work?",
        retrieval_error=DocsUnavailableError("connection refused"),
        expect_resolved=False,
        expect_sources_considered=[],
    ),
]


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
async def test_grounding_baseline(case: GroundingCase) -> None:
    docs = FakeRetriever(case.chunks, error=case.retrieval_error)
    pipe = RagPipeline(docs=docs, inference=FakeInference(reply=case.reply))

    result = await pipe.answer(case.question)

    assert result.resolved is case.expect_resolved
    if case.expect_resolved:
        assert case.expect_citations is not None
        assert sorted(result.citations) == sorted(case.expect_citations)
        assert result.brief is None
    else:
        assert result.brief is not None
        assert case.expect_sources_considered is not None
        assert sorted(result.brief.sources_considered) == sorted(case.expect_sources_considered)
        # The escalation path must never carry an answer or a citation forward.
        assert result.answer == ""
        assert result.citations == []
