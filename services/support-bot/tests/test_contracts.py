"""Boundary-model validation (the Zod-.strict() analogue)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from caisson_support_bot.contracts import (
    AnswerResult,
    Brief,
    DocKind,
    DocsQueryResponse,
    ScoredChunk,
    Ticket,
)


def test_scored_chunk_parses_and_ignores_unknown_fields() -> None:
    # The docs service owns the schema; a forward-compatible extra field must not break a support answer.
    c = ScoredChunk.model_validate(
        {"id": "x", "source": "a/b.md", "title": "B", "text": "hi", "score": 0.5, "future_field": 1}
    )
    assert c.source == "a/b.md"
    assert c.text == "hi"


def test_scored_chunk_accepts_the_pricing_kind() -> None:
    # ADR-0234 F4: a `kind:"pricing"` chunk from the expanded corpus must parse (not a 500) — the enum
    # value is a KNOWN member, unlike an unknown one which `extra="ignore"` would NOT save.
    c = ScoredChunk.model_validate(
        {
            "id": "p",
            "source": "pricing/editions",
            "title": "Pricing",
            "text": "$799",
            "kind": "pricing",
        }
    )
    assert c.kind is DocKind.pricing


def test_scored_chunk_rejects_empty_source_and_text() -> None:
    with pytest.raises(ValidationError):
        ScoredChunk.model_validate({"id": "x", "source": "", "title": "t", "text": "y"})
    with pytest.raises(ValidationError):
        ScoredChunk.model_validate({"id": "x", "source": "s", "title": "t", "text": ""})


def test_docs_query_response_defaults_to_empty() -> None:
    assert DocsQueryResponse.model_validate({}).chunks == []
    resp = DocsQueryResponse.model_validate(
        {"chunks": [{"id": "1", "source": "s", "title": "t", "text": "u"}]}
    )
    assert len(resp.chunks) == 1


def test_answer_result_and_brief_roundtrip() -> None:
    brief = Brief(
        question="q", summary="s", sources_considered=["a.md"], suggested_owner="@caisson/x"
    )
    r = AnswerResult(resolved=False, brief=brief)
    assert r.resolved is False
    assert r.brief is not None and r.brief.suggested_owner == "@caisson/x"


def test_ticket_carries_ai_brief() -> None:
    brief = Brief(question="q", summary="s")
    t = Ticket(id="abc", question="q", ai_brief=brief)
    assert t.ai_brief.question == "q"
    assert t.status.value == "open"
