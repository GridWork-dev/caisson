// Unit coverage for the license per-IP token-bucket limiter (services-hardening #4): config parsing
// (defaults + fail-closed on bad env), bucket exhaustion + window reset (injected clock), and clientIp.
import { describe, expect, test } from "bun:test";
import {
  clientIp,
  loadRateLimitConfig,
  TokenBucketLimiter,
} from "./rate-limit.ts";

describe("loadRateLimitConfig", () => {
  test("applies safe defaults when env is empty", () => {
    const c = loadRateLimitConfig({});
    expect(c.webhook).toEqual({ capacity: 120, windowMs: 60_000 });
    expect(c.issue).toEqual({ capacity: 60, windowMs: 60_000 });
    // global ceilings = per-IP burst × the default factor (50).
    expect(c.globalWebhook.capacity).toBe(120 * 50);
    expect(c.globalIssue.capacity).toBe(60 * 50);
    expect(c.maxEntries).toBe(10_000);
  });

  test("a blank var falls back to the default; a valid override is honored", () => {
    const c = loadRateLimitConfig({
      LICENSE_RL_WEBHOOK_BURST: "  ",
      LICENSE_RL_ISSUE_BURST: "5",
      LICENSE_RL_GLOBAL_FACTOR: "10",
    });
    expect(c.webhook.capacity).toBe(120);
    expect(c.issue.capacity).toBe(5);
    expect(c.globalIssue.capacity).toBe(5 * 10);
  });

  test("a present-but-invalid var fails closed (throws)", () => {
    expect(() =>
      loadRateLimitConfig({ LICENSE_RL_WEBHOOK_BURST: "0" }),
    ).toThrow();
    expect(() =>
      loadRateLimitConfig({ LICENSE_RL_ISSUE_WINDOW_SEC: "-3" }),
    ).toThrow();
    expect(() =>
      loadRateLimitConfig({ LICENSE_RL_MAX_ENTRIES: "nope" }),
    ).toThrow();
  });
});

describe("TokenBucketLimiter", () => {
  const cfg = (over: {
    webhook?: { capacity: number; windowMs: number };
    issue?: { capacity: number; windowMs: number };
    globalWebhook?: { capacity: number; windowMs: number };
    globalIssue?: { capacity: number; windowMs: number };
  }) => ({
    webhook: over.webhook ?? { capacity: 2, windowMs: 60_000 },
    issue: over.issue ?? { capacity: 1, windowMs: 60_000 },
    // Generous globals so per-IP tests exercise the per-IP budget.
    globalWebhook: over.globalWebhook ?? {
      capacity: 100_000,
      windowMs: 60_000,
    },
    globalIssue: over.globalIssue ?? { capacity: 100_000, windowMs: 60_000 },
    maxEntries: 100,
  });

  test("allows up to capacity then 429s, with a positive retryAfter", () => {
    const limiter = new TokenBucketLimiter(cfg({}));
    expect(limiter.check("webhook", "ip").allowed).toBe(true);
    expect(limiter.check("webhook", "ip").allowed).toBe(true);
    const denied = limiter.check("webhook", "ip");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    // A different ip has its own bucket.
    expect(limiter.check("webhook", "other").allowed).toBe(true);
  });

  test("the bucket refills at the window boundary (injected clock)", () => {
    let now = 1_000;
    const limiter = new TokenBucketLimiter(
      cfg({
        webhook: { capacity: 1, windowMs: 1_000 },
        issue: { capacity: 1, windowMs: 1_000 },
      }),
      () => now,
    );
    expect(limiter.check("issue", "ip").allowed).toBe(true);
    expect(limiter.check("issue", "ip").allowed).toBe(false);
    now += 1_000; // advance past the window
    expect(limiter.check("issue", "ip").allowed).toBe(true);
  });

  test("checkGlobal bounds aggregate throughput across distinct IPs (Strix vuln-0001)", () => {
    const limiter = new TokenBucketLimiter(
      cfg({ globalIssue: { capacity: 3, windowMs: 60_000 } }),
      () => 0,
    );
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.check("issue", `10.0.0.${i}`).allowed).toBe(true);
      expect(limiter.checkGlobal("issue").allowed).toBe(true);
    }
    // A new IP's per-IP bucket is fresh, but the global ceiling is spent.
    expect(limiter.check("issue", "10.0.0.99").allowed).toBe(true);
    expect(limiter.checkGlobal("issue").allowed).toBe(false);
  });
});

describe("clientIp", () => {
  test("trusts X-Real-IP (Railway edge-set, non-spoofable)", () => {
    const req = new Request("http://x.test/", {
      headers: { "x-real-ip": "203.0.113.7" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  test("IGNORES x-envoy-external-address and x-forwarded-for (Strix vuln-0001)", () => {
    const spoofed = new Request("http://x.test/", {
      headers: {
        "x-envoy-external-address": "6.6.6.6",
        "x-forwarded-for": "9.9.9.9, 8.8.8.8",
      },
    });
    expect(clientIp(spoofed)).toBe("unknown");
  });

  test("X-Real-IP wins even if spoofable headers are also present", () => {
    const req = new Request("http://x.test/", {
      headers: {
        "x-real-ip": "198.51.100.1",
        "x-envoy-external-address": "6.6.6.6",
        "x-forwarded-for": "9.9.9.9",
      },
    });
    expect(clientIp(req)).toBe("198.51.100.1");
  });

  test("collapses a missing header onto a shared 'unknown' bucket", () => {
    expect(clientIp(new Request("http://x.test/"))).toBe("unknown");
  });
});
