// Span-attribute scrubbing (ADR-0117). A conservative key-based deny-list: secrets, `Authorization`,
// cookies, tokens, `*-key` material, and a small PII key set are dropped — not partially masked —
// before a span ever leaves the process. Key-based (not value-based) by design: it cannot tell apart
// a legitimate numeric ID from a sensitive one, but it never lets a header/attribute NAMED like a
// secret slip through, which is the failure mode that matters here.
//
// This is deliberately NOT a re-export of @caisson/kernel's `redactEvent` (ADR-0075): that function
// redacts the `OpsEvent` envelope (product-internal ops telemetry, a different sink per ADR-0117
// Relations); this one mutates a span's flat `attributes` record in place, which is the shape
// `SpanProcessor#onEnd` hands back. The two paths intentionally never share a write path.
import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

/**
 * Span attribute / header KEY deny-list. Matches loosely on purpose — a key that merely LOOKS
 * sensitive is redacted rather than risk a false negative. Extend this list, don't replace it.
 */
export const SENSITIVE_ATTRIBUTE_KEY =
  /(?:secret|token|password|passwd|api[_-]?key|apikey|authoriz|bearer|credential|cookie|session|private[_-]?key|access[_-]?key|signing[_-]?key|encryption[_-]?key|\bssn\b|social[_-]?security|\bemail\b|\bphone\b|date[_-]?of[_-]?birth|\bdob\b)/i;

/** A value-level backstop: a raw `Authorization: Bearer <token>` string under an unsuspicious key. */
const BEARER_VALUE = /^bearer\s+\S+/i;

const REDACTED = "[REDACTED]";

/**
 * Redact `attributes` IN PLACE: any key matching `SENSITIVE_ATTRIBUTE_KEY`, or any string value
 * shaped like a raw bearer token, is replaced with `"[REDACTED]"`. Mutating in place (rather than
 * returning a copy) is required by the `SpanProcessor#onEnd` seam below — `ReadableSpan.attributes`
 * is the live object the next processor in the chain reads.
 */
export function scrubAttributes(attributes: Record<string, unknown>): void {
  for (const key of Object.keys(attributes)) {
    if (SENSITIVE_ATTRIBUTE_KEY.test(key)) {
      attributes[key] = REDACTED;
      continue;
    }
    const value = attributes[key];
    if (typeof value === "string" && BEARER_VALUE.test(value)) {
      attributes[key] = REDACTED;
    }
  }
}

/**
 * A `SpanProcessor` decorator: scrubs every span's attributes at `onEnd` — AFTER the span is
 * complete (so every attribute any instrumentation added is visible) but BEFORE it reaches the
 * wrapped processor (so a scrubbed span is the only thing ever batched/exported). `onStart` and
 * `forceFlush`/`shutdown` pass straight through.
 */
export class ScrubbingSpanProcessor implements SpanProcessor {
  readonly #next: SpanProcessor;

  constructor(next: SpanProcessor) {
    this.#next = next;
  }

  onStart(span: Span, parentContext: Context): void {
    this.#next.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    scrubAttributes(span.attributes);
    this.#next.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.#next.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.#next.shutdown();
  }
}
