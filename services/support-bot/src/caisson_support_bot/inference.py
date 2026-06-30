"""Generation inference (ADR-0105).

A small ``Inference`` port with one concrete production impl — ``OpenRouterInference``, a thin httpx
client over the OpenAI-compatible ``POST /api/v1/chat/completions`` endpoint. One ``OPENROUTER_API_KEY``
covers both this and the docs-service embedder; the model is env-swappable. The port keeps the pipeline
provider-agnostic: an Anthropic-direct impl can be added later (ADR-0105 deferred) without touching
``rag.py``, and ``FakeInference`` drives CI with no live key.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class InferenceError(RuntimeError):
    """Generation failed (network, timeout, non-2xx, or an empty/malformed completion)."""


@runtime_checkable
class Inference(Protocol):
    """Generate an assistant message from a system + user prompt. Implementations must be async."""

    async def generate(self, *, system: str, user: str) -> str: ...


class OpenRouterInference:
    """httpx client over OpenRouter chat/completions. The async client is injected (timeout bounded)."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        client: httpx.AsyncClient,
        referer: str = "https://caisson.sh",
        title: str = "Caisson Support Bot",
        temperature: float = 0.1,
        max_tokens: int = 800,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._client = client
        self._referer = referer
        self._title = title
        self._temperature = temperature
        self._max_tokens = max_tokens

    async def generate(self, *, system: str, user: str) -> str:
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "HTTP-Referer": self._referer,  # OpenRouter attribution headers.
            "X-Title": self._title,
        }
        try:
            resp = await self._client.post(OPENROUTER_URL, json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise InferenceError(f"openrouter request failed: {exc}") from exc
        if resp.status_code != 200:
            raise InferenceError(f"openrouter returned {resp.status_code}")
        try:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise InferenceError(f"openrouter returned a malformed completion: {exc}") from exc
        if not isinstance(content, str) or not content.strip():
            raise InferenceError("openrouter returned an empty completion")
        return content.strip()


class FakeInference:
    """Deterministic test double. Returns a canned reply (or echoes the user prompt) — no network.

    This is a WIRING stub, not a model: it lets the pipeline + handlers be exercised hermetically. It
    never reaches OpenRouter. Set ``reply`` to drive a specific branch (e.g. the INSUFFICIENT_CONTEXT
    sentinel) in a test.
    """

    def __init__(self, reply: str | None = None) -> None:
        self.reply = reply
        self.calls: list[tuple[str, str]] = []

    async def generate(self, *, system: str, user: str) -> str:
        self.calls.append((system, user))
        if self.reply is not None:
            return self.reply
        return f"(fake answer) {user[:200]}"
