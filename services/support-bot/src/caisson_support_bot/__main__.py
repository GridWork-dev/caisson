"""Entrypoint: wire the Discord worker and own its complete disposable lifecycle.

``Settings`` fails closed before remote clients are created. SIGTERM closes the privileged-work
gate before Discord and bounds every cleanup stage, so a supervisor can replace the process without
overlapping role mutations or waiting indefinitely on a remote service.
"""

from __future__ import annotations

import asyncio
import signal
import sys
from collections.abc import Awaitable

import asyncpg
import httpx
from aiohttp import web
from pydantic import ValidationError

from .analytics import AnswerAnalytics
from .billing_grant import serve_http
from .bot import make_bot
from .config import Settings
from .docs_client import DocsClient
from .escalation import PostgresTicketStore
from .heartbeat import run_heartbeat
from .inference import OpenRouterInference
from .lifecycle import PrivilegedWorkGate, run_gateway
from .rag import RagPipeline
from .telemetry import init_telemetry


async def _create_database_pool(database_url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        database_url,
        min_size=0,
        max_size=2,
        max_inactive_connection_lifetime=20.0,
        timeout=4.0,
        command_timeout=25.0,
        server_settings={
            "statement_timeout": "25000",
            "idle_in_transaction_session_timeout": "25000",
        },
    )


def _install_shutdown_handlers(shutdown: asyncio.Event) -> tuple[signal.Signals, ...]:
    """Route SIGTERM/SIGINT into the async lifecycle (the Linux container path)."""
    loop = asyncio.get_running_loop()
    installed: list[signal.Signals] = []
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, shutdown.set)
            installed.append(sig)
        except NotImplementedError:  # pragma: no cover - Windows, not the production container.
            continue
    return tuple(installed)


async def _bounded_cleanup(label: str, operation: Awaitable[object], timeout_s: float) -> None:
    """Never let a remote client hold the disposable process beyond its cleanup deadline."""
    try:
        await asyncio.wait_for(operation, timeout=timeout_s)
    except TimeoutError:
        sys.stderr.write(f"[support-bot] {label} cleanup timed out\n")
    except Exception as exc:  # noqa: BLE001 - independent cleanup stages must continue.
        # Exception class only: remote SDK messages can include request metadata.
        sys.stderr.write(f"[support-bot] {label} cleanup failed ({type(exc).__name__})\n")


async def _run(settings: Settings) -> None:
    shutdown = asyncio.Event()
    installed_signals = _install_shutdown_handlers(shutdown)
    init_telemetry()  # env-gated OTLP export; patch httpx/asyncpg before constructing clients.
    try:
        timeout = httpx.Timeout(settings.request_timeout_s)
        async with httpx.AsyncClient(timeout=timeout) as http:
            pool: asyncpg.Pool | None = None
            http_runner: web.AppRunner | None = None
            heartbeat_task: asyncio.Task[None] | None = None
            try:
                docs = DocsClient(
                    query_url=settings.docs_query_url,
                    token=settings.docs_service_token,
                    client=http,
                    default_k=settings.retrieval_k,
                )
                # Constructed first so capture_generation can observe the inference client.
                analytics = (
                    AnswerAnalytics(
                        key=settings.posthog_capture_key,
                        host=settings.posthog_capture_host,
                        client=http,
                    )
                    if settings.posthog_capture_key
                    else None
                )
                inference = OpenRouterInference(
                    api_key=settings.openrouter_api_key,
                    model=settings.openrouter_model,
                    client=http,
                    referer=settings.openrouter_referer,
                    on_generation=(analytics.capture_generation if analytics is not None else None),
                )
                pipeline = RagPipeline(
                    docs=docs,
                    inference=inference,
                    k=settings.retrieval_k,
                    confidence_high=settings.support_confidence_high,
                    confidence_low=settings.support_confidence_low,
                )

                store: PostgresTicketStore | None = None
                if settings.database_url:
                    pool = await _create_database_pool(settings.database_url)
                    store = PostgresTicketStore(pool)
                    await store.ensure_schema()

                bot = make_bot(
                    settings=settings,
                    pipeline=pipeline,
                    store=store,
                    http_client=http,
                    analytics=analytics,
                )
                work_gate = PrivilegedWorkGate()
                http_runner = await serve_http(
                    bot=bot,
                    settings=settings,
                    port=settings.health_port,
                    store=store,
                    http_client=http,
                    work_gate=work_gate,
                )

                if settings.heartbeat_enabled:
                    project_id = settings.google_cloud_project
                    if project_id is None:  # Settings narrows this; guard survives optimized mode.
                        raise RuntimeError(
                            "heartbeat project missing after configuration validation"
                        )
                    heartbeat_task = asyncio.create_task(
                        run_heartbeat(
                            project_id=project_id,
                            interval_s=settings.heartbeat_interval_s,
                            stop=shutdown,
                            is_gateway_ready=bot.is_ready,
                        ),
                        name="gcp-heartbeat",
                    )

                await run_gateway(
                    bot=bot,
                    token=settings.discord_token,
                    shutdown=shutdown,
                    work_gate=work_gate,
                    shutdown_grace_s=settings.shutdown_grace_s,
                )
            finally:
                shutdown.set()
                if heartbeat_task is not None:
                    await _bounded_cleanup("heartbeat", heartbeat_task, settings.shutdown_grace_s)
                if http_runner is not None:
                    await _bounded_cleanup(
                        "HTTP server", http_runner.cleanup(), settings.shutdown_grace_s
                    )
                if pool is not None:
                    await _bounded_cleanup("database pool", pool.close(), settings.shutdown_grace_s)
    finally:
        loop = asyncio.get_running_loop()
        for sig in installed_signals:
            loop.remove_signal_handler(sig)


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
