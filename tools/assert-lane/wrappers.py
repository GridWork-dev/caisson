"""ASSERT callable targets (`target.callable`, docs/targets/callable.md) for the LIVE, operator-run
pre-release behavioral lane (see `README.md` — this is NOT the CI eval gate).

Two targets, each a plain black-box `chat(message, history=None) -> str` (sync or async — ASSERT
supports both; docs-RAG is sync since it is one stateless HTTP call, support-bot is async since it
awaits the real pipeline):

- `chat_docs_rag`    — services/docs POST /query (retrieval only, no generation).
- `chat_support_bot` — the live support-bot RagPipeline.answer (retrieval + grounded generation).

Both read live secrets from the environment only (never hardcoded) and raise loudly if unset —
this is a hand-run tool, so a clear `RuntimeError` beats a confusing downstream failure.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

# --- env var names (the repo's REAL names — see services/docs/README.md + services/support-bot/README.md) ---
_DOCS_URL_ENV = "DOCS_SERVICE_URL"
_DOCS_TOKEN_ENV = "DOCS_SERVICE_TOKEN"
# Same fallback order services/support-bot/tests/live/test_retrieval_battery_live.py uses — one
# OpenRouter credential covers both the ASSERT judge/generator stages (see the eval_config.yaml
# files) and the support-bot's own generation call.
_OPENROUTER_KEY_ENV = ("CAISSON_SUPPORT_BOT__OPENROUTER_API_KEY", "OPENROUTER_API_KEY")
_DEFAULT_MODEL = "anthropic/claude-sonnet-4.6"  # services/support-bot config.py's own default
_DEFAULT_K = 6
_DEFAULT_TIMEOUT_S = 20.0


def _require_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"{name} is not set — see tools/assert-lane/README.md for the env list")
    return value


def _first_env(names: tuple[str, ...]) -> str:
    for name in names:
        value = os.environ.get(name, "")
        if value:
            return value
    raise RuntimeError(f"none of {names} are set — see tools/assert-lane/README.md for the env list")


def _docs_query_url() -> str:
    return _require_env(_DOCS_URL_ENV).rstrip("/") + "/query"


# --- docs-RAG target ---------------------------------------------------------------------------


def chat_docs_rag(message: str, history: list[dict[str, str]] | None = None) -> str:
    """Query services/docs POST /query and render the hits as a numbered, cited pseudo-answer.

    `history` is accepted (ASSERT's multi-turn signature) but ignored — `/query` is stateless,
    single-turn retrieval, so a repeated question is just the same call again. The rendering mirrors
    `services/support-bot/src/caisson_support_bot/rag.py`'s `_build_context` shape (`[source] text`)
    so the judge is scoring the same citation contract the real pipeline builds on top of it.
    """
    token = _require_env(_DOCS_TOKEN_ENV)
    resp = httpx.post(
        _docs_query_url(),
        json={"query": message, "k": _DEFAULT_K},
        headers={"Authorization": f"Bearer {token}"},
        timeout=_DEFAULT_TIMEOUT_S,
    )
    resp.raise_for_status()
    chunks = resp.json().get("chunks", [])
    if not chunks:
        return "NO_RESULTS"
    return "\n\n".join(f"[{c['source']}] {c['text']}" for c in chunks)


# --- support-bot target -------------------------------------------------------------------------

# The bot's own answer path (`RagPipeline.answer`) is a pure Python class — no Discord coupling — so
# it is importable directly, the same seam `services/support-bot/tests/live/test_retrieval_battery_live.py`
# already drives. Path-insert rather than a package dependency: this tool intentionally stays outside
# the uv workspace the task scoped it to (tools/assert-lane/ only), so there is nothing to `uv add`.
_SUPPORT_BOT_SRC = Path(__file__).resolve().parents[2] / "services" / "support-bot" / "src"
if str(_SUPPORT_BOT_SRC) not in sys.path:
    sys.path.insert(0, str(_SUPPORT_BOT_SRC))


async def chat_support_bot(message: str, history: list[dict[str, str]] | None = None) -> str:
    """Drive the live `RagPipeline` (retrieval + grounded generation + confidence gate, ADR-0009).

    `history` is ignored: the pipeline itself is single-turn (one question in, one grounded answer
    or escalation out) — there is no multi-turn state to fold in. An escalation is reported back as
    a plain `[ESCALATED] <reason>` string rather than raised, so "refused instead of hallucinating"
    still produces text the judge can grade as a pass, not a pipeline error.
    """
    # Imported here (not at module top) so a syntax/py_compile check of this file never requires the
    # support-bot's own dependencies (httpx aside) to be installed in THIS tool's uv env.
    from caisson_support_bot.docs_client import DocsClient
    from caisson_support_bot.inference import OpenRouterInference
    from caisson_support_bot.rag import RagPipeline

    docs_token = _require_env(_DOCS_TOKEN_ENV)
    openrouter_key = _first_env(_OPENROUTER_KEY_ENV)
    model = os.environ.get("OPENROUTER_MODEL", _DEFAULT_MODEL)

    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT_S) as client:
        pipeline = RagPipeline(
            docs=DocsClient(
                query_url=_docs_query_url(),
                token=docs_token,
                client=client,
                default_k=_DEFAULT_K,
            ),
            inference=OpenRouterInference(api_key=openrouter_key, model=model, client=client),
            k=_DEFAULT_K,
        )
        result = await pipeline.answer(message)

    if result.resolved:
        return result.answer
    reason = result.brief.summary if result.brief is not None else "unresolved (no brief)"
    return f"[ESCALATED] {reason}"
