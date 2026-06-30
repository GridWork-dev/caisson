"""Shared test fixtures + fakes (hermetic — no network, no Discord, no Postgres)."""

from __future__ import annotations

import httpx
import pytest

from caisson_support_bot.config import Settings
from caisson_support_bot.contracts import Brief, ScoredChunk


def make_client(handler) -> httpx.AsyncClient:
    """An httpx.AsyncClient wired to a MockTransport callable (request -> httpx.Response)."""
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=5.0)


@pytest.fixture
def settings() -> Settings:
    return Settings(
        discord_token="x-discord",
        openrouter_api_key="x-openrouter",
        docs_service_url="https://docs.test",  # type: ignore[arg-type]
        docs_service_token="x-docs",
        support_human_role_id=4242,
    )


def chunk(source: str, text: str, *, pkg: str | None = None, score: float = 1.0) -> ScoredChunk:
    return ScoredChunk(
        id=source, source=source, title=source, section="", text=text, pkg=pkg, score=score
    )


class FakeRetriever:
    """Retriever double: returns a canned chunk list, or raises if `error` is set."""

    def __init__(
        self, chunks: list[ScoredChunk] | None = None, error: Exception | None = None
    ) -> None:
        self._chunks = chunks or []
        self._error = error
        self.calls: list[tuple[str, int | None]] = []

    async def query(self, question: str, k: int | None = None) -> list[ScoredChunk]:
        self.calls.append((question, k))
        if self._error is not None:
            raise self._error
        return self._chunks


class FakeThreadOpener:
    """ThreadOpener double: records opened threads, returns a fixed id."""

    def __init__(self, thread_id: int | None = 999) -> None:
        self._id = thread_id
        self.opened: list[tuple[str, str]] = []

    async def open_thread(self, *, title: str, body: str) -> int | None:
        self.opened.append((title, body))
        return self._id


def sample_brief() -> Brief:
    return Brief(question="how do credits work?", summary="no match", sources_considered=["a.md"])
