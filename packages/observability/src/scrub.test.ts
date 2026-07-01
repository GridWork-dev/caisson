import { describe, expect, test } from "bun:test";
import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ScrubbingSpanProcessor, scrubAttributes } from "./scrub.ts";

describe("scrubAttributes", () => {
  test("redacts secret/auth/cookie/token/key-shaped keys", () => {
    const attrs: Record<string, unknown> = {
      "http.request.header.authorization": "Bearer abc.def.ghi",
      "http.request.header.cookie": "session=xyz",
      "http.request.header.x-api-key": "sk-live-1234",
      apiKey: "sk-live-1234",
      access_key: "AKIA...",
      privateKey: "-----BEGIN KEY-----",
      sessionId: "s-1",
      password: "hunter2",
      "user.email": "liam@example.com",
      "user.phone": "555-0100",
    };
    scrubAttributes(attrs);
    for (const key of Object.keys(attrs)) {
      expect(attrs[key]).toBe("[REDACTED]");
    }
  });

  test("leaves benign operational attributes untouched", () => {
    const attrs: Record<string, unknown> = {
      "http.method": "GET",
      "http.status_code": 200,
      "http.route": "/query",
      "net.peer.name": "caisson.sh",
      "db.system": "postgresql",
    };
    const before = { ...attrs };
    scrubAttributes(attrs);
    expect(attrs).toEqual(before);
  });

  test("redacts a raw bearer-shaped VALUE even under a non-suspicious key", () => {
    const attrs: Record<string, unknown> = {
      "custom.header": "Bearer some-opaque-token",
    };
    scrubAttributes(attrs);
    expect(attrs["custom.header"]).toBe("[REDACTED]");
  });

  test("non-string values matching no sensitive key pass through unchanged", () => {
    const attrs: Record<string, unknown> = { "retry.count": 3, ok: true };
    scrubAttributes(attrs);
    expect(attrs).toEqual({ "retry.count": 3, ok: true });
  });
});

/** A minimal `SpanProcessor` double that records every span handed to `onEnd`. */
function createRecordingProcessor(): SpanProcessor & {
  ended: ReadableSpan[];
} {
  const ended: ReadableSpan[] = [];
  return {
    ended,
    onStart(_span: Span, _parentContext: Context): void {},
    onEnd(span: ReadableSpan): void {
      ended.push(span);
    },
    forceFlush(): Promise<void> {
      return Promise.resolve();
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    },
  };
}

function fakeReadableSpan(attributes: Record<string, unknown>): ReadableSpan {
  return { attributes } as unknown as ReadableSpan;
}

describe("ScrubbingSpanProcessor", () => {
  test("scrubs attributes before forwarding onEnd to the wrapped processor", () => {
    const next = createRecordingProcessor();
    const processor = new ScrubbingSpanProcessor(next);
    const span = fakeReadableSpan({ authorization: "secret-value", ok: 1 });

    processor.onEnd(span);

    expect(next.ended).toHaveLength(1);
    expect(next.ended[0]?.attributes).toEqual({
      authorization: "[REDACTED]",
      ok: 1,
    });
  });

  test("delegates forceFlush and shutdown to the wrapped processor", async () => {
    let flushed = false;
    let shutdown = false;
    const next: SpanProcessor = {
      onStart(): void {},
      onEnd(): void {},
      forceFlush(): Promise<void> {
        flushed = true;
        return Promise.resolve();
      },
      shutdown(): Promise<void> {
        shutdown = true;
        return Promise.resolve();
      },
    };
    const processor = new ScrubbingSpanProcessor(next);

    await processor.forceFlush();
    await processor.shutdown();

    expect(flushed).toBe(true);
    expect(shutdown).toBe(true);
  });
});
