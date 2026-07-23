// Golden parity for the alerting poke's mirror (ADR-0378 lock 2): every pipeline stage in
// alerting-logic.ts must produce identical output to the real @caisson/alerting package on
// identical input. @caisson/alerting ships no `__golden__` fixture (manifest.ts declares
// `golden: null`), so parity is pinned directly against the real package's exports - this test
// imports "@caisson/alerting" directly and runs under bun, where the package's node:crypto and
// node:dns/promises transitive imports (via channels.ts + @caisson/kernel/ssrf.ts) resolve fine,
// unlike the browser bundle the poke component ships in (see alerting-logic.ts's header for why the
// mirror exists instead of a direct import).
import { describe, expect, test } from "bun:test";
import {
  AlertEventSchema as RealAlertEventSchema,
  DEFAULT_EVENT_TYPE_REGISTRY as REAL_DEFAULT_EVENT_TYPE_REGISTRY,
  createCaptureChannel as realCreateCaptureChannel,
  createInMemoryAuditSink as realCreateInMemoryAuditSink,
  dedup as realDedup,
  processAlert as realProcessAlert,
  quietHours as realQuietHours,
  rateCap as realRateCap,
  type AlertEvent as RealAlertEvent,
  type ProcessAlertDeps as RealProcessAlertDeps,
} from "@caisson/alerting";

import {
  DEFAULT_EVENT_TYPE_REGISTRY,
  FLOOD_BURST_COUNT,
  QUIET_POLICY,
  SAMPLE_CHANNELS,
  SAMPLE_EVENT_TYPE,
  SAMPLE_NOW_BUSINESS,
  SAMPLE_NOW_QUIET,
  SAMPLE_RATE_POLICY,
  SAMPLE_TZ,
  dedup,
  floodStep,
  initAlertSession,
  processAlert,
  quietHours,
  rateCap,
  sendDuplicateStep,
  sendOnceStep,
  toggleQuietStep,
  type AlertEvent,
  type OpenIncident,
} from "./alerting-logic";

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    id: "evt-1",
    type: SAMPLE_EVENT_TYPE,
    severity: "warning",
    tenantId: "sample-tenant",
    recipient: "ops@sample.test",
    dedupeKey: "dk-1",
    title: "Failed login spike",
    body: "5 failed logins from a new device in 2 minutes.",
    createdAt: SAMPLE_NOW_BUSINESS,
    ...overrides,
  };
}

describe("constant parity vs the real package", () => {
  test("DEFAULT_EVENT_TYPE_REGISTRY is byte-identical", () => {
    expect(DEFAULT_EVENT_TYPE_REGISTRY).toEqual(
      REAL_DEFAULT_EVENT_TYPE_REGISTRY,
    );
  });

  test("the sample event validates against the real AlertEventSchema", () => {
    const event = makeEvent();
    expect(() => RealAlertEventSchema.parse(event)).not.toThrow();
  });
});

describe("dedup parity", () => {
  const incidents: OpenIncident[] = [
    { dedupeKey: "dk-1" },
    { dedupeKey: "dk-2" },
  ];

  test("matches the real dedup() across a matrix of events and incident sets", () => {
    const cases: Array<[string, OpenIncident[]]> = [
      ["dk-1", incidents],
      ["dk-3", incidents],
      ["dk-1", []],
    ];
    for (const [dedupeKey, openIncidents] of cases) {
      const event = makeEvent({ dedupeKey });
      expect(dedup(event, openIncidents)).toBe(realDedup(event, openIncidents));
    }
  });
});

describe("rateCap parity", () => {
  test("matches the real rateCap() at, below, and above the cap", () => {
    const policy = { maxPerWindow: 5 };
    for (const recentCount of [0, 4, 5, 6, 100]) {
      const event = makeEvent();
      expect(rateCap(event, recentCount, policy)).toBe(
        realRateCap(event, recentCount, policy),
      );
    }
  });
});

