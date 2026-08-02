// Golden parity: the browser mirror in agent-trajectory-logic.ts must be byte-identical to the REAL
// @caisson/agent-trajectory schema + replay primitives (both run here under bun, which is node-
// backed, so the package's full import graph resolves fine even though it can't enter the browser
// bundle). No __golden__ fixture directory exists for this package (checked); parity is pinned
// directly against the real exported functions instead, following local-sync-logic.test.ts's
// relative-source parity convention.
//
// The real package exposes only its barrel (`exports["."]` = src/index.ts in package.json) and is
// not itself a listed dependency of @caisson/site, so — matching audit-worm-poke.test.ts's own
// precedent (it relative-imports the audit-worm package's source rather than going through
// "@caisson/audit-worm") — this reaches the source files directly by relative path.
import { describe, expect, test } from "bun:test";
import { parseStrict, ValidationError } from "@caisson/kernel";
import {
  EVENT_KINDS as REAL_EVENT_KINDS,
  TrajectoryEvent as RealTrajectoryEvent,
} from "../../../../packages/agent-trajectory/src/schema.ts";
import { project as realProject } from "../../../../packages/agent-trajectory/src/replay.ts";

import {
  breakInvariant,
  eventDigest,
  eventSummary,
  EVENT_KINDS,
  evaluate,
  inflateCredits,
  initialState,
  project,
  RECORDED_METERED_CREDITS,
  reset,
  reversedArrival,
  SAMPLE_RUN,
  shortDigest,
  validateUsage,
  verdictLine,
  type Event,
} from "./agent-trajectory-logic.ts";

describe("EVENT_KINDS parity", () => {
  test("the mirrored vocabulary matches the real package's, in order", () => {
    expect(EVENT_KINDS).toEqual(REAL_EVENT_KINDS);
    expect(EVENT_KINDS).toHaveLength(11);
  });
});

