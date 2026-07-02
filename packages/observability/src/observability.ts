// initObservability / shutdownObservability (ADR-0117). The identical env-gated-driver pattern
// every Caisson provider port follows (Resend, the registry Worker, the docs-service embedder):
// no `OTEL_EXPORTER_OTLP_ENDPOINT` (and no `opts.endpoint` override) → start NOTHING, return a
// dormant handle. An endpoint present boots a `NodeSDK` with an OTLP/HTTP trace exporter and
// HTTP + fetch (undici) + pg auto-instrumentation, every span scrubbed before export (`scrub.ts`).
import { z } from "zod";
import { ConfigError } from "@caisson/kernel";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ScrubbingSpanProcessor } from "./scrub.ts";

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
  const serviceName =
    opts.serviceName ?? process.env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [spanProcessor],
    instrumentations: opts.instrumentations ?? defaultInstrumentations(),
  });
  sdk.start();
  activeSdk = sdk;
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
  await sdk.shutdown();
}
