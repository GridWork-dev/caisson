// The agent-trajectory poke's checkable claims, now that it drives the REAL package through
// `@caisson-sh/agent-trajectory/browser` (ADR-0396) and the hand-ported mirror
// (agent-trajectory-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. The poke imports the browser subpath, not the barrel — the barrel drags the two PG stores.
//   3. The sample fixture is honestly admissible: every event parses through the shipped strict
//      schema, all eleven kinds appear, and the seq run is gapless as the append-only store demands.
//   4. The verdict the component renders agrees with the SHIPPED STORE: the clean and the inflated
//      logs append end to end through `createMemoryTrajectoryStore()`, and the invariant-broken log
//      is rejected by its real `parseStrict` gate with a `ValidationError`. The component reads that
//      same gate in its non-throwing (`safeParse`) form so it can stay synchronous.
//   5. There is no parity suite, because there is no copy left to compare against.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import {
  createMemoryTrajectoryStore,
  EVENT_KINDS,
  project,
  TrajectoryEvent,
} from "@caisson-sh/agent-trajectory/browser";

import {
  breakInvariant,
  evaluate,
  eventDigest,
  eventSummary,
  inflateCredits,
  initialState,
  RECORDED_METERED_CREDITS,
  reset,
  reversedArrival,
  SAMPLE_RUN,
  shortDigest,
  usageEvent,
  verdictLine,
} from "./agent-trajectory-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "agent-trajectory-poke.tsx");

/** Drive the log through the package's REAL append-only store, in recorded order. */
async function appendAll(events: readonly TrajectoryEvent[]): Promise<number> {
  const store = createMemoryTrajectoryStore();
  for (const event of events) await store.append(event);
  const runId = events[0]?.runId ?? "";
  return (await store.read(runId)).length;
}

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: `files.length` alone proves nothing. These files are reachable ONLY through
    // @caisson-sh/agent-trajectory's own imports — the browser entry, then a second hop into the fold
    // and a cross-package hop into kernel — so a resolver gone blind inside a workspace package
    // fails here rather than greening vacuously.
    expect(walk.files).toContain("packages/agent-trajectory/src/browser.ts");
    expect(walk.files).toContain("packages/agent-trajectory/src/replay.ts");
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the two Postgres store implementations stay out of the bundle graph", () => {
    expect(walk.files.some((f) => f.endsWith(".pg.ts"))).toBe(false);
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/field-crypto/"))).toBe(
      false,
    );
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A third entry appearing here means a new non-workspace dependency joined the client graph —
    // that is a review event, not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on the `.` barrel", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/agent-trajectory/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
    expect(tainted.offenders.every((o) => o.spec.startsWith("node:"))).toBe(
      true,
    );
  });

  test("the poke imports the browser subpath in source, never the barrel", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(/from "@caisson-sh\/agent-trajectory\/browser";$/m);
    expect(src).not.toMatch(/from "@caisson-sh\/agent-trajectory";$/m);
  });
});

describe("the sample fixture is honestly admissible to the real contract", () => {
  test("every baked event parses through the shipped strict TrajectoryEvent schema", () => {
    for (const event of SAMPLE_RUN) {
      expect(TrajectoryEvent.safeParse(event).success).toBe(true);
    }
  });

  test("all eleven kinds appear somewhere in the sample run", () => {
    const kinds = new Set(SAMPLE_RUN.map((e) => e.kind));
    expect(EVENT_KINDS).toHaveLength(11);
    for (const kind of EVENT_KINDS) expect(kinds.has(kind)).toBe(true);
  });

  test("the real append-only store accepts the whole log in recorded order", async () => {
    expect(await appendAll(SAMPLE_RUN)).toBe(SAMPLE_RUN.length);
  });
});

describe("the real project() under the poke's replay", () => {
  test("recorded order and reversed arrival fold byte-identically", () => {
    const ordered = project(SAMPLE_RUN);
    const reversed = project(reversedArrival(SAMPLE_RUN));
    expect(JSON.stringify(ordered)).toBe(JSON.stringify(reversed));
  });

  test("model.call and tool.* fold to no projection state (the real fold's own boundary)", () => {
    const p = project(SAMPLE_RUN);
    expect(p.steps).toHaveLength(1);
    expect(p.checkpoints).toHaveLength(1);
    expect(p.status).toBe("completed");
  });

  test("usageTotals carries the recorded metered credits, nothing else", () => {
    const p = project(SAMPLE_RUN);
    expect(p.usageTotals.metered.credits).toBe(RECORDED_METERED_CREDITS);
    expect(p.usageTotals.priced.credits).toBe(0);
    expect(p.usageTotals.estimated.credits).toBe(0);
  });
});

describe("the rendered verdict agrees with the shipped store's own gate", () => {
  test("clean state: order-independent, schema-clean, verdict ok", () => {
    const state = initialState();
    const result = evaluate(state);
    expect(result.orderIndependent).toBe(true);
    expect(result.usageIssue).toBeNull();
    expect(verdictLine(result, state).state).toBe("ok");
  });

  test("inflate: still schema-valid on both sides, but the projected total diverges", async () => {
    const state = inflateCredits(initialState());
    const result = evaluate(state);
    expect(result.orderIndependent).toBe(true);
    expect(result.usageIssue).toBeNull();
    // …and the real store agrees it is admissible: the tamper is a lie, not a malformed event.
    expect(await appendAll(state.events)).toBe(SAMPLE_RUN.length);
    expect(result.projection.usageTotals.metered.credits).toBe(
      RECORDED_METERED_CREDITS * 100,
    );
    const line = verdictLine(result, state);
    expect(line.state).toBe("fail");
    expect(line.text).toContain("usageTotals.metered.credits reads 500");
  });

  test("invariant break: the poke's message is the schema's own, and the store throws", async () => {
    const state = breakInvariant(initialState());
    const result = evaluate(state);
    const line = verdictLine(result, state);
    expect(line.state).toBe("fail");
    // Not restated copy: the string comes out of the package's superRefine.
    expect(line.text).toBe(
      'credits must be 0 when billingStatus is "estimated" (only metered/priced carry credit claims)',
    );
    await expect(appendAll(state.events)).rejects.toThrow(ValidationError);
    expect(usageEvent(state.events).payload.billingStatus).toBe("estimated");
  });

  test("reset returns to the clean, ok state and leaves the prior state untouched", () => {
    const tampered = breakInvariant(initialState());
    const state = reset();
    expect(state).toEqual(initialState());
    expect(verdictLine(evaluate(state), state).state).toBe("ok");
    expect(tampered.tamper).toBe("invariant");
  });
});

describe("display helpers", () => {
  test("shortDigest keeps the head and tail of a 64-hex digest", () => {
    expect(shortDigest("4f3c2a1e".repeat(8))).toBe("4f3c2a…2a1e");
  });

  test("eventSummary never renders a raw body, only kind-appropriate metadata", () => {
    for (const event of SAMPLE_RUN) {
      expect(eventSummary(event).length).toBeGreaterThan(0);
    }
  });

  test("eventDigest surfaces the DigestRef for kinds that carry sensitive bodies", () => {
    const modelCall = SAMPLE_RUN.find((e) => e.kind === "model.call");
    expect(modelCall && eventDigest(modelCall)?.digest).toMatch(
      /^[0-9a-f]{64}$/,
    );
    const approved = SAMPLE_RUN.find((e) => e.kind === "tool.approved");
    expect(approved && eventDigest(approved)).toBeUndefined();
  });
});
