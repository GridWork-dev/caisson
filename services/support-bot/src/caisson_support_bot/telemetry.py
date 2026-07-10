"""OTLP telemetry init (ADR-0117/0142/0316-rider-c): env-gated OpenTelemetry export to the fleet
OTLP sink (Grafana Cloud since ADR-0177).

Mirrors the Node observability port's env-gated-driver contract
(packages/observability/src/observability.ts): no ``OTEL_EXPORTER_OTLP_ENDPOINT`` (or an empty one)
→ start NOTHING and return — a dormant no-op that configures no provider, no exporter, no
instrumentation. An endpoint present boots a ``TracerProvider`` with an OTLP/HTTP
``BatchSpanProcessor`` and patches httpx + asyncpg so the bot's outbound calls (docs-service,
OpenRouter, Postgres) become spans, PLUS an OTLP/HTTP logs pipeline fed by a
``sys.{stdout,stderr}.write`` bridge — the bot logs via raw ``sys.stderr.write(...)`` calls (no
logger abstraction), so the bridge is what makes those lines reach Loki at all, same as the Node
fleet's ``installStreamBridge``/``makeBridgedWrite``. Secrets (OTLP headers, e.g. a Grafana Cloud
ingestion token) are read straight from the environment by the exporters and never logged.
"""

from __future__ import annotations

import os
import re
import sys
from collections.abc import Callable

_SERVICE_NAME = "service-support-bot"

_initialized = False

# Value-level backstop for a raw `Authorization: Bearer <token>`-shaped substring under an
# unsuspicious log line — the export-boundary scrub for the stream bridge below, ported from
# BEARER_INLINE in packages/observability/src/scrub.ts (scrubLogLine). Pure stdlib `re`, so this
# stays loaded even on the dormant path; the OTel SDK imports below stay deferred.
_BEARER_INLINE = re.compile(r"bearer\s+\S+", re.IGNORECASE)


def _scrub_log_line(line: str) -> str:
    """Redact a raw bearer-token value before a line leaves the process as an OTLP log record.

    Only the OTel copy is scrubbed — the real stream write always gets the original, unscrubbed
    chunk, so host log drains keep working (same split as the TS ``scrubLogLine`` call site).
    """
    return _BEARER_INLINE.sub("Bearer [REDACTED]", line)


def init_telemetry() -> None:
    """Boot OTLP export when ``OTEL_EXPORTER_OTLP_ENDPOINT`` is set; a dormant no-op otherwise.

    Idempotent: a second call after a successful init returns immediately — the guard below also
    covers the stream bridge, so streams are never double-wrapped. Must run BEFORE the httpx/
    asyncpg clients are constructed — the instrumentors monkeypatch those libraries and only catch
    clients created after ``instrument()`` is called.
    """
    global _initialized
    if _initialized:
        return
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        return  # dormant: no collector configured — install nothing, patch nothing.

    # Deferred imports keep the dormant path from touching the OTel SDK at all.
    from opentelemetry import trace
    from opentelemetry._logs import SeverityNumber, set_logger_provider
    from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.sdk._logs import LoggerProvider
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    service_name = os.environ.get("OTEL_SERVICE_NAME", _SERVICE_NAME)
    resource = Resource.create({"service.name": service_name})

    provider = TracerProvider(resource=resource)
    # OTLPSpanExporter/OTLPLogExporter read OTEL_EXPORTER_OTLP_ENDPOINT (+ _HEADERS) from the env
    # themselves and append /v1/traces + /v1/logs — no endpoint/header plumbing here, so nothing
    # secret is constructed or logged.
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
    set_logger_provider(logger_provider)
    logger = logger_provider.get_logger("caisson-support-bot-stream-bridge")

    def make_bridged_write(
        original: Callable[[str], int], severity_number: SeverityNumber, severity_text: str
    ) -> Callable[[str], int]:
        """Wrap one `sys.{stdout,stderr}.write` so every line ALSO becomes an OTLP log record.
        The real write always runs — host log drains keep working; only the OTel copy is scrubbed.
        """

        def write(text: str) -> int:
            body = _scrub_log_line(text).rstrip()
            if body:
                logger.emit(body=body, severity_number=severity_number, severity_text=severity_text)
            return original(text)

        return write

    # stream-level severity only (stdout=INFO, stderr=WARN) — same call as the TS bridge; a
    # service writing an info line to stderr shows as WARN, content-sniffing would lie instead.
    sys.stdout.write = make_bridged_write(sys.stdout.write, SeverityNumber.INFO, "INFO")
    sys.stderr.write = make_bridged_write(sys.stderr.write, SeverityNumber.WARN, "WARN")

    HTTPXClientInstrumentor().instrument()
    AsyncPGInstrumentor().instrument()
    _initialized = True
    sys.stderr.write(f"[telemetry] OTLP export enabled (service={service_name})\n")
