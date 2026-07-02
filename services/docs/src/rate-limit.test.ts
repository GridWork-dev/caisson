import { describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";
import { FakeEmbedder } from "./embedder.ts";
import { DocsIndex } from "./index-store.ts";
import {
  clientIp,
  loadRateLimitConfig,
  TokenBucketLimiter,
  type RateLimitConfig,
} from "./rate-limit.ts";
import type { DocChunk } from "./types.ts";

// Generous global ceilings so the per-IP tests below exercise the per-IP budget, not the global cap.
const CONFIG: RateLimitConfig = {
  query: { capacity: 3, windowMs: 60_000 },
  static: { capacity: 5, windowMs: 60_000 },
  globalQuery: { capacity: 100_000, windowMs: 60_000 },
  globalStatic: { capacity: 100_000, windowMs: 60_000 },
  maxEntries: 1000,
};

describe("TokenBucketLimiter", () => {
  test("burst exceeds the bucket → denied with Retry-After", () => {
    const limiter = new TokenBucketLimiter(CONFIG, () => 0);
    const ip = "203.0.113.7";
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.check("query", ip).allowed).toBe(true);
    }
    const denied = limiter.check("query", ip);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBe(60);
  });

  test("refill after the window → allowed again", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter(CONFIG, () => now);
    const ip = "203.0.113.8";
    for (let i = 0; i < 3; i += 1) limiter.check("query", ip);
    expect(limiter.check("query", ip).allowed).toBe(false);
    now = 60_000; // window boundary elapsed
    expect(limiter.check("query", ip).allowed).toBe(true);
  });

  test("query and static buckets are independent per IP", () => {
    const limiter = new TokenBucketLimiter(CONFIG, () => 0);
    const ip = "203.0.113.9";
    for (let i = 0; i < 3; i += 1) limiter.check("query", ip);
    expect(limiter.check("query", ip).allowed).toBe(false);
    // static bucket for the same IP is untouched.
    expect(limiter.check("static", ip).allowed).toBe(true);
  });

  test("different IPs do not share a bucket", () => {
    const limiter = new TokenBucketLimiter(CONFIG, () => 0);
    for (let i = 0; i < 3; i += 1) limiter.check("query", "10.0.0.1");
    expect(limiter.check("query", "10.0.0.1").allowed).toBe(false);
    expect(limiter.check("query", "10.0.0.2").allowed).toBe(true);
  });

  test("checkGlobal bounds aggregate throughput across distinct IPs (Strix vuln-0001)", () => {
    // The service-wide ceiling holds even when every request carries a DISTINCT client IP — the
    // per-IP bucket is fresh each time, but the global bucket drains and eventually denies.
    const limiter = new TokenBucketLimiter(
      { ...CONFIG, globalQuery: { capacity: 4, windowMs: 60_000 } },
      () => 0,
    );
    for (let i = 0; i < 4; i += 1) {
      expect(limiter.check("query", `203.0.113.${i}`).allowed).toBe(true);
      expect(limiter.checkGlobal("query").allowed).toBe(true);
    }
    // Per-IP is still fresh for a new IP, but the global bucket is now exhausted.
    expect(limiter.check("query", "203.0.113.99").allowed).toBe(true);
    expect(limiter.checkGlobal("query").allowed).toBe(false);
  });

  test("map stays bounded under a spray of distinct IPs", () => {
    const limiter = new TokenBucketLimiter(
      { ...CONFIG, maxEntries: 10 },
      () => 0,
    );
    for (let i = 0; i < 1000; i += 1) limiter.check("query", `198.51.100.${i}`);
    // No throw, no unbounded growth — newest IPs still get a fresh bucket.
    expect(limiter.check("query", "198.51.100.999").allowed).toBe(true);
  });
});

