// ADR-0316 W-PRODUCT — the PostHog client's env gate + the pure snapshot fold. The env gate is the
// load-bearing "inert when unconfigured, never opens a socket" invariant; the fold is the column-
// index → panel mapping (tested without live IO via the exported pure builder).
import { afterEach, describe, expect, test } from "bun:test";
import {
  buildProductSnapshot,
  fetchProductSnapshot,
  posthogConfigured,
} from "./posthog-reads.ts";

const KEYS = ["POSTHOG_QUERY_KEY", "POSTHOG_PROJECT_ID"] as const;

function clearEnv(): void {
  for (const k of KEYS) delete process.env[k];
}

afterEach(clearEnv);

describe("posthogConfigured (env gate)", () => {
  test("false when neither env is set", () => {
    clearEnv();
    expect(posthogConfigured()).toBe(false);
  });

  test("false when only one of the pair is set", () => {
    clearEnv();
    process.env.POSTHOG_QUERY_KEY = "phx_test";
    expect(posthogConfigured()).toBe(false);
    clearEnv();
    process.env.POSTHOG_PROJECT_ID = "493539";
    expect(posthogConfigured()).toBe(false);
  });

  test("true only when both are set", () => {
    process.env.POSTHOG_QUERY_KEY = "phx_test";
    process.env.POSTHOG_PROJECT_ID = "493539";
    expect(posthogConfigured()).toBe(true);
  });
});

describe("fetchProductSnapshot (dormant short-circuit)", () => {
  test("returns the not-configured dormant snapshot without any fetch", async () => {
    clearEnv();
    const snap = await fetchProductSnapshot();
    expect(snap).toEqual({
      configured: false,
      reachable: true,
      purchaseCount: 0,
      recentPurchases: [],
      confidence: [],
    });
  });
});

describe("buildProductSnapshot (pure fold)", () => {
  test("null count matrix (hard failure) → reachable false, honest empties", () => {
    const snap = buildProductSnapshot(null, null, null);
    expect(snap.configured).toBe(true);
    expect(snap.reachable).toBe(false);
    expect(snap.purchaseCount).toBe(0);
    expect(snap.recentPurchases).toEqual([]);
    expect(snap.confidence).toEqual([]);
  });

  test("configured + reachable with zero events stays an honest empty (never fabricated)", () => {
    const snap = buildProductSnapshot([[0]], [], []);
    expect(snap.reachable).toBe(true);
    expect(snap.purchaseCount).toBe(0);
    expect(snap.recentPurchases).toEqual([]);
    expect(snap.confidence).toEqual([]);
  });

  test("maps count, recent rows, and the confidence distribution by column index", () => {
    const snap = buildProductSnapshot(
      [[3]],
      [
        ["2026-07-10 12:00:00", "user_a"],
        ["2026-07-09 09:30:00", "user_b"],
      ],
      [
        ["high", 5],
        ["low", 2],
      ],
    );
    expect(snap.purchaseCount).toBe(3);
    expect(snap.recentPurchases).toEqual([
      { timestamp: "2026-07-10 12:00:00", distinctId: "user_a" },
      { timestamp: "2026-07-09 09:30:00", distinctId: "user_b" },
    ]);
    expect(snap.confidence).toEqual([
      { bucket: "high", count: 5 },
      { bucket: "low", count: 2 },
    ]);
  });

  test("a null/absent confidence bucket renders as an em-dash, not a fabricated label", () => {
    const snap = buildProductSnapshot([[1]], [], [[null, 4]]);
    expect(snap.confidence).toEqual([{ bucket: "—", count: 4 }]);
  });
});