describe("quietHours parity", () => {
  test("business-hours clock delivers for both mirrors, warning severity", () => {
    const event = makeEvent({ severity: "warning" });
    const now = new Date(SAMPLE_NOW_BUSINESS);
    expect(quietHours(event, SAMPLE_TZ, QUIET_POLICY, now)).toBe("deliver");
    expect(realQuietHours(event, SAMPLE_TZ, QUIET_POLICY, now)).toBe("deliver");
  });

  test("quiet-hours clock holds for both mirrors, warning severity", () => {
    const event = makeEvent({ severity: "warning" });
    const now = new Date(SAMPLE_NOW_QUIET);
    expect(quietHours(event, SAMPLE_TZ, QUIET_POLICY, now)).toBe("hold");
    expect(realQuietHours(event, SAMPLE_TZ, QUIET_POLICY, now)).toBe("hold");
  });

  test("critical always overrides to deliver, even inside the quiet window, for both mirrors", () => {
    const event = makeEvent({ severity: "critical" });
    const now = new Date(SAMPLE_NOW_QUIET);
    expect(quietHours(event, SAMPLE_TZ, QUIET_POLICY, now)).toBe("deliver");
    expect(realQuietHours(event, SAMPLE_TZ, QUIET_POLICY, now)).toBe("deliver");
  });
});

describe("processAlert end-to-end parity (real capture channel + real audit sink, no network)", () => {
  async function runReal(
    event: RealAlertEvent,
    overrides: Partial<RealProcessAlertDeps> = {},
  ) {
    const auditSink = realCreateInMemoryAuditSink();
    const deps: RealProcessAlertDeps = {
      openIncidents: [],
      recentCount: 0,
      ratePolicy: SAMPLE_RATE_POLICY,
      recipientTz: SAMPLE_TZ,
      quietPolicy: QUIET_POLICY,
      now: new Date(SAMPLE_NOW_BUSINESS),
      channels: SAMPLE_CHANNELS.map((name) => realCreateCaptureChannel(name)),
      auditSink,
      ...overrides,
    };
    const result = await realProcessAlert(event, deps);
    return { result, auditRows: auditSink.rows };
  }

  test("delivered: matches outcome and per-channel results", async () => {
    const event = makeEvent({ dedupeKey: "dk-deliver" });
    const { result, auditRows } = await runReal(event);
    const mirror = processAlert(event, {
      openIncidents: [],
      recentCount: 0,
      ratePolicy: SAMPLE_RATE_POLICY,
      recipientTz: SAMPLE_TZ,
      quietPolicy: QUIET_POLICY,
      now: new Date(SAMPLE_NOW_BUSINESS),
      channels: SAMPLE_CHANNELS,
    });
    expect(mirror.outcome).toBe(result.outcome);
    expect(mirror.outcome).toBe("delivered");
    expect(mirror.deliveries.map((d) => d.channel)).toEqual(
      result.deliveries.map((d) => d.channel),
    );
    expect(mirror.deliveries.every((d) => d.ok)).toBe(
      result.deliveries.every((d) => d.ok),
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.outcome).toBe("delivered");
  });

  test("suppressed: a dedupeKey already open matches the real suppress path", async () => {
    const event = makeEvent({ dedupeKey: "dk-dup" });
    const openIncidents = [{ dedupeKey: "dk-dup" }];
    const { result } = await runReal(event, { openIncidents });
    const mirror = processAlert(event, {
      openIncidents,
      recentCount: 0,
      ratePolicy: SAMPLE_RATE_POLICY,
      recipientTz: SAMPLE_TZ,
      quietPolicy: QUIET_POLICY,
      now: new Date(SAMPLE_NOW_BUSINESS),
      channels: SAMPLE_CHANNELS,
    });
    expect(mirror.outcome).toBe(result.outcome);
    expect(mirror.outcome).toBe("suppressed");
  });

  test("digested: recentCount at the cap matches the real rate-cap path", async () => {
    const event = makeEvent({ dedupeKey: "dk-flood" });
    const { result } = await runReal(event, {
      recentCount: SAMPLE_RATE_POLICY.maxPerWindow,
    });
    const mirror = processAlert(event, {
      openIncidents: [],
      recentCount: SAMPLE_RATE_POLICY.maxPerWindow,
      ratePolicy: SAMPLE_RATE_POLICY,
      recipientTz: SAMPLE_TZ,
      quietPolicy: QUIET_POLICY,
      now: new Date(SAMPLE_NOW_BUSINESS),
      channels: SAMPLE_CHANNELS,
    });
    expect(mirror.outcome).toBe(result.outcome);
    expect(mirror.outcome).toBe("digested");
  });

  test("held: the quiet-hours clock matches the real quiet-hours path", async () => {
    const event = makeEvent({ dedupeKey: "dk-quiet" });
    const { result } = await runReal(event, {
      now: new Date(SAMPLE_NOW_QUIET),
    });
    const mirror = processAlert(event, {
      openIncidents: [],
      recentCount: 0,
      ratePolicy: SAMPLE_RATE_POLICY,
      recipientTz: SAMPLE_TZ,
      quietPolicy: QUIET_POLICY,
      now: new Date(SAMPLE_NOW_QUIET),
      channels: SAMPLE_CHANNELS,
    });
    expect(mirror.outcome).toBe(result.outcome);
    expect(mirror.outcome).toBe("held");
  });
});

