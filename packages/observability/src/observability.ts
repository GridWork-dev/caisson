// initObservability / shutdownObservability (ADR-0117). The identical env-gated-driver pattern
// every Caisson provider port follows (Resend, the registry Worker, the docs-service embedder):
// no `OTEL_EXPORTER_OTLP_ENDPOINT` (and no `opts.endpoint` override) → start NOTHING, return a
// dormant handle. An endpoint present boots a `NodeSDK` with an OTLP/HTTP trace exporter and
// HTTP + fetch (undici) + pg auto-instrumentation, every span scrubbed before export (`scrub.ts`),
// PLUS an OTLP/HTTP logs pipeline fed by a `process.{stdout,stderr}.write` bridge — the services
// log via bare stream writes (no logger abstraction), so the bridge is what makes those lines
// exist in Loki at all (2026-07-10: the logs pipeline was dead fleet-wide without it).
import { z } from "zod";
import { ConfigError } from "@caisson-sh/kernel";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import type { Logger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import type { LogRecordExporter } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ScrubbingSpanProcessor, scrubLogLine } from "./scrub.ts";

const DEFAULT_SERVICE_NAME = "caisson";
const DEFAULT_TIMEOUT_MS = 10_000;

const OtlpEndpointSchema = z.string().trim().min(1).url();

export interface InitObservabilityOptions {
  /** Override the OTLP/HTTP endpoint; defaults to `OTEL_EXPORTER_OTLP_ENDPOINT`. Both unset = dormant. */
  endpoint?: string;
  /** Resource `service.name`; defaults to `OTEL_SERVICE_NAME`, falling back to `"caisson"`. */
  serviceName?: string;
  /** Extra OTLP export headers (e.g. a Grafana Cloud ingestion token). Never logged. */
  headers?: Record<string, string>;
  /** Per-export timeout (ms). Default 10s. */
  timeoutMs?: number;
  /** Injectable span exporter — tests stub this so the suite never makes a live OTLP call. */
  exporter?: SpanExporter;
  /** Injectable log-record exporter — same test seam as `exporter`, for the logs pipeline. */
  logExporter?: LogRecordExporter;
  /** Injectable instrumentation list — defaults to HTTP + fetch (undici) + pg. */
  instrumentations?: Instrumentation[];
}

export interface ObservabilityHandle {
  /** `false` when no endpoint was configured — the dormant, env-gated no-op state. */
  readonly active: boolean;
}

const DORMANT: ObservabilityHandle = { active: false };

let activeSdk: NodeSDK | null = null;

/** Resolve + validate the OTLP endpoint. Returns `undefined` when unset (the dormant path). */
function resolveEndpoint(opts: InitObservabilityOptions): string | undefined {
  const raw = opts.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (raw === undefined || raw.trim().length === 0) return undefined;
  const parsed = OtlpEndpointSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(
      `initObservability: OTLP endpoint is not a valid URL: ${raw}`,
    );
  }
  return parsed.data;
}

function tracesUrl(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, "")}/v1/traces`;
}

function logsUrl(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, "")}/v1/logs`;
}

type WriteFn = typeof process.stdout.write;

let originalWrites: { stdout: WriteFn; stderr: WriteFn } | null = null;

/**
 * Wrap a `process.{stdout,stderr}.write` so every line ALSO becomes an OTLP log record —
 * the one bridge that puts the whole codebase's existing `stderr.write` logging into the
 * logs pipeline with zero call-site changes. The original write always runs (host log
 * drains keep working); the emit goes into a batch processor, so no I/O happens inline.
 * Export failures are silent by design (OTel's default diag/error handler is a no-op),
 * which is also what makes this loop-safe.
 */
