"""DocsClient over httpx MockTransport — Bearer, payload, error mapping (no live services/docs)."""

from __future__ import annotations

import httpx
import pytest

from caisson_support_bot.docs_client import DocsClient, DocsUnavailableError

from .conftest import make_client


async def test_query_sends_bearer_and_payload_and_parses_chunks() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["url"] = str(request.url)
        seen["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "chunks": [
                    {"id": "1", "source": "a/b.md", "title": "B", "text": "answer", "score": 2}
                ]
            },
        )

    async with make_client(handler) as client:
        docs = DocsClient(
            query_url="https://docs.test/query", token="secret", client=client, default_k=6
        )
        chunks = await docs.query("how?", 3)

    assert seen["auth"] == "Bearer secret"
    assert seen["url"] == "https://docs.test/query"
    assert '"query":"how?"' in str(seen["body"]).replace(" ", "")
    assert '"k":3' in str(seen["body"]).replace(" ", "")
    assert len(chunks) == 1 and chunks[0].source == "a/b.md"


async def test_query_uses_default_k_when_unset() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert '"k":6' in request.read().decode().replace(" ", "")
        return httpx.Response(200, json={"chunks": []})

    async with make_client(handler) as client:
        docs = DocsClient(
            query_url="https://docs.test/query", token="t", client=client, default_k=6
        )
        assert await docs.query("q") == []


async def test_non_200_raises_unavailable() -> None:
    async with make_client(
        lambda req: httpx.Response(401, json={"error": "unauthorized"})
    ) as client:
        docs = DocsClient(query_url="https://docs.test/query", token="t", client=client)
        with pytest.raises(DocsUnavailableError):
            await docs.query("q")


async def test_timeout_raises_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("boom", request=request)

    async with make_client(handler) as client:
        docs = DocsClient(query_url="https://docs.test/query", token="t", client=client)
        with pytest.raises(DocsUnavailableError):
            await docs.query("q")


async def test_malformed_body_raises_unavailable() -> None:
    async with make_client(lambda req: httpx.Response(200, text="not json")) as client:
        docs = DocsClient(query_url="https://docs.test/query", token="t", client=client)
        with pytest.raises(DocsUnavailableError):
            await docs.query("q")
