// The base operational-telemetry EventSink port (ADR-0075). The ONE contract every edition emits
// structured ops events through — spend, latency, eval scores, guardrail blocks, generation events.
// The port is swappable: the default transport is OTel → Postgres (the ADR-0014 Neon spine), but a
// caller repoints the backend without touching any emit site.
//
// Two invariants are load-bearing and asserted in the tests:
//   1. Redaction is applied ONCE, here at the sink, reusing the ADR-0019 discipline — no SQL, no
//      stack trace, and no secret ever lands in an emitted event. It is not re-litigated per edition.
//   2. The ADR-0052 WORM audit-chain is NEVER routed through this sink. Compliance evidence has a
//      different trust + retention model than mutable, drop-able ops logs; the two never share a
//      write path. This module MUST NOT import or reference `audit-chain` (a test enforces it).
import { z } from "zod";
import { fetchWithTimeout } from "./fetch.ts";
import { InternalError } from "./errors.ts";
import { strictObject } from "./schema.ts";

/** A single structured operational event. `attributes` is OTel-style free-form key/value telemetry. */
export interface OpsEvent {
  /** Event name (OTel log-record body), e.g. `gen.completed`, `guardrail.blocked`. */
  readonly name: string;
  /** ISO-8601 emit timestamp. */
  readonly timestamp: string;
  /** Owning tenant, when the event is tenant-scoped. */
  readonly tenantId?: string;
  /** Free-form telemetry attributes. Redacted at the sink before it ever leaves the process. */
  readonly attributes: Readonly<Record<string, unknown>>;
}

/** Boundary schema for an externally-supplied event (`.strict()` — unknown envelope keys rejected). */
export const opsEventSchema = strictObject({
  name: z.string().min(1).max(200),
  timestamp: z.string().datetime(),
  tenantId: z.string().min(1).max(200).optional(),
  attributes: z.record(z.string(), z.unknown()),
});

/** The sink port. Editions emit INTO it; a transport (in-memory, noop, OTel→Postgres) backs it. */
export interface EventSink {
  emit(event: OpsEvent): void | Promise<void>;
}

// --- ADR-0019 redaction, applied once at the sink ---------------------------------------------

/** Keys whose value is a credential — the whole value is dropped regardless of type. */
const SENSITIVE_KEY =
  /(?:secret|token|password|passwd|api[_-]?key|apikey|authorization|bearer|credential|private[_-]?key|access[_-]?key|session)/i;
/** A SQL statement (a leaked query string) — never belongs in an ops event. */
const SQL_STATEMENT =
  /\b(?:select|insert|update|delete|drop|alter|create|truncate|grant|revoke)\b[\s\S]*\b(?:from|into|table|where|values|set|join)\b/i;
/** A stack-trace frame (`\n    at fn (file:line:col)`). */
const STACK_FRAME = /\n\s*at\s+\S/;

function redactValue(value: unknown, key?: string): unknown {
  if (key !== undefined && SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    if (STACK_FRAME.test(value)) return "[REDACTED:STACK]";
    if (SQL_STATEMENT.test(value)) return "[REDACTED:SQL]";
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v, k);
    }
    return out;
  }
  return value;
}

/**
 * Return a redacted copy of an event: every attribute (recursively) has secrets, SQL statements, and
 * stack traces stripped. Applied exactly once, by the sink, before an event is stored or exported.
 */
export function redactEvent(event: OpsEvent): OpsEvent {
  const attributes = redactValue(event.attributes) as Record<string, unknown>;
  const base: OpsEvent = {
    name: event.name,
    timestamp: event.timestamp,
    attributes,
  };
  return event.tenantId === undefined
    ? base
    : { ...base, tenantId: event.tenantId };
}

// --- Built-in transports ----------------------------------------------------------------------

/** In-memory sink for tests + local development. Captures redacted events for assertion. */
export class InMemoryEventSink implements EventSink {
  readonly #events: OpsEvent[] = [];
  emit(event: OpsEvent): void {
    this.#events.push(redactEvent(event));
  }
  get events(): readonly OpsEvent[] {
    return this.#events;
  }
  clear(): void {
    this.#events.length = 0;
  }
}

/** Drops every event. The fail-open default when no transport is configured. */
export class NoopEventSink implements EventSink {
  emit(_event: OpsEvent): void {
    /* intentionally drops */
  }
}

/**
 * The export seam: `(url, init, timeoutMs) => Response`. Defaults to `fetchWithTimeout`; tests inject
 * a double so CI never makes a live network call (ADR-0075 — OTel export is a test-doubled seam).
 */
export type OtlpSend = (
  url: string,
  init: RequestInit,
  timeoutMs: number,
) => Promise<Response>;

const defaultSend: OtlpSend = (url, init, timeoutMs) =>
  fetchWithTimeout(url, init, { timeoutMs });

export interface OtelPostgresSinkOptions {
  /** OTLP/HTTP logs endpoint of the collector that lands events in Postgres. */
  readonly endpoint: string;
  /** Per-export timeout (default 10s). */
  readonly timeoutMs?: number;
  /** Injectable transport — defaults to `fetchWithTimeout`; test-doubled in CI. */
  readonly send?: OtlpSend;
}

/** OTel → Postgres transport behind the port. Redacts, then exports one OTLP log record per event. */
export class OtelPostgresEventSink implements EventSink {
  readonly #endpoint: string;
  readonly #timeoutMs: number;
  readonly #send: OtlpSend;

  constructor(opts: OtelPostgresSinkOptions) {
    this.#endpoint = opts.endpoint;
    this.#timeoutMs = opts.timeoutMs ?? 10_000;
    this.#send = opts.send ?? defaultSend;
  }

  async emit(event: OpsEvent): Promise<void> {
    const redacted = redactEvent(event);
    const res = await this.#send(
      this.#endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toOtlpLogPayload(redacted)),
      },
      this.#timeoutMs,
    );
    if (!res.ok) {
      throw new InternalError(`event-sink: OTLP export failed (${res.status})`);
    }
  }
}

function toOtlpAttributes(
  attrs: Readonly<Record<string, unknown>>,
): Array<{ key: string; value: { stringValue: string } }> {
  return Object.entries(attrs).map(([key, value]) => ({
    key,
    value: {
      stringValue: typeof value === "string" ? value : JSON.stringify(value),
    },
  }));
}

/** Build a minimal OTLP/HTTP logs payload (OTel GenAI semconv wire shape) for one redacted event. */
function toOtlpLogPayload(event: OpsEvent): Record<string, unknown> {
  const resourceAttributes =
    event.tenantId === undefined
      ? []
      : [{ key: "tenant.id", value: { stringValue: event.tenantId } }];
  return {
    resourceLogs: [
      {
        resource: { attributes: resourceAttributes },
        scopeLogs: [
          {
            scope: { name: "@caisson-sh/kernel" },
            logRecords: [
              {
                timeUnixNano: `${Date.parse(event.timestamp) * 1_000_000}`,
                body: { stringValue: event.name },
                attributes: toOtlpAttributes(event.attributes),
              },
            ],
          },
        ],
      },
    ],
  };
}
