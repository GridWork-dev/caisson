import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildChain } from "./audit-chain.ts";
import {
  InMemoryEventSink,
  NoopEventSink,
  type OpsEvent,
  OtelPostgresEventSink,
  type OtlpSend,
  opsEventSchema,
  redactEvent,
} from "./event-sink.ts";

const TS = "2026-06-27T12:00:00.000Z";

const LEAKY: OpsEvent = {
  name: "gen.completed",
  timestamp: TS,
  tenantId: "tenant-a",
  attributes: {
    query: "SELECT * FROM accounts WHERE email = 'a@b.com'",
    apiKey: "sk-live-abcdef123456",
    error:
      "TypeError: boom\n    at foo (/app/src/x.ts:10:5)\n    at bar (/app/y.ts:3:1)",
    durationMs: 42,
    model: "claude-opus-4",
    nested: { password: "hunter2", note: "ok" },
  },
};

describe("event-sink redaction (ADR-0075 / ADR-0019)", () => {
  test("redaction strips secret / SQL / stack, keeps benign values", () => {
    const r = redactEvent(LEAKY);
    expect(r.attributes.query).toBe("[REDACTED:SQL]");
    expect(r.attributes.apiKey).toBe("[REDACTED]");
    expect(r.attributes.error).toBe("[REDACTED:STACK]");
    expect(r.attributes.durationMs).toBe(42);
    expect(r.attributes.model).toBe("claude-opus-4");
    expect(r.attributes.nested).toEqual({ password: "[REDACTED]", note: "ok" });
  });

  test("no secret / SQL / stack substring survives serialization", () => {
    const serialized = JSON.stringify(redactEvent(LEAKY));
    expect(serialized).not.toContain("sk-live");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("    at ");
  });

  test("redaction does not mutate the input event", () => {
    redactEvent(LEAKY);
    expect(LEAKY.attributes.apiKey).toBe("sk-live-abcdef123456");
  });

  const redactNote = (note: string): unknown =>
    redactEvent({ name: "probe", timestamp: TS, attributes: { note } })
      .attributes.note;

  test("a stack frame is caught after blank lines, CRLF and tab indents", () => {
    expect(redactNote("boom\n\n\n  at foo (x.ts:1:1)")).toBe(
      "[REDACTED:STACK]",
    );
    expect(redactNote("boom\r\n\tat foo (x.ts:1:1)")).toBe("[REDACTED:STACK]");
    expect(redactNote("boom\n \r at foo (x.ts:1:1)")).toBe("[REDACTED:STACK]");
    expect(redactNote("meet me\nat")).toBe("meet me\nat");
    expect(redactNote("look at this")).toBe("look at this");
  });

  test("SQL needs a verb and a later clause keyword, each a whole word", () => {
    expect(redactNote("please DELETE the row FROM t")).toBe("[REDACTED:SQL]");
    expect(redactNote("update users set x = 1")).toBe("[REDACTED:SQL]");
    expect(redactNote("values from the last select")).toBe(
      "values from the last select",
    );
    expect(redactNote("selection from the table")).toBe(
      "selection from the table",
    );
    expect(redactNote("select fromage")).toBe("select fromage");
  });

  test("redaction time grows linearly on newline runs and verb runs", () => {
    // Tens of seconds each with the one-pattern forms, which rescan from every newline or verb.
    for (const note of ["\n".repeat(640_000), "select ".repeat(80_000)]) {
      const started = performance.now();
      expect(redactNote(note)).toBe(note);
      expect(performance.now() - started).toBeLessThan(2_000);
    }
  });
});

describe("event-sink transports", () => {
  test("the in-memory sink captures the redacted event", () => {
    const sink = new InMemoryEventSink();
    sink.emit(LEAKY);
    sink.emit({ name: "ping", timestamp: TS, attributes: {} });
    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]!.attributes.apiKey).toBe("[REDACTED]");
    sink.clear();
    expect(sink.events).toHaveLength(0);
  });

  test("the noop sink drops events", () => {
    const sink = new NoopEventSink();
    expect(sink.emit(LEAKY)).toBeUndefined();
  });

  test("the OTel transport redacts before export and never makes a live call", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const send: OtlpSend = (url, init, _timeoutMs) => {
      calls.push({ url, body: String(init.body) });
      return Promise.resolve(new Response(null, { status: 200 }));
    };
    const sink = new OtelPostgresEventSink({
      endpoint: "http://collector.invalid/v1/logs",
      send,
    });
    await sink.emit(LEAKY);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://collector.invalid/v1/logs");
    // The exported wire payload carries no secret / SQL / stack.
    expect(calls[0]!.body).not.toContain("sk-live");
    expect(calls[0]!.body).not.toContain("hunter2");
    expect(calls[0]!.body).not.toContain("SELECT");
    expect(calls[0]!.body).toContain("[REDACTED]");
  });

  test("the OTel transport surfaces a non-2xx export as an InternalError", async () => {
    const send: OtlpSend = () =>
      Promise.resolve(new Response(null, { status: 503 }));
    const sink = new OtelPostgresEventSink({
      endpoint: "http://x/v1/logs",
      send,
    });
    await expect(sink.emit(LEAKY)).rejects.toThrow(/OTLP export failed/);
  });
});

describe("event-sink boundary schema", () => {
  test("opsEventSchema accepts a valid event and rejects unknown envelope keys", () => {
    expect(
      opsEventSchema.safeParse({ name: "ok", timestamp: TS, attributes: {} })
        .success,
    ).toBe(true);
    expect(
      opsEventSchema.safeParse({
        name: "ok",
        timestamp: TS,
        attributes: {},
        rogue: 1,
      }).success,
    ).toBe(false);
  });
});

describe("audit-chain stays strictly separate (ADR-0075 / ADR-0052)", () => {
  test("the sink module never imports the WORM audit-chain", () => {
    const src = readFileSync(join(import.meta.dir, "event-sink.ts"), "utf8");
    // No import edge to the chain module, and no use of its build/anchor primitives.
    expect(src).not.toMatch(/from\s+["']\.\/audit-chain/);
    expect(src).not.toMatch(/\bbuildChain\b/);
    expect(src).not.toMatch(/\banchorChain\b/);
  });

  test("ops events and the audit-chain are independent write paths", () => {
    const sink = new InMemoryEventSink();
    sink.emit({
      name: "audit.locked",
      timestamp: TS,
      attributes: { artifactId: "art-1" },
    });
    // The evidentiary record is the SEPARATE append-only chain — built without touching the sink.
    const chain = buildChain([{ event: "locked", artifactId: "art-1" }]);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]!.name).toBe("audit.locked");
    expect(chain[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