describe("SAMPLE_RUN is honestly schema-valid", () => {
  test("every baked event parses through the real strict TrajectoryEvent schema", () => {
    for (const e of SAMPLE_RUN) {
      expect(() => parseStrict(RealTrajectoryEvent, e)).not.toThrow();
    }
  });

  test("all eleven kinds appear somewhere in the sample run", () => {
    const kinds = new Set(SAMPLE_RUN.map((e) => e.kind));
    for (const k of EVENT_KINDS) expect(kinds.has(k)).toBe(true);
  });

  test("seq is a gapless 0-based sequence, matching the store's append-only contract", () => {
    const seqs = [...SAMPLE_RUN].map((e) => e.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(SAMPLE_RUN.map((_, i) => i));
  });
});

describe("project() parity vs the real replay.ts", () => {
  function realParsed(events: readonly Event[]) {
    return events.map((e) => parseStrict(RealTrajectoryEvent, e));
  }

  test("byte-identical projection on the sample run", () => {
    const mine = project(SAMPLE_RUN);
    const real = realProject(realParsed(SAMPLE_RUN));
    expect(JSON.stringify(mine)).toBe(JSON.stringify(real));
  });

  test("byte-identical on reversed arrival too (order independence, both sides)", () => {
    const mine = project(reversedArrival(SAMPLE_RUN));
    const real = realProject(realParsed(reversedArrival(SAMPLE_RUN)));
    expect(JSON.stringify(mine)).toBe(JSON.stringify(real));
    expect(JSON.stringify(mine)).toBe(JSON.stringify(project(SAMPLE_RUN)));
  });

  test("model.call and tool.* fold to no projection state (the real fold's own boundary)", () => {
    const p = project(SAMPLE_RUN);
    // Only run/step/model.usage/checkpoint events in SAMPLE_RUN move the projection; the two
    // tool.proposed + tool.approved + tool.denied + tool.result + model.call events do not.
    expect(p.checkpoints).toHaveLength(1);
    expect(p.steps).toHaveLength(1);
    expect(p.status).toBe("completed");
  });

  test("usageTotals carries the recorded metered credits, nothing else", () => {
    const p = project(SAMPLE_RUN);
    expect(p.usageTotals.metered.credits).toBe(RECORDED_METERED_CREDITS);
    expect(p.usageTotals.priced.credits).toBe(0);
  });
});

describe("validateUsage parity vs the real schema's superRefine", () => {
  test("the recorded (metered) event is valid on both sides", () => {
    const usage = SAMPLE_RUN.find((e) => e.kind === "model.usage");
    if (usage === undefined || usage.kind !== "model.usage")
      throw new Error("fixture missing");
    expect(validateUsage(usage.payload)).toEqual({ ok: true });
  });

  test("inflating credits stays schema-valid on both sides (still metered)", () => {
    const inflated = inflateCredits(initialState()).events.find(
      (e) => e.kind === "model.usage",
    );
    if (inflated === undefined || inflated.kind !== "model.usage")
      throw new Error("fixture missing");
    expect(validateUsage(inflated.payload)).toEqual({ ok: true });
    expect(() => parseStrict(RealTrajectoryEvent, inflated)).not.toThrow();
    expect(inflated.payload.credits).toBe(RECORDED_METERED_CREDITS * 100);
  });

  test("breaking the invariant fails identically on both sides, exact message text", () => {
    const broken = breakInvariant(initialState()).events.find(
      (e) => e.kind === "model.usage",
    );
    if (broken === undefined || broken.kind !== "model.usage")
      throw new Error("fixture missing");
    const mine = validateUsage(broken.payload);
    expect(mine.ok).toBe(false);
    expect(mine.message).toBe(
      'credits must be 0 when billingStatus is "estimated" (only metered/priced carry credit claims)',
    );
    expect(() => parseStrict(RealTrajectoryEvent, broken)).toThrow(
      ValidationError,
    );
  });
});

describe("evaluate + verdictLine drive the UI honestly", () => {
  test("clean state: order-independent, valid, verdict ok", () => {
    const s = initialState();
    const r = evaluate(s);
    expect(r.orderIndependent).toBe(true);
    expect(r.usage.ok).toBe(true);
    expect(verdictLine(r, s).state).toBe("ok");
  });

  test("inflate: still order-independent and schema-valid, but the total diverges, verdict fail", () => {
    const s = inflateCredits(initialState());
    const r = evaluate(s);
    expect(r.orderIndependent).toBe(true);
    expect(r.usage.ok).toBe(true);
    expect(r.projection.usageTotals.metered.credits).toBe(
      RECORDED_METERED_CREDITS * 100,
    );
    const line = verdictLine(r, s);
    expect(line.state).toBe("fail");
    expect(line.text).toContain("usageTotals.metered.credits reads 500");
  });

  test("invariant break: fails closed, verdict fail with the schema's own message", () => {
    const s = breakInvariant(initialState());
    const r = evaluate(s);
    expect(r.usage.ok).toBe(false);
    const line = verdictLine(r, s);
    expect(line.state).toBe("fail");
    expect(line.text).toBe(
      'credits must be 0 when billingStatus is "estimated" (only metered/priced carry credit claims)',
    );
  });

  test("reset returns to the clean, ok state", () => {
    const tampered = breakInvariant(initialState());
    const s = reset();
    expect(s).toEqual(initialState());
    expect(verdictLine(evaluate(s), s).state).toBe("ok");
    expect(tampered.tamper).toBe("invariant"); // the prior state is untouched (pure functions)
  });
});

describe("display helpers", () => {
  test("shortDigest keeps the head and tail of a 64-hex digest", () => {
    const digest = "4f3c2a1e".repeat(8);
    expect(shortDigest(digest)).toBe("4f3c2a…2a1e");
  });

  test("eventSummary never renders a raw body, only kind-appropriate metadata", () => {
    for (const e of SAMPLE_RUN) {
      const summary = eventSummary(e);
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(0);
    }
  });

  test("eventDigest surfaces the DigestRef for kinds that carry sensitive bodies, never a string body", () => {
    const modelCall = SAMPLE_RUN.find((e) => e.kind === "model.call");
    expect(modelCall && eventDigest(modelCall)?.digest).toMatch(
      /^[0-9a-f]{64}$/,
    );
    const approved = SAMPLE_RUN.find((e) => e.kind === "tool.approved");
    expect(approved && eventDigest(approved)).toBeUndefined();
  });
});
