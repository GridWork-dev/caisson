"""Entrypoint (ADR-0105): wire the deps and run the gateway + health server.

Fail-closed: ``Settings()`` raises if a required secret is unset, and ``main`` exits non-zero with a
clear message rather than starting half-configured. The httpx client is long-lived (connection
pooling) for the bot's lifetime; the Postgres pool + health server are opened only when configured and
closed on shutdown. This is the live seam — it connects real Discord/OpenRouter/Postgres and is run
manually with operator secrets, not in CI.
"""

from __future__ import annotations

import asyncio
import sys

import asyncpg
import httpx
from pydantic import ValidationError

from .billing_grant import serve_http
from .bot import make_bot
from .config import Settings
from .docs_client import DocsClient
from .escalation import PostgresTicketStore
from .inference import OpenRouterInference
from .rag import RagPipeline
from .telemetry import init_telemetry


async def _run(settings: Settings) -> None:
    init_telemetry()  # env-gated OTLP export; must patch httpx/asyncpg before the clients below.
    timeout = httpx.Timeout(settings.request_timeout_s)
    async with httpx.AsyncClient(timeout=timeout) as http:
        docs = DocsClient(
            query_url=settings.docs_query_url,
            token=settings.docs_service_token,
            client=http,
            default_k=settings.retrieval_k,
        )
        inference = OpenRouterInference(
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
            client=http,
            referer=settings.openrouter_referer,
        )
        pipeline = RagPipeline(docs=docs, inference=inference, k=settings.retrieval_k)

        pool: asyncpg.Pool | None = None
        store: PostgresTicketStore | None = None
        if settings.database_url:
            pool = await asyncpg.create_pool(settings.database_url)
            store = PostgresTicketStore(pool)
            await store.ensure_schema()

        bot = make_bot(settings=settings, pipeline=pipeline, store=store, http_client=http)
        # One inbound app: /health (liveness, always) + /billing-grant (ADR-0203) + /escalate
        # (apps/site Ask-AI parity), each only when its own token is configured — the config-gated
        # never-crash rule. /escalate shares the SAME ticket store + Linear sink the Discord bot's
        # own escalations use (one support_ticket table, one Triage queue, regardless of origin).
        http_runner = await serve_http(
            bot=bot, settings=settings, port=settings.health_port, store=store, http_client=http
        )
        try:
            await bot.start(settings.discord_token)
        finally:
            await http_runner.cleanup()
            if pool is not None:
                await pool.close()


def main() -> None:
    try:
        settings = Settings()  # type: ignore[call-arg]  # values come from the environment.
    except ValidationError as exc:
        sys.stderr.write(
            "[support-bot] refusing to start — missing/invalid configuration:\n"
            f"{exc}\n"
            "Required env: DISCORD_TOKEN, OPENROUTER_API_KEY, DOCS_SERVICE_URL, DOCS_SERVICE_TOKEN.\n"
        )
        raise SystemExit(1) from exc
    asyncio.run(_run(settings))


if __name__ == "__main__":
    main()
