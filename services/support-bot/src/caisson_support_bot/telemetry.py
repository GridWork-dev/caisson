"""OTLP telemetry init (ADR-0117/0142): env-gated OpenTelemetry export to the fleet OTLP sink (Grafana Cloud since ADR-0177).

Mirrors the Node observability port's env-gated-driver contract
(packages/observability/src/observability.ts): no ``OTEL_EXPORTER_OTLP_ENDPOINT`` (or an empty one)
→ start NOTHING and return — a dormant no-op that configures no provider, no exporter, no
instrumentation. An endpoint present boots a ``TracerProvider`` with an OTLP/HTTP
``BatchSpanProcessor`` and patches httpx + asyncpg so the bot's outbound calls (docs-service,
OpenRouter, Postgres) become spans. Secrets (OTLP headers, e.g. a Grafana Cloud ingestion token) are read
straight from the environment by the exporter and never logged.
"""

from __future__ import annotations

import os
import sys

_SERVICE_NAME = "service-support-bot"

_initialized = False


def init_telemetry() -> None:
    """Boot OTLP export when ``OTEL_EXPORTER_OTLP_ENDPOINT`` is set; a dormant no-op otherwise.

    Idempotent: a second call after a successful init returns immediately. Must run BEFORE the
    httpx/asyncpg clients are constructed — the instrumentors monkeypatch those libraries and only
    catch clients created after ``instrument()`` is called.
    """
    global _initialized
    if _initialized:
        return
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        return  # dormant: no collector configured — install nothing, patch nothing.

    # Deferred imports keep the dormant path from touching the OTel SDK at all.
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    service_name = os.environ.get("OTEL_SERVICE_NAME", _SERVICE_NAME)
    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    # OTLPSpanExporter reads OTEL_EXPORTER_OTLP_ENDPOINT (+ _HEADERS) from the env itself and appends
    # /v1/traces — no endpoint/header plumbing here, so nothing secret is constructed or logged.
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)

    HTTPXClientInstrumentor().instrument()
    AsyncPGInstrumentor().instrument()
    _initialized = True
    sys.stderr.write(f"[telemetry] OTLP export enabled (service={service_name})\n")
