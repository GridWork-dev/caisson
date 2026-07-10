"""init_telemetry is a dormant no-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset/blank; with an
endpoint set it also wires a sys.{stdout,stderr}.write -> OTLP log-record bridge (ADR-0316 rider c).

Asserts the env-gated contract without a live collector: no real SDK TracerProvider is installed
globally, so no OTLP exporter is constructed and nothing is patched. The active-path tests stub
both the span and log exporters (no live collector, no network) and run the log-record processor
synchronously so an assertion never needs to wait for a batch flush.
"""

from __future__ import annotations

import sys

import pytest
from opentelemetry import trace
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter, SimpleLogRecordProcessor
from opentelemetry.sdk.trace import TracerProvider as SdkTracerProvider
from opentelemetry.sdk.trace.export import SpanExporter

import caisson_support_bot.telemetry as telemetry_module
from caisson_support_bot.telemetry import init_telemetry


def test_dormant_when_endpoint_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    init_telemetry()  # must not raise
    assert not isinstance(trace.get_tracer_provider(), SdkTracerProvider)


def test_dormant_when_endpoint_blank(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "   ")
    init_telemetry()  # whitespace-only is treated as unset
    assert not isinstance(trace.get_tracer_provider(), SdkTracerProvider)


def test_dormant_leaves_streams_unwrapped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    # `sys.stdout.write` is a builtin bound method — each attribute access mints a fresh wrapper
    # object, so `is` always reads False even when nothing was reassigned; `==` compares the
    # underlying (self, func) pair instead, which correctly holds unless init_telemetry rebinds it.
    stdout_write, stderr_write = sys.stdout.write, sys.stderr.write
    init_telemetry()
    assert sys.stdout.write == stdout_write
    assert sys.stderr.write == stderr_write


@pytest.fixture
def _reset_telemetry_state():
    """init_telemetry() mutates process-wide globals (the module `_initialized` flag, the OTel
    global tracer/logger providers, sys.std{out,err}.write) with no public teardown — restore them
    after an active-path test so the dormant-path tests above stay valid for the rest of the suite.
    """
    original_stdout_write, original_stderr_write = sys.stdout.write, sys.stderr.write
    yield
    sys.stdout.write = original_stdout_write
    sys.stderr.write = original_stderr_write
    telemetry_module._initialized = False


def test_endpoint_set_wraps_streams_and_emits_scrubbed_log_record(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    _reset_telemetry_state: None,
) -> None:
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://fake-otel-collector.test:4318")
    # No live collector, no network: a plain SpanExporter is already a no-op stub; the log
    # exporter is swapped for an in-memory one so records are assertable; the batch processor is
    # swapped for a synchronous one so the assertion below never has to wait for a flush.
    monkeypatch.setattr(
        "opentelemetry.exporter.otlp.proto.http.trace_exporter.OTLPSpanExporter", SpanExporter
    )
    log_exporter = InMemoryLogRecordExporter()
    monkeypatch.setattr(
        "opentelemetry.exporter.otlp.proto.http._log_exporter.OTLPLogExporter",
        lambda: log_exporter,
    )
    monkeypatch.setattr(
        "opentelemetry.sdk._logs.export.BatchLogRecordProcessor", SimpleLogRecordProcessor
    )

    init_telemetry()
    assert isinstance(trace.get_tracer_provider(), SdkTracerProvider)
    wrapped_stdout_write, wrapped_stderr_write = sys.stdout.write, sys.stderr.write

    sys.stderr.write("boom\n")
    sys.stdout.write("license webhook accepted Bearer sk_live_abc123\n")

    captured = capsys.readouterr()
    assert "boom" in captured.err  # the real write still reaches the real stream
    assert "Bearer sk_live_abc123" in captured.out  # unscrubbed on the real stream

    records = [r.log_record for r in log_exporter.get_finished_logs()]
    boom = next(r for r in records if r.body == "boom")
    assert boom.severity_text == "WARN"
    webhook = next(r for r in records if "license webhook accepted" in str(r.body))
    assert webhook.body == "license webhook accepted Bearer [REDACTED]"  # scrubbed on the OTel copy
    assert webhook.severity_text == "INFO"

    # idempotence: a second call must not double-wrap the streams.
    init_telemetry()
    assert sys.stdout.write is wrapped_stdout_write
    assert sys.stderr.write is wrapped_stderr_write


def test_export_path_stderr_writes_are_never_reingested(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    _reset_telemetry_state: None,
) -> None:
    """The recursion killer (SHIP-audit): a dead collector makes the OTLP exporter report its
    failure via logging.lastResort -> sys.stderr.write — the bridged write. Without the
    re-entrancy guard that error line becomes a NEW log record, re-exported, re-failed, forever.
    This exporter reproduces the shape synchronously: every export writes to sys.stderr. The
    guard must pass that inner write straight to the real stream and mint NO new record."""
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://fake-otel-collector.test:4318")
    monkeypatch.setattr(
        "opentelemetry.exporter.otlp.proto.http.trace_exporter.OTLPSpanExporter", SpanExporter
    )

    class StderrWritingExporter(InMemoryLogRecordExporter):
        def export(self, batch):  # noqa: ANN001, ANN201 - mirrors the SDK signature
            sys.stderr.write("otlp export failed: connection refused\n")
            return super().export(batch)

    log_exporter = StderrWritingExporter()
    monkeypatch.setattr(
        "opentelemetry.exporter.otlp.proto.http._log_exporter.OTLPLogExporter",
        lambda: log_exporter,
    )
    monkeypatch.setattr(
        "opentelemetry.sdk._logs.export.BatchLogRecordProcessor", SimpleLogRecordProcessor
    )

    init_telemetry()
    capsys.readouterr()  # drop the "[telemetry] OTLP export enabled" line + its export echo

    sys.stderr.write("boom\n")  # would recurse forever without the guard

    captured = capsys.readouterr()
    assert "boom" in captured.err
    assert "otlp export failed" in captured.err  # the exporter's own line reached the REAL stream
    bodies = [r.log_record.body for r in log_exporter.get_finished_logs()]
    assert bodies.count("boom") == 1
    assert not any("otlp export failed" in str(b) for b in bodies)  # never re-ingested


def test_raising_emit_path_never_breaks_the_real_stream(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    _reset_telemetry_state: None,
) -> None:
    """The fail-open half of the bridge contract: the real write runs FIRST and an exception
    anywhere in the emit/export path is swallowed — host log drains never break."""
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://fake-otel-collector.test:4318")
    monkeypatch.setattr(
        "opentelemetry.exporter.otlp.proto.http.trace_exporter.OTLPSpanExporter", SpanExporter
    )

    class RaisingExporter(InMemoryLogRecordExporter):
        def export(self, batch):  # noqa: ANN001, ANN201 - mirrors the SDK signature
            raise RuntimeError("exporter dead")

    monkeypatch.setattr(
        "opentelemetry.exporter.otlp.proto.http._log_exporter.OTLPLogExporter",
        RaisingExporter,
    )
    monkeypatch.setattr(
        "opentelemetry.sdk._logs.export.BatchLogRecordProcessor", SimpleLogRecordProcessor
    )

    init_telemetry()
    capsys.readouterr()

    rc = sys.stderr.write("still alive\n")  # must not raise
    assert isinstance(rc, int)
    assert "still alive" in capsys.readouterr().err
