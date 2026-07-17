"""Generation inference (ADR-0105).

A small ``Inference`` port with one concrete production impl — ``OpenRouterInference``, a thin httpx
client over the OpenAI-compatible ``POST /api/v1/chat/completions`` endpoint. One ``OPENROUTER_API_KEY``
covers both this and the docs-service embedder; the model is env-swappable. The port keeps the pipeline
provider-agnostic: an Anthropic-direct impl can be added later (ADR-0105 deferred) without touching
``rag.py``, and ``FakeInference`` drives CI with no live key.
"""

from __future__ import annotations

import sys
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class InferenceError(RuntimeError):
    """Generation failed (network, timeout, non-2xx, or an empty/malformed completion)."""


@dataclass
class GenerationTelemetry:
    """One generation's observability facts — surfaced from the OpenRouter usage object the client
    would otherwise discard, plus the measured latency and HTTP status (CAISSON-120 / audit M4).

    ``analytics.capture_generation`` turns this into a PostHog ``$ai_generation`` event. It carries NO
    prompt or completion TEXT, ever — only counts, cost, latency, model, and the error state.
    """

    model: str
    status: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost: float | None = None
    latency_s: float = 0.0
    error: str | None = None

    @property
    def is_error(self) -> bool:
        return self.error is not None


# A fire-and-forget observer of one generation's telemetry (analytics.capture_generation in prod).
GenerationObserver = Callable[[GenerationTelemetry], Awaitable[None]]


def _as_int(v: object) -> int | None:
    """A plain int (not a bool), else None — usage counts are ints; guard against a stray type."""
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def _as_float(v: object) -> float | None:
    """A finite numeric cost as float (not a bool), else None."""
    return float(v) if isinstance(v, int | float) and not isinstance(v, bool) else None


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
        on_generation: GenerationObserver | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._client = client
        self._referer = referer
        self._title = title
        self._temperature = temperature
        self._max_tokens = max_tokens
        # CAISSON-120: fired once per generate() (success OR failure) with the usage/latency telemetry;
        # None means no $ai_generation capture runs at all. Fail-soft — see _emit.
        self._on_generation = on_generation

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
        start = time.monotonic()
        tel = GenerationTelemetry(model=self._model)
        try:
            try:
                resp = await self._client.post(OPENROUTER_URL, json=body, headers=headers)
            except httpx.HTTPError as exc:
                raise InferenceError(f"openrouter request failed: {exc}") from exc
            tel.status = resp.status_code
            if resp.status_code != 200:
                raise InferenceError(f"openrouter returned {resp.status_code}")
            try:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                raise InferenceError(f"openrouter returned a malformed completion: {exc}") from exc
            if not isinstance(content, str) or not content.strip():
                raise InferenceError("openrouter returned an empty completion")
            # Surface the usage object the client used to discard (CAISSON-120). Defensive: any field
            # may be absent on a partial/malformed response, so each count coerces to None not a crash.
            usage = data.get("usage") if isinstance(data, dict) else None
            if isinstance(usage, dict):
                tel.input_tokens = _as_int(usage.get("prompt_tokens"))
                tel.output_tokens = _as_int(usage.get("completion_tokens"))
                tel.cost = _as_float(usage.get("cost"))
            return content.strip()
        except InferenceError as exc:
            tel.error = str(exc)
            raise
        finally:
            tel.latency_s = time.monotonic() - start
            await self._emit(tel)

    async def _emit(self, tel: GenerationTelemetry) -> None:
        """Fire the telemetry observer, fail-soft: a capture failure must never break generation."""
        if self._on_generation is None:
            return
        try:
            await self._on_generation(tel)
        except Exception as exc:  # telemetry is best-effort; never let it fail the answer path
            sys.stderr.write(f"[inference] generation telemetry failed: {type(exc).__name__}\n")


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
