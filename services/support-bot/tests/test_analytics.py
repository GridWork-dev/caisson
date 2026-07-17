"""Per-answer telemetry (analytics.py): event shaping, pseudonymous ids, fail-soft capture."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from caisson_support_bot.analytics import (
    AnswerAnalytics,
    answer_event,
    generation_event,
    hash_distinct_id,
)
from caisson_support_bot.bot import handle_question
from caisson_support_bot.contracts import AnswerResult, Brief, ConfidenceTier
from caisson_support_bot.inference import GenerationTelemetry


def _resolved(tier: ConfidenceTier = ConfidenceTier.high) -> AnswerResult:
    return AnswerResult(
        resolved=True,
        answer="Grounded answer.",
        citations=["a.md", "b.md"],
        tier=tier,
        confidence=0.93,
    )


def _escalated() -> AnswerResult:
    return AnswerResult(
        resolved=False,
        confidence=0.4,
        brief=Brief(question="q", summary="Below the escalation threshold."),
    )


def test_answer_event_resolved_high() -> None:
    event, props = answer_event(
        question="How do credits expire?", result=_resolved(), surface="ask"
    )
    assert event == "support_answer"
    assert props["outcome"] == "answered_high"
    assert props["tier"] == "high"
    assert props["confidence"] == 0.93
    assert props["citations_count"] == 2
    assert props["surface"] == "ask"
    assert props["resolved"] is True


def test_answer_event_medium_maps_outcome() -> None:
    _, props = answer_event(
        question="q", result=_resolved(ConfidenceTier.medium), surface="channel"
    )
    assert props["outcome"] == "answered_medium"
    assert props["tier"] == "medium"


def test_answer_event_escalation_carries_reason_and_no_tier() -> None:
    _, props = answer_event(question="q", result=_escalated(), surface="channel")
    assert props["outcome"] == "escalated"
    assert props["escalation_reason"] == "Below the escalation threshold."
    assert props["confidence"] == 0.4
    assert "tier" not in props


def test_answer_event_truncates_question() -> None:
    _, props = answer_event(question="x" * 999, result=_resolved(), surface="ask")
    assert len(str(props["question"])) == 200
    assert props["question_chars"] == 999


def test_hash_distinct_id_is_stable_and_pseudonymous() -> None:
    a = hash_distinct_id("123456789")
    assert a == hash_distinct_id("123456789")
    assert a != hash_distinct_id("987654321")
    assert a.startswith("support:")
    assert "123456789" not in a


@pytest.mark.asyncio
async def test_capture_posts_the_posthog_envelope() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"status": 1})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        analytics = AnswerAnalytics(key="phc_test", host="https://ph.test", client=client)
        await analytics.capture_answer(
            question="q?", result=_resolved(), surface="ask", user_id="42"
        )

    assert len(seen) == 1
    assert str(seen[0].url) == "https://ph.test/capture/"
    body = json.loads(seen[0].content)
    assert body["api_key"] == "phc_test"
    assert body["event"] == "support_answer"
    assert body["distinct_id"] == hash_distinct_id("42")
    assert body["properties"]["outcome"] == "answered_high"


@pytest.mark.asyncio
async def test_capture_is_fail_soft_on_network_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        analytics = AnswerAnalytics(key="phc_test", host="https://ph.test", client=client)
        # Must not raise — a telemetry outage never touches the answer path.
        await analytics.capture_answer(
            question="q", result=_escalated(), surface="channel", user_id="42"
        )
        await analytics.capture_escalate_reply(user_id="42", referenced_answer="prior answer")


# --- $ai_generation telemetry (CAISSON-120 / audit M4) ----------------------------------------------


def test_generation_event_shape_and_trace_linkage() -> None:
    props = generation_event(
        GenerationTelemetry(
            model="anthropic/claude-sonnet-4.6",
            status=200,
            input_tokens=812,
            output_tokens=64,
            cost=0.003,
            latency_s=1.4,
        )
    )
    assert props["$ai_model"] == "anthropic/claude-sonnet-4.6"
    assert props["$ai_provider"] == "openrouter"
    assert props["$ai_input_tokens"] == 812
    assert props["$ai_output_tokens"] == 64
    assert props["$ai_total_cost_usd"] == 0.003
    assert props["$ai_http_status"] == 200
    assert props["$ai_latency"] == 1.4
    assert props["$ai_is_error"] is False
    # fresh trace id doubled as the parent id (single-span generation).
    assert props["$ai_trace_id"] == props["$ai_parent_id"]
    assert isinstance(props["$ai_trace_id"], str) and len(str(props["$ai_trace_id"])) > 0


def test_generation_event_never_emits_prompt_or_completion_text() -> None:
    props = generation_event(GenerationTelemetry(model="m", input_tokens=1, output_tokens=1))
    for banned in ("$ai_input", "$ai_output_choices", "$ai_input_state"):
        assert banned not in props


def test_generation_event_error_path_carries_error_and_missing_counts_default_zero() -> None:
    props = generation_event(
        GenerationTelemetry(model="m", status=429, error="openrouter returned 429")
    )
    assert props["$ai_is_error"] is True
    assert props["$ai_error"] == "openrouter returned 429"
    assert props["$ai_http_status"] == 429
    # missing usage ⇒ counts default to 0, and no cost key is emitted.
    assert props["$ai_input_tokens"] == 0
    assert props["$ai_output_tokens"] == 0
    assert "$ai_total_cost_usd" not in props


@pytest.mark.asyncio
async def test_capture_generation_posts_the_ai_generation_envelope() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"status": 1})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        analytics = AnswerAnalytics(key="phc_test", host="https://ph.test", client=client)
        await analytics.capture_generation(
            GenerationTelemetry(model="m", status=200, input_tokens=5, output_tokens=7, cost=0.001)
        )

    assert len(seen) == 1
    assert str(seen[0].url) == "https://ph.test/capture/"
    body = json.loads(seen[0].content)
    assert body["api_key"] == "phc_test"
    assert body["event"] == "$ai_generation"
    assert body["distinct_id"] == "support:server"
    assert body["properties"]["$ai_input_tokens"] == 5


@pytest.mark.asyncio
async def test_capture_generation_is_fail_soft_on_network_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        analytics = AnswerAnalytics(key="phc_test", host="https://ph.test", client=client)
        # Must not raise — a telemetry outage never touches the answer path.
        await analytics.capture_generation(GenerationTelemetry(model="m"))


@pytest.mark.asyncio
async def test_handle_question_invokes_on_result_with_cleaned_question() -> None:
    pipeline = MagicMock()
    pipeline.answer = AsyncMock(return_value=_resolved())
    observed: list[tuple[str, AnswerResult]] = []

    async def on_result(question: str, result: AnswerResult) -> None:
        observed.append((question, result))

    out = await handle_question(
        question="  How do credits expire?  ",
        pipeline=pipeline,
        escalator_factory=MagicMock(),
        on_result=on_result,
    )
    assert "Grounded answer." in out
    assert observed == [("How do credits expire?", _resolved())]


@pytest.mark.asyncio
async def test_handle_question_skips_on_result_for_empty_question() -> None:
    pipeline = MagicMock()
    pipeline.answer = AsyncMock()
    called = AsyncMock()
    await handle_question(
        question="   ",
        pipeline=pipeline,
        escalator_factory=MagicMock(),
        on_result=called,
    )
    called.assert_not_awaited()
    pipeline.answer.assert_not_awaited()
