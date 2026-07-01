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
    expect(c.maxEntries).toBe(10_000);
  });

  test("a blank var falls back to the default; a valid override is honored", () => {
    const c = loadRateLimitConfig({
      LICENSE_RL_WEBHOOK_BURST: "  ",
      LICENSE_RL_ISSUE_BURST: "5",
    });
    expect(c.webhook.capacity).toBe(120);
    expect(c.issue.capacity).toBe(5);
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
  test("allows up to capacity then 429s, with a positive retryAfter", () => {
    const limiter = new TokenBucketLimiter({
      webhook: { capacity: 2, windowMs: 60_000 },
      issue: { capacity: 1, windowMs: 60_000 },
      maxEntries: 100,
    });
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
      {
        webhook: { capacity: 1, windowMs: 1_000 },
        issue: { capacity: 1, windowMs: 1_000 },
        maxEntries: 100,
      },
      () => now,
    );
    expect(limiter.check("issue", "ip").allowed).toBe(true);
    expect(limiter.check("issue", "ip").allowed).toBe(false);
    now += 1_000; // advance past the window
    expect(limiter.check("issue", "ip").allowed).toBe(true);
  });
});

describe("clientIp", () => {
  test("reads the RIGHTMOST x-forwarded-for hop, never the leftmost", () => {
    const req = new Request("http://x.test/", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("10.0.0.1");
  });

  test("a client-spoofed leftmost hop does not change the derived IP", () => {
    const spoofed = new Request("http://x.test/", {
      headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.7" },
    });
    const unspoofed = new Request("http://x.test/", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    expect(clientIp(spoofed)).toBe(clientIp(unspoofed));
    expect(clientIp(spoofed)).toBe("203.0.113.7");
  });

  test("X-Envoy-External-Address, when present, wins over x-forwarded-for entirely", () => {
    const req = new Request("http://x.test/", {
      headers: {
        "x-envoy-external-address": "198.51.100.1",
        "x-forwarded-for": "9.9.9.9, 8.8.8.8",
      },
    });
    expect(clientIp(req)).toBe("198.51.100.1");
  });

  test("collapses a missing header onto a shared 'unknown' bucket", () => {
    expect(clientIp(new Request("http://x.test/"))).toBe("unknown");
  });
});
