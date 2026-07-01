import { describe, expect, test } from "bun:test";
import {
  createCaptureChannel,
  createInMemoryAuditSink,
  processAlert,
} from "./index.ts";
import type { AlertEvent, ProcessAlertDeps } from "./index.ts";

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    id: "evt_1",
    type: "billing.payment_failed",
    severity: "warning",
    tenantId: "tenant_a",
    recipient: "ops@example.com",
    dedupeKey: "dk_1",
    title: "Payment failed",
    body: "Card declined",
    createdAt: 1_750_000_000_000,
    ...overrides,
  };
}

function baseDeps(overrides: Partial<ProcessAlertDeps> = {}): ProcessAlertDeps {
  return {
    openIncidents: [],
    recentCount: 0,
    ratePolicy: { maxPerWindow: 3 },
    recipientTz: "UTC",
    quietPolicy: { startHour: 22, endHour: 6 },
    now: new Date("2026-01-01T12:00:00.000Z"), // outside the quiet window
    channels: [createCaptureChannel()],
    auditSink: createInMemoryAuditSink(),
    ...overrides,
  };
}

describe("processAlert", () => {
  test("delivers and writes an audit row with outcome delivered", async () => {
    const auditSink = createInMemoryAuditSink();
    const channel = createCaptureChannel();
    const event = makeEvent();
    const deps = baseDeps({ auditSink, channels: [channel] });

    const result = await processAlert(event, deps);

    expect(result.outcome).toBe("delivered");
    expect(result.deliveries).toEqual([{ channel: "capture", ok: true }]);
    expect(channel.delivered).toEqual([event]);
    expect(auditSink.rows).toEqual([
      {
        eventId: event.id,
        type: event.type,
        severity: event.severity,
        tenantId: event.tenantId,
        recipient: event.recipient,
        outcome: "delivered",
        channels: [{ channel: "capture", ok: true }],
        at: deps.now.getTime(),
      },
    ]);
  });

  test("suppresses a deduped event and never runs a channel", async () => {
    const auditSink = createInMemoryAuditSink();
    const channel = createCaptureChannel();
    const event = makeEvent({ dedupeKey: "dk_dup" });
    const deps = baseDeps({
      auditSink,
      channels: [channel],
      openIncidents: [{ dedupeKey: "dk_dup" }],
    });

    const result = await processAlert(event, deps);

    expect(result.outcome).toBe("suppressed");
    expect(channel.delivered).toEqual([]);
    expect(auditSink.rows[0]?.outcome).toBe("suppressed");
  });

  test("digests at the rate cap and never runs a channel", async () => {
    const auditSink = createInMemoryAuditSink();
    const channel = createCaptureChannel();
    const event = makeEvent();
    const deps = baseDeps({
      auditSink,
      channels: [channel],
      recentCount: 3,
      ratePolicy: { maxPerWindow: 3 },
    });

    const result = await processAlert(event, deps);

    expect(result.outcome).toBe("digested");
    expect(channel.delivered).toEqual([]);
    expect(auditSink.rows[0]?.outcome).toBe("digested");
  });

  test("holds inside quiet hours and never runs a channel", async () => {
    const auditSink = createInMemoryAuditSink();
    const channel = createCaptureChannel();
    const event = makeEvent({ severity: "warning" });
    const deps = baseDeps({
      auditSink,
      channels: [channel],
      now: new Date("2026-01-01T23:00:00.000Z"), // inside 22-06 UTC
    });

    const result = await processAlert(event, deps);

    expect(result.outcome).toBe("held");
    expect(channel.delivered).toEqual([]);
    expect(auditSink.rows[0]?.outcome).toBe("held");
  });

  test("a critical event overrides quiet hours and still delivers", async () => {
    const channel = createCaptureChannel();
    const event = makeEvent({ severity: "critical" });
    const deps = baseDeps({
      channels: [channel],
      now: new Date("2026-01-01T23:00:00.000Z"), // inside 22-06 UTC
    });

    const result = await processAlert(event, deps);

    expect(result.outcome).toBe("delivered");
    expect(channel.delivered).toEqual([event]);
  });
});
