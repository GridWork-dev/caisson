"""init_telemetry is a dormant no-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset/blank.

Asserts the env-gated contract without a live collector: no real SDK TracerProvider is installed
globally, so no OTLP exporter is constructed and nothing is patched. The active path is the
operator-gated deploy seam (a real endpoint + a live OTLP sink, Grafana Cloud) and is not exercised here.
"""

from __future__ import annotations

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider as SdkTracerProvider

from caisson_support_bot.telemetry import init_telemetry


def test_dormant_when_endpoint_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    init_telemetry()  # must not raise
    assert not isinstance(trace.get_tracer_provider(), SdkTracerProvider)


def test_dormant_when_endpoint_blank(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "   ")
    init_telemetry()  # whitespace-only is treated as unset
    assert not isinstance(trace.get_tracer_provider(), SdkTracerProvider)
