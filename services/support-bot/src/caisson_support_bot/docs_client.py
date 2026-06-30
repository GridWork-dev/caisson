"""Retrieval client for services/docs POST /query (ADR-0096 contract).

The bot is a client only — it never embeds the corpus itself (one corpus, one owner). Every call is
Bearer-authenticated and carries a bounded timeout (the Python analogue of the repo's
``fetchWithTimeout`` invariant — an unbounded outbound call is forbidden). The response is parsed
through the pydantic boundary model, so a malformed payload fails loudly rather than poisoning an
answer.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import httpx

from .contracts import DocsQueryResponse, ScoredChunk


class DocsUnavailableError(RuntimeError):
    """Retrieval could not be completed (network, timeout, or non-2xx from services/docs)."""


@runtime_checkable
class Retriever(Protocol):
    """The retrieval port the pipeline depends on — ``DocsClient`` is the production impl.

    Structural, so the pipeline never couples to HTTP and tests can substitute a fake retriever.
    """

    async def query(self, question: str, k: int | None = None) -> list[ScoredChunk]: ...


class DocsClient:
    """Async client over the docs retrieval contract.

    Pass an ``httpx.AsyncClient`` (production) or one wired to a ``MockTransport`` (tests). The client
    is injected, not constructed here, so the transport is swappable without touching this code.
    """

    def __init__(
        self,
        *,
        query_url: str,
        token: str,
        client: httpx.AsyncClient,
        default_k: int = 6,
    ) -> None:
        self._query_url = query_url
        self._token = token
        self._client = client
        self._default_k = default_k

    async def query(self, question: str, k: int | None = None) -> list[ScoredChunk]:
        """Retrieve the top-k grounded chunks for a question. Raises ``DocsUnavailableError`` on failure."""
        payload = {"query": question, "k": k if k is not None else self._default_k}
        try:
            resp = await self._client.post(
                self._query_url,
                json=payload,
                headers={"Authorization": f"Bearer {self._token}"},
            )
        except httpx.HTTPError as exc:  # timeout, connect error, etc.
            raise DocsUnavailableError(f"docs /query request failed: {exc}") from exc

        if resp.status_code != 200:
            raise DocsUnavailableError(f"docs /query returned {resp.status_code}")

        try:
            parsed = DocsQueryResponse.model_validate(resp.json())
        except (ValueError, httpx.HTTPError) as exc:
            raise DocsUnavailableError(f"docs /query returned an unparseable body: {exc}") from exc
        return parsed.chunks
