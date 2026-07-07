import { describe, expect, test } from "bun:test";
import { createCaptureChannel } from "@caisson/alerting";
import {
  errorGroupToAlertEvent,
  errorGroupToFinding,
  magnitude,
  severityForCount,
  triageErrors,
} from "./error-triage.ts";
import { InMemoryStore } from "../store.ts";
import type { ErrorGroup } from "../posthog.ts";

describe("magnitude / severityForCount", () => {
  test("magnitude buckets by order of ten", () => {
    expect(magnitude(1)).toBe(0);
    expect(magnitude(9)).toBe(0);
    expect(magnitude(10)).toBe(1);
    expect(magnitude(99)).toBe(1);
    expect(magnitude(100)).toBe(2);
  });

  test("severity escalates with occurrence count", () => {
    expect(severityForCount(1)).toBe("info");
    expect(severityForCount(10)).toBe("warning");
    expect(severityForCount(100)).toBe("critical");
  });
});

const group: ErrorGroup = {
  fingerprint: "fp1",
  name: "TypeError: x is undefined",
  occurrences: 12,
};

describe("errorGroupToFinding", () => {
  test("dedup key encodes fingerprint + magnitude, so a spike into a new magnitude re-keys", () => {
    const low = errorGroupToFinding({ ...group, occurrences: 5 });
    const high = errorGroupToFinding({ ...group, occurrences: 50 });
    expect(low.dedupKey).not.toBe(high.dedupKey);
  });

  test("same magnitude stays the same dedup key", () => {
    const a = errorGroupToFinding({ ...group, occurrences: 12 });
    const b = errorGroupToFinding({ ...group, occurrences: 18 });
    expect(a.dedupKey).toBe(b.dedupKey);
  });
});

describe("errorGroupToAlertEvent", () => {
  test("maps to the operator tenant/recipient with the finding's dedupKey", () => {
    const finding = errorGroupToFinding(group);
    const event = errorGroupToAlertEvent(group, finding, 1_000);
    expect(event.tenantId).toBe("operator");
    expect(event.recipient).toBe("operator");
    expect(event.dedupeKey).toBe(finding.dedupKey);
  });
});

describe("triageErrors", () => {
  test("a fresh group delivers to every channel and returns a finding", async () => {
    const capture = createCaptureChannel();
    const findings = await triageErrors([group], {
      store: new InMemoryStore(),
      channels: [capture],
      ratePolicy: { maxPerWindow: 3 },
      recipientTz: "UTC",
      quietPolicy: { startHour: 0, endHour: 0 },
      now: () => 1_000,
    });
    expect(findings).toHaveLength(1);
    expect(capture.delivered).toHaveLength(1);
  });

  test("an already-open incident for the same dedup key suppresses re-delivery", async () => {
    const store = new InMemoryStore(() => 1_000);
    const finding = errorGroupToFinding(group);
    await store.upsertFinding(finding, "run-1");

    const capture = createCaptureChannel();
    await triageErrors([group], {
      store,
      channels: [capture],
      ratePolicy: { maxPerWindow: 3 },
      recipientTz: "UTC",
      quietPolicy: { startHour: 0, endHour: 0 },
      now: () => 1_000,
    });
    expect(capture.delivered).toHaveLength(0);
  });

  test("a burst past the rate cap digests instead of delivering every one", async () => {
    const groups: ErrorGroup[] = [
      { fingerprint: "a", name: "Error A", occurrences: 5 },
      { fingerprint: "b", name: "Error B", occurrences: 5 },
      { fingerprint: "c", name: "Error C", occurrences: 5 },
      { fingerprint: "d", name: "Error D", occurrences: 5 },
    ];
    const capture = createCaptureChannel();
    await triageErrors(groups, {
      store: new InMemoryStore(),
      channels: [capture],
      ratePolicy: { maxPerWindow: 2 },
      recipientTz: "UTC",
      quietPolicy: { startHour: 0, endHour: 0 },
      now: () => 1_000,
    });
    expect(capture.delivered.length).toBeLessThan(groups.length);
  });

  test("returns a finding for every group even when delivery is suppressed", async () => {
    const store = new InMemoryStore(() => 1_000);
    await store.upsertFinding(errorGroupToFinding(group), "run-1");
    const findings = await triageErrors([group], {
      store,
      channels: [],
      ratePolicy: { maxPerWindow: 3 },
      recipientTz: "UTC",
      quietPolicy: { startHour: 0, endHour: 0 },
      now: () => 1_000,
    });
    expect(findings).toHaveLength(1);
  });
});