function makeBridgedWrite(
  original: WriteFn,
  target: NodeJS.WriteStream,
  severityNumber: SeverityNumber,
  severityText: string,
  logger: Logger,
): WriteFn {
  // Node/Bun's real `write` accepts a callback in the encoding slot at runtime; typing the
  // original through this single non-overloaded signature (instead of the overloaded WriteFn)
  // is what lets one re-dispatch cover both call shapes.
  const raw = original as (
    this: NodeJS.WriteStream,
    chunk: Uint8Array | string,
    encoding?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ) => boolean;
  const bridged = (
    chunk: Uint8Array | string,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean => {
    const text =
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    const body = scrubLogLine(text).trimEnd();
    if (body.length > 0) {
      logger.emit({ body, severityNumber, severityText });
    }
    return raw.call(target, chunk, encodingOrCb, cb);
  };
  return bridged as WriteFn;
}

function installStreamBridge(): void {
  if (originalWrites !== null) return;
  originalWrites = {
    stdout: process.stdout.write,
    stderr: process.stderr.write,
  };
  const logger = logs.getLogger("caisson-stream-bridge");
  // ponytail: stream-level severity only (stdout=INFO, stderr=WARN) — services write info
  // lines to stderr, so content-sniffing a severity would lie; Loki queries match on text.
  process.stdout.write = makeBridgedWrite(
    originalWrites.stdout,
    process.stdout,
    SeverityNumber.INFO,
    "INFO",
    logger,
  );
  process.stderr.write = makeBridgedWrite(
    originalWrites.stderr,
    process.stderr,
    SeverityNumber.WARN,
    "WARN",
    logger,
  );
}

function uninstallStreamBridge(): void {
  if (originalWrites === null) return;
  process.stdout.write = originalWrites.stdout;
  process.stderr.write = originalWrites.stderr;
  originalWrites = null;
}

function defaultInstrumentations(): Instrumentation[] {
  return [
    new HttpInstrumentation(),
    new UndiciInstrumentation(),
    new PgInstrumentation(),
  ];
}

/**
 * Boot the OTel SDK. No-ops — returns `{ active: false }`, starts nothing, no global module
 * patching — when neither `opts.endpoint` nor `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Idempotent:
 * a second call while already active returns the existing active handle rather than double-booting.
 */
export function initObservability(
  opts: InitObservabilityOptions = {},
): ObservabilityHandle {
  const endpoint = resolveEndpoint(opts);
  if (endpoint === undefined) return DORMANT;
  if (activeSdk !== null) return { active: true };

  const exporter =
    opts.exporter ??
    new OTLPTraceExporter({
      url: tracesUrl(endpoint),
      timeoutMillis: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      // exactOptionalPropertyTypes: only include the key when a value is actually present.
      ...(opts.headers !== undefined ? { headers: opts.headers } : {}),
    });
  const spanProcessor = new ScrubbingSpanProcessor(
    new BatchSpanProcessor(exporter),
  );
  const logExporter =
    opts.logExporter ??
    new OTLPLogExporter({
      url: logsUrl(endpoint),
      timeoutMillis: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(opts.headers !== undefined ? { headers: opts.headers } : {}),
    });
  const serviceName =
    opts.serviceName ?? process.env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [spanProcessor],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: logExporter }),
    ],
    instrumentations: opts.instrumentations ?? defaultInstrumentations(),
  });
  sdk.start();
  activeSdk = sdk;
  installStreamBridge();
  process.stderr.write(
    `[observability] OTel SDK started (service=${serviceName})\n`,
  );
  return { active: true };
}

/** Flush + tear down the active SDK. A no-op (resolves immediately) when dormant. */
export async function shutdownObservability(): Promise<void> {
  if (activeSdk === null) return;
  const sdk = activeSdk;
  activeSdk = null;
  // Restore the raw writes BEFORE the flush so shutdown-path output never re-enters the bridge.
  uninstallStreamBridge();
  await sdk.shutdown();
  // NodeSDK.shutdown() flushes but never unregisters the global logger provider, which would
  // leave the global pointing at a dead provider and silently drop a later init's records.
  logs.disable();
}
