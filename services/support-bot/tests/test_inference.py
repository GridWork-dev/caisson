"""OpenRouterInference over httpx MockTransport + the FakeInference double."""

from __future__ import annotations

import httpx
import pytest

from caisson_support_bot.inference import (
    FakeInference,
    GenerationTelemetry,
    InferenceError,
    OpenRouterInference,
)

from .conftest import make_client


async def test_openrouter_sends_headers_and_body_and_returns_content() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["referer"] = request.headers.get("http-referer")
        seen["title"] = request.headers.get("x-title")
        seen["body"] = request.read().decode()
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "  grounded answer  "}}]}
        )

    async with make_client(handler) as client:
        inf = OpenRouterInference(
            api_key="k",
            model="anthropic/claude-3.5-sonnet",
            client=client,
            referer="https://caisson.sh",
        )
        out = await inf.generate(system="sys", user="usr")

    assert out == "grounded answer"  # stripped
    assert seen["auth"] == "Bearer k"
    assert seen["referer"] == "https://caisson.sh"
    assert seen["title"] == "Caisson Support Bot"
    body = str(seen["body"])
    assert "anthropic/claude-3.5-sonnet" in body
    compact = body.replace(" ", "")
    assert '"role":"system"' in compact and '"role":"user"' in compact


async def test_non_200_raises() -> None:
    async with make_client(lambda req: httpx.Response(429, json={"error": "rate"})) as client:
        inf = OpenRouterInference(api_key="k", model="m", client=client)
        with pytest.raises(InferenceError):
            await inf.generate(system="s", user="u")


async def test_empty_completion_raises() -> None:
    async with make_client(
        lambda req: httpx.Response(200, json={"choices": [{"message": {"content": "   "}}]})
    ) as client:
        inf = OpenRouterInference(api_key="k", model="m", client=client)
        with pytest.raises(InferenceError):
            await inf.generate(system="s", user="u")


async def test_malformed_completion_raises() -> None:
    async with make_client(lambda req: httpx.Response(200, json={"unexpected": True})) as client:
        inf = OpenRouterInference(api_key="k", model="m", client=client)
        with pytest.raises(InferenceError):
            await inf.generate(system="s", user="u")


async def test_fake_inference_records_calls_and_returns_canned() -> None:
    fake = FakeInference(reply="canned")
    out = await fake.generate(system="s", user="u")
    assert out == "canned"
    assert fake.calls == [("s", "u")]


# --- $ai_generation telemetry (CAISSON-120 / audit M4) ----------------------------------------------


async def test_on_generation_surfaces_usage_on_success() -> None:
    seen: list[GenerationTelemetry] = []

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "grounded"}}],
                "usage": {"prompt_tokens": 812, "completion_tokens": 64, "cost": 0.003},
            },
        )

    async def observe(tel: GenerationTelemetry) -> None:
        seen.append(tel)

    async with make_client(handler) as client:
        inf = OpenRouterInference(
            api_key="k", model="anthropic/claude-sonnet-4.6", client=client, on_generation=observe
        )
        out = await inf.generate(system="s", user="u")

    assert out == "grounded"
    assert len(seen) == 1
    tel = seen[0]
    assert tel.model == "anthropic/claude-sonnet-4.6"
    assert tel.status == 200
    assert tel.input_tokens == 812
    assert tel.output_tokens == 64
    assert tel.cost == 0.003
    assert tel.latency_s >= 0.0
    assert tel.is_error is False
    assert tel.error is None


async def test_on_generation_reports_error_on_non_200() -> None:
    seen: list[GenerationTelemetry] = []

    async def observe(tel: GenerationTelemetry) -> None:
        seen.append(tel)

    async with make_client(lambda req: httpx.Response(429, json={"error": "rate"})) as client:
        inf = OpenRouterInference(api_key="k", model="m", client=client, on_generation=observe)
        with pytest.raises(InferenceError):
            await inf.generate(system="s", user="u")

    assert len(seen) == 1
    assert seen[0].status == 429
    assert seen[0].is_error is True
    assert "429" in (seen[0].error or "")


async def test_on_generation_failure_is_fail_soft() -> None:
    """A throwing observer must never break generation (telemetry is best-effort)."""

    async def boom(tel: GenerationTelemetry) -> None:
        raise RuntimeError("posthog down")

    async with make_client(
        lambda req: httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})
    ) as client:
        inf = OpenRouterInference(api_key="k", model="m", client=client, on_generation=boom)
        out = await inf.generate(system="s", user="u")  # must not raise

    assert out == "ok"
