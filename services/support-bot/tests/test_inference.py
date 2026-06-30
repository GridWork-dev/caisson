"""OpenRouterInference over httpx MockTransport + the FakeInference double."""

from __future__ import annotations

import httpx
import pytest

from caisson_support_bot.inference import FakeInference, InferenceError, OpenRouterInference

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
