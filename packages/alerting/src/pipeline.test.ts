import { describe, expect, test } from "bun:test";
import { dedup, quietHours, rateCap } from "./index.ts";
import type { AlertEvent } from "./index.ts";

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

describe("dedup", () => {
  test("suppresses a repeat dedupeKey against an open incident", () => {
    const event = makeEvent({ dedupeKey: "dk_repeat" });
    expect(dedup(event, [{ dedupeKey: "dk_repeat" }])).toBe(true);
  });

  test("does not suppress when no open incident shares the dedupeKey", () => {
    const event = makeEvent({ dedupeKey: "dk_fresh" });
    expect(dedup(event, [{ dedupeKey: "dk_other" }])).toBe(false);
    expect(dedup(event, [])).toBe(false);
  });
});

describe("rateCap", () => {
  test("delivers below the cap and flips to digest at the cap", () => {
    const event = makeEvent();
    const policy = { maxPerWindow: 3 };
    expect(rateCap(event, 2, policy)).toBe("deliver");
    expect(rateCap(event, 3, policy)).toBe("digest");
    expect(rateCap(event, 4, policy)).toBe("digest");
  });
});

describe("quietHours", () => {
  // UTC (a fixed, unambiguous zone with no DST) keeps this test deterministic.
  const policy = { startHour: 22, endHour: 6 };

  test("holds inside the quiet window", () => {
    const event = makeEvent({ severity: "warning" });
    const now = new Date("2026-01-01T23:00:00.000Z"); // 23:00 UTC -> inside 22-06
    expect(quietHours(event, "UTC", policy, now)).toBe("hold");
  });

  test("delivers outside the quiet window", () => {
    const event = makeEvent({ severity: "warning" });
    const now = new Date("2026-01-01T12:00:00.000Z"); // 12:00 UTC -> outside 22-06
    expect(quietHours(event, "UTC", policy, now)).toBe("deliver");
  });

  test("a critical event always overrides the quiet window", () => {
    const event = makeEvent({ severity: "critical" });
    const now = new Date("2026-01-01T23:00:00.000Z"); // inside the same quiet window
    expect(quietHours(event, "UTC", policy, now)).toBe("deliver");
  });
});