describe("session replay: send once -> duplicate -> flood -> toggle quiet hours (runnable self-check)", () => {
  test("send once delivers a fresh alert", () => {
    const { result, session } = sendOnceStep(initAlertSession());
    expect(result.outcome).toBe("delivered");
    expect(session.recentCount).toBe(1);
    expect(session.openIncidents).toHaveLength(1);
  });

  test("send duplicate replays the last dedupeKey and suppresses", () => {
    const { session: afterOnce } = sendOnceStep(initAlertSession());
    const duplicate = sendDuplicateStep(afterOnce);
    expect(duplicate).not.toBeNull();
    if (duplicate === null) return;
    expect(duplicate.result.outcome).toBe("suppressed");
    // A suppressed send does not consume rate-cap headroom.
    expect(duplicate.session.recentCount).toBe(afterOnce.recentCount);
  });

  test("send duplicate before anything was sent returns null", () => {
    expect(sendDuplicateStep(initAlertSession())).toBeNull();
  });

  test("flood trips the rate cap to digest partway through the burst", () => {
    const { results, trippedAtSend, session } = floodStep(initAlertSession());
    expect(results).toHaveLength(FLOOD_BURST_COUNT);
    expect(trippedAtSend).not.toBeNull();
    // Deterministic given a fresh session: the cap trips one send past maxPerWindow.
    expect(trippedAtSend).toBe(SAMPLE_RATE_POLICY.maxPerWindow + 1);
    expect(
      results.slice(trippedAtSend ?? 0).every((r) => r.outcome === "digested"),
    ).toBe(true);
    expect(session.recentCount).toBe(FLOOD_BURST_COUNT);
  });

  test("toggle quiet hours holds a fresh warning alert, then toggling back delivers", () => {
    const held = toggleQuietStep(initAlertSession());
    expect(held.session.quietMode).toBe("quiet");
    expect(held.result.outcome).toBe("held");

    const delivered = toggleQuietStep(held.session);
    expect(delivered.session.quietMode).toBe("business");
    expect(delivered.result.outcome).toBe("delivered");
  });

  test("reset returns to the initial session shape", () => {
    const { session } = sendOnceStep(initAlertSession());
    expect(session.audit).toHaveLength(1);
    expect(initAlertSession()).toEqual({
      openIncidents: [],
      recentCount: 0,
      quietMode: "business",
      audit: [],
      sendCounter: 0,
      lastEvent: null,
    });
  });
});
