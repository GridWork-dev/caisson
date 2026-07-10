"""The 2026-07-10 picker's 3-tier confidence gate: ``grade_confidence`` (pure, signals-in/tier-out),
``_extract_confidence`` (parsing the model's trailing self-assessment line), and the pipeline-level
MEDIUM/LOW-via-low-confidence paths in ``RagPipeline.answer``. Sentinel/leak/empty-retrieval/
retrieval-failure escalation stays covered by ``test_rag.py``.
"""

from __future__ import annotations

from caisson_support_bot.contracts import ConfidenceTier
from caisson_support_bot.inference import FakeInference
from caisson_support_bot.rag import RagPipeline, _extract_confidence, grade_confidence

from .conftest import FakeRetriever, chunk

_HIGH = 0.85
_LOW = 0.55


# --------------------------------------------------------------------------------------------------
# grade_confidence — pure, boundary cases at both thresholds.
# --------------------------------------------------------------------------------------------------
def test_grade_confidence_missing_signal_is_low() -> None:
    assert grade_confidence(None, high=_HIGH, low=_LOW) is ConfidenceTier.low


def test_grade_confidence_at_high_threshold_is_high() -> None:
    assert grade_confidence(_HIGH, high=_HIGH, low=_LOW) is ConfidenceTier.high


def test_grade_confidence_just_below_high_is_medium() -> None:
    assert grade_confidence(_HIGH - 0.01, high=_HIGH, low=_LOW) is ConfidenceTier.medium


def test_grade_confidence_at_low_threshold_is_medium() -> None:
    assert grade_confidence(_LOW, high=_HIGH, low=_LOW) is ConfidenceTier.medium


def test_grade_confidence_just_below_low_is_low() -> None:
    assert grade_confidence(_LOW - 0.01, high=_HIGH, low=_LOW) is ConfidenceTier.low


def test_grade_confidence_at_one_and_zero() -> None:
    assert grade_confidence(1.0, high=_HIGH, low=_LOW) is ConfidenceTier.high
    assert grade_confidence(0.0, high=_HIGH, low=_LOW) is ConfidenceTier.low


# --------------------------------------------------------------------------------------------------
# _extract_confidence — parsing the trailing self-assessment line.
# --------------------------------------------------------------------------------------------------
def test_extract_confidence_parses_trailing_line() -> None:
    body, conf = _extract_confidence("The answer is X.\nCONFIDENCE: 0.90")
    assert body == "The answer is X."
    assert conf == 0.90


def test_extract_confidence_case_insensitive_and_whitespace_tolerant() -> None:
    body, conf = _extract_confidence("The answer is X.\n  confidence:   0.7  ")
    assert body == "The answer is X."
    assert conf == 0.7


def test_extract_confidence_missing_trailer_is_none() -> None:
    body, conf = _extract_confidence("The answer is X, no trailer at all.")
    assert body == "The answer is X, no trailer at all."
    assert conf is None


def test_extract_confidence_out_of_range_is_none_but_still_strips_line() -> None:
    # A model that misreads "0-1" as a percent (e.g. "95") must never be coerced into 0.95 — the
    # malformed trailer is stripped from the body (never shown to the user) but confidence is None.
    body, conf = _extract_confidence("The answer is X.\nCONFIDENCE: 95")
    assert body == "The answer is X."
    assert conf is None


def test_extract_confidence_malformed_number_is_none() -> None:
    body, conf = _extract_confidence("The answer is X.\nCONFIDENCE: not-a-number")
    assert conf is None
    assert "CONFIDENCE" in body  # not a matched trailer, so nothing is stripped


# --------------------------------------------------------------------------------------------------
# RagPipeline.answer — the MEDIUM tier and LOW-via-low-confidence paths (HIGH is covered by the
# pre-existing test_rag.py / test_rag_grounding_eval.py cases, updated to carry a HIGH-range trailer).
# --------------------------------------------------------------------------------------------------
async def test_medium_confidence_resolves_with_medium_tier() -> None:
    docs = FakeRetriever([chunk("a.md", "context")])
    pipe = RagPipeline(
        docs=docs,
        inference=FakeInference(reply="Best-effort answer.\nCONFIDENCE: 0.60"),
        confidence_high=_HIGH,
        confidence_low=_LOW,
    )
    result = await pipe.answer("q")
    assert result.resolved is True
    assert result.tier is ConfidenceTier.medium
    assert result.answer == "Best-effort answer."
    assert result.brief is None


async def test_low_confidence_discards_answer_and_escalates() -> None:
    docs = FakeRetriever([chunk("a.md", "context", pkg="@caisson/a")])
    pipe = RagPipeline(
        docs=docs,
        inference=FakeInference(reply="Shaky answer.\nCONFIDENCE: 0.10"),
        confidence_high=_HIGH,
        confidence_low=_LOW,
    )
    result = await pipe.answer("q")
    assert result.resolved is False
    assert result.answer == ""
    assert result.citations == []
    assert result.brief is not None
    assert "0.10" in result.brief.summary
    assert result.brief.sources_considered == ["a.md"]


async def test_missing_confidence_signal_fails_closed_to_escalation() -> None:
    # A grounded, non-sentinel, non-leaking reply with NO confidence trailer at all — the model
    # simply didn't follow the format. Fail-closed: escalate, never fail open to a confident answer.
    docs = FakeRetriever([chunk("a.md", "context")])
    pipe = RagPipeline(
        docs=docs,
        inference=FakeInference(reply="An answer with no trailer whatsoever."),
        confidence_high=_HIGH,
        confidence_low=_LOW,
    )
    result = await pipe.answer("q")
    assert result.resolved is False
    assert result.brief is not None
    assert "missing" in result.brief.summary.lower()


async def test_high_confidence_resolves_with_high_tier() -> None:
    docs = FakeRetriever([chunk("a.md", "context")])
    pipe = RagPipeline(
        docs=docs,
        inference=FakeInference(reply="Confident answer.\nCONFIDENCE: 0.99"),
        confidence_high=_HIGH,
        confidence_low=_LOW,
    )
    result = await pipe.answer("q")
    assert result.resolved is True
    assert result.tier is ConfidenceTier.high
    assert result.answer == "Confident answer."