describe("clientIp", () => {
  test("trusts X-Real-IP (Railway edge-set, non-spoofable)", () => {
    const req = new Request("http://docs.test/llms.txt", {
      headers: { "x-real-ip": "203.0.113.5" },
    });
    expect(clientIp(req)).toBe("203.0.113.5");
  });

  test("IGNORES x-envoy-external-address and x-forwarded-for (Strix vuln-0001)", () => {
    // The pentest bypassed the limiter by rotating x-envoy-external-address; both it and XFF are
    // client-appendable, so neither is trusted. With no X-Real-IP, the derived id is the shared
    // "unknown" sentinel regardless of what the client puts in those headers.
    const spoofed = new Request("http://docs.test/llms.txt", {
      headers: {
        "x-envoy-external-address": "6.6.6.6",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });
    expect(clientIp(spoofed)).toBe("unknown");
  });

  test("X-Real-IP wins even if spoofable headers are also present", () => {
    const req = new Request("http://docs.test/llms.txt", {
      headers: {
        "x-real-ip": "198.51.100.1",
        "x-envoy-external-address": "6.6.6.6",
        "x-forwarded-for": "9.9.9.9",
      },
    });
    expect(clientIp(req)).toBe("198.51.100.1");
  });

  test("missing header → 'unknown' sentinel (shared, conservative)", () => {
    expect(clientIp(new Request("http://docs.test/llms.txt"))).toBe("unknown");
  });
});

describe("loadRateLimitConfig", () => {
  test("safe defaults when env is empty", () => {
    const c = loadRateLimitConfig({});
    expect(c.query.capacity).toBe(20);
    expect(c.static.capacity).toBe(120);
    expect(c.query.windowMs).toBe(60_000);
    // global ceilings = per-IP burst × the default factor (50).
    expect(c.globalQuery.capacity).toBe(20 * 50);
    expect(c.globalStatic.capacity).toBe(120 * 50);
    expect(c.maxEntries).toBe(10_000);
  });

  test("overrides from env", () => {
    const c = loadRateLimitConfig({
      DOCS_RL_QUERY_BURST: "5",
      DOCS_RL_QUERY_WINDOW_SEC: "30",
      DOCS_RL_GLOBAL_FACTOR: "10",
    });
    expect(c.query.capacity).toBe(5);
    expect(c.query.windowMs).toBe(30_000);
    expect(c.globalQuery.capacity).toBe(5 * 10);
  });

  test("present-but-invalid value fails closed (throws)", () => {
    expect(() => loadRateLimitConfig({ DOCS_RL_QUERY_BURST: "0" })).toThrow();
    expect(() =>
      loadRateLimitConfig({ DOCS_RL_QUERY_BURST: "nope" }),
    ).toThrow();
  });
});

describe("createApp rate limiting", () => {
  const TOKEN = "test-docs-service-token-0123456789";
  const CHUNKS: DocChunk[] = [
    {
      id: "billing-webhook",
      source: "apps/site/content/docs/base/billing.mdx",
      title: "Billing",
      section: "Webhooks",
      kind: "docs",
      license: "Apache-2.0",
      text: "Billing webhooks are verified with a timing-safe HMAC compare.",
    },
  ];

  const reqLlms = (ip: string): Request =>
    new Request("http://docs.test/llms.txt", {
      headers: { "x-real-ip": ip },
    });

  // A per-IP config with global ceilings high enough not to trip in per-IP-focused tests.
  const perIpConfig = (
    query: { capacity: number; windowMs: number },
    staticCfg: { capacity: number; windowMs: number },
  ): RateLimitConfig => ({
    query,
    static: staticCfg,
    globalQuery: { capacity: 100_000, windowMs: 60_000 },
    globalStatic: { capacity: 100_000, windowMs: 60_000 },
    maxEntries: 100,
  });

  test("static /llms.txt burst over budget → 429 with Retry-After, then 200 after refill", async () => {
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    let now = 0;
    const app = createApp({
      index,
      llmsTxt: "# Caisson\n",
      llmsFull: "# Full\n",
      token: TOKEN,
      limiter: new TokenBucketLimiter(
        perIpConfig(
          { capacity: 1, windowMs: 60_000 },
          { capacity: 2, windowMs: 60_000 },
        ),
        () => now,
      ),
    });
    const ip = "203.0.113.50";
    expect((await app(reqLlms(ip))).status).toBe(200);
    expect((await app(reqLlms(ip))).status).toBe(200);
    const over = await app(reqLlms(ip));
    expect(over.status).toBe(429);
    expect(Number(over.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(over.headers.get("X-Content-Type-Options")).toBe("nosniff");
    now = 60_000;
    expect((await app(reqLlms(ip))).status).toBe(200);
    index.close();
  });

  test("rotating x-envoy-external-address does NOT mint a fresh bucket (Strix vuln-0001)", async () => {
    // The exact pentest bypass: rotate the spoofable header on every request. Since clientIp no
    // longer trusts it (no X-Real-IP present), all requests collapse onto the shared "unknown"
    // bucket and are throttled — 25 rotated-header requests must not all pass.
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const app = createApp({
      index,
      llmsTxt: "# Caisson\n",
      llmsFull: "# Full\n",
      token: TOKEN,
      limiter: new TokenBucketLimiter(
        perIpConfig(
          { capacity: 1, windowMs: 60_000 },
          { capacity: 2, windowMs: 60_000 },
        ),
        () => 0,
      ),
    });
    const rotated = (fakeIp: string): Request =>
      new Request("http://docs.test/llms.txt", {
        headers: { "x-envoy-external-address": fakeIp },
      });
    expect((await app(rotated("1.1.1.1"))).status).toBe(200);
    expect((await app(rotated("2.2.2.2"))).status).toBe(200);
    const third = await app(rotated("3.3.3.3"));
    expect(third.status).toBe(429);
    index.close();
  });

  test("the global ceiling throttles a distributed flood of distinct X-Real-IPs (Strix vuln-0001)", async () => {
    // Even with a legitimate, distinct X-Real-IP per request (so every per-IP bucket is fresh), the
    // header-independent global cap bounds aggregate throughput.
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const app = createApp({
      index,
      llmsTxt: "# Caisson\n",
      llmsFull: "# Full\n",
      token: TOKEN,
      limiter: new TokenBucketLimiter(
        {
          query: { capacity: 10, windowMs: 60_000 },
          static: { capacity: 10, windowMs: 60_000 },
          globalQuery: { capacity: 10, windowMs: 60_000 },
          globalStatic: { capacity: 2, windowMs: 60_000 },
          maxEntries: 100,
        },
        () => 0,
      ),
    });
    expect((await app(reqLlms("203.0.113.1"))).status).toBe(200);
    expect((await app(reqLlms("203.0.113.2"))).status).toBe(200);
    // Third distinct IP: per-IP bucket is fresh, but the global static ceiling (2) is spent.
    expect((await app(reqLlms("203.0.113.3"))).status).toBe(429);
    index.close();
  });

  test("one throttled IP does NOT drain the global bucket for others (Strix vuln-0001 amplification)", async () => {
    // Per-IP static=2, global static=5. A single IP floods 6 requests: 2 pass (per-IP), 4 are per-IP
    // 429s that must NOT consume a global token. A different IP is then still served — the global cap
    // only counts per-IP-ALLOWED traffic, so one abuser can't 429 everyone else.
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const app = createApp({
      index,
      llmsTxt: "# Caisson\n",
      llmsFull: "# Full\n",
      token: TOKEN,
      limiter: new TokenBucketLimiter(
        {
          query: { capacity: 10, windowMs: 60_000 },
          static: { capacity: 2, windowMs: 60_000 },
          globalQuery: { capacity: 100_000, windowMs: 60_000 },
          globalStatic: { capacity: 5, windowMs: 60_000 },
          maxEntries: 100,
        },
        () => 0,
      ),
    });
    const abuser = "203.0.113.7";
    let passed = 0;
    for (let i = 0; i < 6; i += 1) {
      if ((await app(reqLlms(abuser))).status === 200) passed += 1;
    }
    expect(passed).toBe(2); // bounded by the abuser's own per-IP bucket
    // A different client is still served — the abuser's 4 rejected requests never touched the global.
    expect((await app(reqLlms("203.0.113.8"))).status).toBe(200);
    index.close();
  });

  test("/health is never rate-limited", async () => {
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const app = createApp({
      index,
      llmsTxt: "x",
      llmsFull: "y",
      token: TOKEN,
      limiter: new TokenBucketLimiter(
        perIpConfig(
          { capacity: 1, windowMs: 60_000 },
          { capacity: 1, windowMs: 60_000 },
        ),
        () => 0,
      ),
    });
    for (let i = 0; i < 10; i += 1) {
      expect((await app(new Request("http://docs.test/health"))).status).toBe(
        200,
      );
    }
    index.close();
  });

  test("limiter internal error fails OPEN (route still served)", async () => {
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const app = createApp({
      index,
      llmsTxt: "# Caisson\n",
      llmsFull: "# Full\n",
      token: TOKEN,
      limiter: {
        check() {
          throw new Error("simulated limiter fault");
        },
        checkGlobal() {
          throw new Error("simulated limiter fault");
        },
      },
    });
    const res = await app(reqLlms("203.0.113.99"));
    expect(res.status).toBe(200);
    index.close();
  });
});
