// Direct coverage of the shared generic mechanics (fixed-window charge/prune + clientIp). A
// consuming service wraps this same class in its own thin per-service bucket-name wrapper — this
// file proves the shared class works standalone, generic over an arbitrary bucket-name union.
import { describe, expect, test } from "bun:test";
import {
  clientIp,
  TokenBucketLimiter,
  type TokenBucketLimiterConfig,
} from "./token-bucket.ts";

type Bucket = "a" | "b";

const CONFIG: TokenBucketLimiterConfig<Bucket> = {
  perIp: {
    a: { capacity: 2, windowMs: 60_000 },
    b: { capacity: 1, windowMs: 60_000 },
  },
  global: {
    a: { capacity: 100_000, windowMs: 60_000 },
    b: { capacity: 100_000, windowMs: 60_000 },
  },
  maxEntries: 1000,
};

describe("TokenBucketLimiter", () => {
  test("allows up to capacity then denies, with a positive retryAfterSec", () => {
    const limiter = new TokenBucketLimiter(CONFIG, () => 0);
    const ip = "203.0.113.7";
    expect(limiter.check("a", ip).allowed).toBe(true);
    expect(limiter.check("a", ip).allowed).toBe(true);
    const denied = limiter.check("a", ip);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  test("refills at the window boundary (injected clock)", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter(CONFIG, () => now);
    const ip = "203.0.113.8";
    limiter.check("b", ip);
    expect(limiter.check("b", ip).allowed).toBe(false);
    now = 60_000;
    expect(limiter.check("b", ip).allowed).toBe(true);
  });

  test("buckets and IPs are independent", () => {
    const limiter = new TokenBucketLimiter(CONFIG, () => 0);
    limiter.check("b", "10.0.0.1");
    expect(limiter.check("b", "10.0.0.1").allowed).toBe(false);
    expect(limiter.check("b", "10.0.0.2").allowed).toBe(true); // different IP
    expect(limiter.check("a", "10.0.0.1").allowed).toBe(true); // different bucket, same IP
  });

  test("checkGlobal bounds aggregate throughput across distinct IPs", () => {
    const limiter = new TokenBucketLimiter(
      {
        ...CONFIG,
        global: { ...CONFIG.global, b: { capacity: 2, windowMs: 60_000 } },
      },
      () => 0,
    );
    expect(limiter.check("b", "10.0.0.1").allowed).toBe(true);
    expect(limiter.checkGlobal("b").allowed).toBe(true);
    expect(limiter.check("b", "10.0.0.2").allowed).toBe(true);
    expect(limiter.checkGlobal("b").allowed).toBe(true);
    // A fresh IP's per-IP bucket is untouched, but the global ceiling is spent.
    expect(limiter.check("b", "10.0.0.99").allowed).toBe(true);
    expect(limiter.checkGlobal("b").allowed).toBe(false);
  });

  test("map stays bounded under a spray of distinct IPs", () => {
    const limiter = new TokenBucketLimiter(
      { ...CONFIG, maxEntries: 10 },
      () => 0,
    );
    for (let i = 0; i < 1000; i += 1) limiter.check("a", `198.51.100.${i}`);
    expect(limiter.check("a", "198.51.100.999").allowed).toBe(true);
  });
});

describe("clientIp", () => {
  test("trusts X-Real-IP", () => {
    const req = new Request("http://x.test/", {
      headers: { "x-real-ip": "203.0.113.5" },
    });
    expect(clientIp(req)).toBe("203.0.113.5");
  });

  test("ignores forwarded-for style headers", () => {
    const spoofed = new Request("http://x.test/", {
      headers: {
        "x-envoy-external-address": "6.6.6.6",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });
    expect(clientIp(spoofed)).toBe("unknown");
  });

  test("missing header collapses to the shared 'unknown' sentinel", () => {
    expect(clientIp(new Request("http://x.test/"))).toBe("unknown");
  });
});
