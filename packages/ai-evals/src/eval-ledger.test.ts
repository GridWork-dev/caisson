// Eval-ledger tests (ADR-0214). Round-trip through the in-memory sink; non-integer/negative money
// rejected at the schema boundary; the isolation-by-construction invariant (never imports
// `@caisson-sh/ai-meter`) is asserted by a source grep, mirroring the kernel event-sink self-check.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evalSpendEntrySchema,
  InMemoryEvalLedgerSink,
  recordEvalSpend,
} from "./eval-ledger.ts";

describe("recordEvalSpend + InMemoryEvalLedgerSink", () => {
  test("round-trips a valid spend entry into the sink", async () => {
    const sink = new InMemoryEvalLedgerSink();
    const entry = await recordEvalSpend(sink, {
      evalName: "compliance-answer",
      cases: 3,
      costCents: 250,
    });
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]).toEqual(entry);
    expect(entry.evalName).toBe("compliance-answer");
    expect(entry.cases).toBe(3);
    expect(entry.costCents).toBe(250);
    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(() => new Date(entry.ranAt).toISOString()).not.toThrow();

    sink.clear();
    expect(sink.entries).toHaveLength(0);
  });

  test("a zero-cost run is valid (costCents: 0)", async () => {
    const sink = new InMemoryEvalLedgerSink();
    const entry = await recordEvalSpend(sink, {
      evalName: "injection-defense",
      cases: 2,
      costCents: 0,
    });
    expect(entry.costCents).toBe(0);
  });

  test("a non-integer costCents is rejected", () => {
    expect(
      recordEvalSpend(new InMemoryEvalLedgerSink(), {
        evalName: "t",
        cases: 1,
        costCents: 2.5,
      }),
    ).rejects.toThrow();
  });

  test("a negative costCents is rejected", () => {
    expect(
      recordEvalSpend(new InMemoryEvalLedgerSink(), {
        evalName: "t",
        cases: 1,
        costCents: -1,
      }),
    ).rejects.toThrow();
  });

  test("a negative cases count is rejected", () => {
    expect(
      recordEvalSpend(new InMemoryEvalLedgerSink(), {
        evalName: "t",
        cases: -1,
        costCents: 0,
      }),
    ).rejects.toThrow();
  });
});

describe("evalSpendEntrySchema boundary", () => {
  test("rejects an unknown field (.strict)", () => {
    expect(() =>
      evalSpendEntrySchema.parse({
        id: crypto.randomUUID(),
        evalName: "t",
        ranAt: new Date().toISOString(),
        cases: 1,
        costCents: 1,
        sneaky: true,
      }),
    ).toThrow();
  });
});

describe("budget isolation by construction (ADR-0214)", () => {
  test("the eval-ledger module has no import edge to @caisson-sh/ai-meter", () => {
    const src = readFileSync(join(import.meta.dir, "eval-ledger.ts"), "utf8");
    // No `import ... from "@caisson-sh/ai-meter"` and no `require("@caisson-sh/ai-meter")` — prose
    // mentions of the name (in comments, explaining the isolation) are fine; an import edge is not.
    expect(src).not.toMatch(/from\s+["']@caisson-sh\/ai-meter["']/);
    expect(src).not.toMatch(/require\(\s*["']@caisson-sh\/ai-meter["']/);
  });
});
