// The alerting poke's checkable claims, now that it drives the REAL `@caisson-sh/alerting/browser`
// and the hand-ported mirror (alerting-logic.ts) is deleted. No parity suite survives because there
// is nothing left to compare — the four control assertions below run the package's own async
// `processAlert` through the poke's session bookkeeping, where the mirror's suite only ever proved
// a hand-maintained copy still agreed with the original.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import {
  AlertEventSchema,
  DEFAULT_EVENT_TYPE_REGISTRY,
} from "@caisson-sh/alerting/browser";

import {
  FLOOD_BURST_COUNT,
  SAMPLE_CHANNELS,
  SAMPLE_EVENT_TYPE,
  SAMPLE_RATE_POLICY,
  SAMPLE_SEVERITY,
  floodStep,
  initAlertSession,
  sendDuplicateStep,
  sendOnceStep,
  toggleQuietStep,
} from "./alerting-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "alerting-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: the poke rig and its stylesheet alone would satisfy files.length, so these
    // named modules are the claim. orchestrator.ts is the load-bearing one — it is the module that
    // used to value-import the node-only channels.ts, and kernel/src/errors.ts is a second hop
    // reached only by a bare @caisson-sh/* specifier, so a resolver gone blind fails here.
    expect(walk.files).toContain("packages/alerting/src/browser.ts");
    expect(walk.files).toContain("packages/alerting/src/orchestrator.ts");
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
  });

  test("the network drivers stay out of the bundle graph", () => {
    // ./browser exists precisely to leave channels.ts behind: a browser cannot hold a webhook
    // signing secret, and its SSRF re-check resolves DNS.
    expect(walk.files.some((f) => f.endsWith("alerting/src/channels.ts"))).toBe(
      false,
    );
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/alerting/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });
});

describe("the sample policy is the package's own registry entry, not a restated table", () => {
  test("severity, channels, and rate cap all come from DEFAULT_EVENT_TYPE_REGISTRY", () => {
    const entry = DEFAULT_EVENT_TYPE_REGISTRY[SAMPLE_EVENT_TYPE];
    if (entry === undefined) {
      throw new Error(`no registry entry for ${SAMPLE_EVENT_TYPE}`);
    }
    expect(SAMPLE_SEVERITY).toBe(entry.defaultSeverity);
    // Reference identity, not deep equality: a copied array would pass toEqual, this cannot.
    expect(SAMPLE_CHANNELS).toBe(entry.channels);
    expect(SAMPLE_RATE_POLICY).toBe(entry.ratePolicy);
  });

  test("the sample severity is subject to quiet hours (a critical event would override it)", () => {
    expect(SAMPLE_SEVERITY).not.toBe("critical");
  });

  test("the poke's built sample event validates against the real AlertEventSchema", async () => {
    const { session } = await sendOnceStep(initAlertSession());
    expect(() => AlertEventSchema.parse(session.lastEvent)).not.toThrow();
  });
});

describe("the async controls are single-flight", () => {
  test("every pipeline action is guarded and disabled while one step is in flight", () => {
    const source = readFileSync(POKE_ENTRY, "utf8");
    expect(source.match(/if \(busy\) return;/g)).toHaveLength(4);
    expect(source).toContain("disabled={busy || session.lastEvent === null}");
    expect(source.match(/disabled=\{busy\}/g)).toHaveLength(4);
  });
});

describe("the four controls run the real processAlert", () => {
  test("send once delivers to every registered channel and lands exactly one audit row", async () => {
    const { session, result } = await sendOnceStep(initAlertSession());
    expect(result.outcome).toBe("delivered");
    expect(result.deliveries.map((d) => d.channel)).toEqual([
      ...SAMPLE_CHANNELS,
    ]);
    expect(result.deliveries.every((d) => d.ok)).toBe(true);
    expect(session.audit).toHaveLength(1);
    expect(session.audit[0]?.outcome).toBe("delivered");
    expect(session.recentCount).toBe(1);
    expect(session.openIncidents).toHaveLength(1);
  });

  test("send duplicate is suppressed by the real dedup, and STILL writes its audit row", async () => {
    const first = await sendOnceStep(initAlertSession());
    const duplicate = await sendDuplicateStep(first.session);
    if (duplicate === null) throw new Error("expected a duplicate outcome");
    expect(duplicate.result.outcome).toBe("suppressed");
    expect(duplicate.result.deliveries).toEqual([]);
    // Always-one-row holds on a suppressed send too — that is the audit contract, not delivery.
    expect(duplicate.session.audit).toHaveLength(2);
    // A suppressed send neither opens a new incident nor spends rate-cap headroom.
    expect(duplicate.session.recentCount).toBe(first.session.recentCount);
    expect(duplicate.session.openIncidents).toHaveLength(1);
  });

  test("send duplicate before anything was sent is a no-op", async () => {
    expect(await sendDuplicateStep(initAlertSession())).toBeNull();
  });

  test("flood trips the real rate cap to digest at the policy's maxPerWindow", async () => {
    const { session, results, trippedAtSend } =
      await floodStep(initAlertSession());
    expect(results).toHaveLength(FLOOD_BURST_COUNT);
    // The cap is reached once recentCount hits maxPerWindow, so the first digest is the send
    // immediately after that many deliveries.
    expect(trippedAtSend).toBe(SAMPLE_RATE_POLICY.maxPerWindow + 1);
    expect(results.filter((r) => r.outcome === "delivered")).toHaveLength(
      SAMPLE_RATE_POLICY.maxPerWindow,
    );
    expect(session.audit).toHaveLength(FLOOD_BURST_COUNT);
  });

  test("toggling to the quiet clock holds a warning-severity alert, and back delivers it", async () => {
    const quiet = await toggleQuietStep(initAlertSession());
    expect(quiet.session.quietMode).toBe("quiet");
    expect(quiet.result.outcome).toBe("held");
    expect(quiet.result.deliveries).toEqual([]);

    const business = await toggleQuietStep(quiet.session);
    expect(business.session.quietMode).toBe("business");
    expect(business.result.outcome).toBe("delivered");
  });

  test("the same click sequence always replays identically — no live clock, no randomness", async () => {
    const run = async () => {
      const once = await sendOnceStep(initAlertSession());
      const flooded = await floodStep(once.session);
      return flooded.session.audit.map((r) => ({
        eventId: r.eventId,
        outcome: r.outcome,
        at: r.at,
      }));
    };
    expect(await run()).toEqual(await run());
  });
});
