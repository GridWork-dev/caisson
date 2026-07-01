import { afterEach, describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson/kernel";
import { ExportResultCode } from "@opentelemetry/core";
import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { initObservability, shutdownObservability } from "./observability.ts";

/** A `SpanExporter` double — never opens a socket, so the suite never makes a live OTLP call. */
function createStubExporter(): SpanExporter & {
  shutdownCalls: number;
} {
  return {
    shutdownCalls: 0,
    export(
      _spans: ReadableSpan[],
      resultCallback: (result: ExportResult) => void,
    ): void {
      resultCallback({ code: ExportResultCode.SUCCESS });
    },
    shutdown(): Promise<void> {
      this.shutdownCalls += 1;
      return Promise.resolve();
    },
  };
}

describe("initObservability / shutdownObservability", () => {
  afterEach(async () => {
    // Tear down any SDK an "active" test left running so module-singleton state never bleeds
    // across tests in this file.
    await shutdownObservability();
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  test("no endpoint configured (opts nor env) → dormant handle, starts nothing", () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const handle = initObservability();
    expect(handle.active).toBe(false);
  });

  test("an empty-string endpoint is treated as unset → dormant", () => {
    const handle = initObservability({ endpoint: "   " });
    expect(handle.active).toBe(false);
  });

  test("OTEL_EXPORTER_OTLP_ENDPOINT set in env (no opts override) boots the SDK", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector.test:4318";
    const exporter = createStubExporter();
    const handle = initObservability({ exporter, instrumentations: [] });
    expect(handle.active).toBe(true);
    await shutdownObservability();
    expect(exporter.shutdownCalls).toBe(1);
  });

  test("a fake endpoint via opts constructs the SDK with a stubbed exporter", () => {
    const exporter = createStubExporter();
    const handle = initObservability({
      endpoint: "http://fake-otel-collector.test:4318",
      serviceName: "observability-test",
      exporter,
      instrumentations: [],
    });
    expect(handle.active).toBe(true);
  });

  test("a second init call while active is idempotent (no double-boot)", () => {
    const exporter = createStubExporter();
    const first = initObservability({
      endpoint: "http://fake-otel-collector.test:4318",
      exporter,
      instrumentations: [],
    });
    const second = initObservability({
      endpoint: "http://fake-otel-collector.test:4318",
      exporter,
      instrumentations: [],
    });
    expect(first.active).toBe(true);
    expect(second.active).toBe(true);
  });

  test("shutdownObservability is a no-op when dormant", async () => {
    await expect(shutdownObservability()).resolves.toBeUndefined();
  });

  test("shutdownObservability flushes the active exporter exactly once", async () => {
    const exporter = createStubExporter();
    initObservability({
      endpoint: "http://fake-otel-collector.test:4318",
      exporter,
      instrumentations: [],
    });
    await shutdownObservability();
    expect(exporter.shutdownCalls).toBe(1);
    // A second shutdown call after the SDK already tore down stays a no-op.
    await shutdownObservability();
    expect(exporter.shutdownCalls).toBe(1);
  });

  test("a malformed endpoint override throws a typed ConfigError", () => {
    expect(() =>
      initObservability({ endpoint: "not-a-url", instrumentations: [] }),
    ).toThrow(ConfigError);
  });

  test("the real (non-stubbed) HTTP+fetch+pg instrumentation set boots cleanly under Bun", async () => {
    const exporter = createStubExporter();
    const handle = initObservability({
      endpoint: "http://fake-otel-collector.test:4318",
      exporter,
    });
    expect(handle.active).toBe(true);
    await shutdownObservability();
  });
});
