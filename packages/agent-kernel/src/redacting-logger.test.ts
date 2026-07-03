import { describe, expect, test } from "bun:test";
import {
  makeRedactingLogger,
  toRedactedJsonlLine,
} from "./redacting-logger.ts";

/** A structured event with secrets buried two levels deep, plus clean sibling content. */
function eventWithNestedSecret(): Record<string, unknown> {
  return {
    act: "verify",
    context: {
      auth: {
        apiKey: "sk-proj-AAAABBBBCCCCDDDD", // secret-NAMED key, two levels deep — value drops
      },
      note: "Rotate AKIAIOSFODNN7EXAMPLE now", // clean key, secret SPAN in leaf — span redacted
    },
    message: "Transition admitted cleanly.",
    count: 3,
  };
}

describe("toRedactedJsonlLine", () => {
  test("redacts secrets buried in nested fields before serializing", () => {
    const line = toRedactedJsonlLine(eventWithNestedSecret());
    const parsed = JSON.parse(line) as {
      context: { auth: { apiKey: unknown }; note: string };
    };
    expect(parsed.context.auth.apiKey).toBe("[REDACTED]");
    expect(parsed.context.note).toBe("Rotate [REDACTED] now");
  });

  test("leaves non-secret content untouched", () => {
    const line = toRedactedJsonlLine(eventWithNestedSecret());
    const parsed = JSON.parse(line) as {
      act: string;
      message: string;
      count: number;
    };
    expect(parsed.act).toBe("verify");
    expect(parsed.message).toBe("Transition admitted cleanly.");
    expect(parsed.count).toBe(3);
  });

  test("emits one valid JSON value terminated by exactly one trailing newline", () => {
    const line = toRedactedJsonlLine({ a: 1 });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.indexOf("\n")).toBe(line.length - 1); // no embedded newline before the terminator
    expect(() => JSON.parse(line)).not.toThrow();
  });

  test("never mutates the input event", () => {
    const input = eventWithNestedSecret();
    const snapshot = structuredClone(input);
    toRedactedJsonlLine(input);
    expect(input).toEqual(snapshot);
  });
});

describe("makeRedactingLogger", () => {
  test("hands each redacted line to the sink, and every emitted line is valid JSONL", async () => {
    const lines: string[] = [];
    const log = makeRedactingLogger((line) => {
      lines.push(line);
    });

    await log(eventWithNestedSecret());
    await log({ act: "ship", message: "clean" });

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(line)).not.toThrow();
    }
    const first = JSON.parse(lines[0] as string) as {
      context: { auth: { apiKey: unknown } };
    };
    expect(first.context.auth.apiKey).toBe("[REDACTED]");
    const second = JSON.parse(lines[1] as string) as { message: string };
    expect(second.message).toBe("clean");
  });

  test("awaits an async sink before resolving", async () => {
    const lines: string[] = [];
    const log = makeRedactingLogger(async (line) => {
      await Promise.resolve();
      lines.push(line);
    });

    await log({ act: "spec" });
    expect(lines).toHaveLength(1);
  });
});

describe("toRedactedJsonlLine — bigint safety", () => {
  test("bigint leaves serialize as decimal strings instead of throwing", () => {
    const line = toRedactedJsonlLine({
      kind: "meter",
      sequence: 9007199254740993n,
      nested: { count: 42n },
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed["sequence"]).toBe("9007199254740993");
    expect((parsed["nested"] as Record<string, unknown>)["count"]).toBe("42");
  });
});
