"""Retrieval client for services/docs POST /query (ADR-0096 contract).

The bot is a client only — it never embeds the corpus itself (one corpus, one owner). Every call is
Bearer-authenticated and carries a bounded timeout (the Python analogue of the repo's
``fetchWithTimeout`` invariant — an unbounded outbound call is forbidden). The response is parsed
through the pydantic boundary model, so a malformed payload fails loudly rather than poisoning an
answer.

services/docs rate-limits POST /query per-IP (a cost-DoS guard on its live OpenRouter embedding
spend), and the bot's whole Discord community shares ONE bucket — the bot's own egress IP. A
community-wide burst can 429 a single legitimate question, so ``query`` retries exactly ONCE,
honoring the service's ``Retry-After`` header, before giving up (a second 429 raises same as any
other non-200 — this is backoff, not an infinite-retry loop that could itself pile up on the bucket).
"""

from __future__ import annotations

import asyncio
from typing import Protocol, runtime_checkable

import httpx

from .contracts import DocsQueryResponse, ScoredChunk


class DocsUnavailableError(RuntimeError):
    """Retrieval could not be completed (network, timeout, or non-2xx from services/docs)."""


# Fallback sleep when Retry-After is absent/unparseable, and the ceiling on ANY parsed value — a
# misconfigured or hostile upstream must never make the caller (a Discord interaction) stall for an
# unbounded time. Retry-After can also be expressed as an HTTP-date; that form is treated as absent
# (falls back to the default) rather than parsed, since services/docs only ever emits the seconds form.
_RETRY_DEFAULT_S = 1.0
_RETRY_CAP_S = 5.0


def _retry_after_seconds(value: str | None) -> float:
    """Parse a `Retry-After` header into a bounded sleep duration (seconds)."""
    if value is None:
        return _RETRY_DEFAULT_S
    try:
        seconds = float(value)
    except ValueError:
        return _RETRY_DEFAULT_S
    return max(0.0, min(seconds, _RETRY_CAP_S))


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

    async def _post(self, payload: dict[str, object]) -> httpx.Response:
        try:
            return await self._client.post(
                self._query_url,
                json=payload,
                headers={"Authorization": f"Bearer {self._token}"},
            )
        except httpx.HTTPError as exc:  # timeout, connect error, etc.
            raise DocsUnavailableError(f"docs /query request failed: {exc}") from exc

    async def query(self, question: str, k: int | None = None) -> list[ScoredChunk]:
        """Retrieve the top-k grounded chunks for a question. Raises ``DocsUnavailableError`` on failure.

        A 429 gets exactly one retry, honoring ``Retry-After`` (see the module docstring) — a
        community-wide burst against the shared per-IP bucket should not dead-end a single question.
        """
        payload = {"query": question, "k": k if k is not None else self._default_k}
        resp = await self._post(payload)
        if resp.status_code == 429:
            await asyncio.sleep(_retry_after_seconds(resp.headers.get("Retry-After")))
            resp = await self._post(payload)

        if resp.status_code != 200:
            raise DocsUnavailableError(f"docs /query returned {resp.status_code}")

        try:
            parsed = DocsQueryResponse.model_validate(resp.json())
        except (ValueError, httpx.HTTPError) as exc:
            raise DocsUnavailableError(f"docs /query returned an unparseable body: {exc}") from exc
        return parsed.chunks
