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

const CONFIG: RateLimitConfig = {
  query: { capacity: 3, windowMs: 60_000 },
  static: { capacity: 5, windowMs: 60_000 },
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
  test("takes the RIGHTMOST x-forwarded-for hop, never the leftmost", () => {
    const req = new Request("http://docs.test/llms.txt", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.1.2.3, 10.0.0.9" },
    });
    expect(clientIp(req)).toBe("10.0.0.9");
  });

  test("a client-spoofed leftmost hop does not change the derived IP", () => {
    // The client controls every hop except the one the edge proxy itself appends last. Prepending
    // an attacker-chosen leftmost value must have zero effect on the derived identity.
    const spoofed = new Request("http://docs.test/llms.txt", {
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.5" },
    });
    const unspoofed = new Request("http://docs.test/llms.txt", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(clientIp(spoofed)).toBe(clientIp(unspoofed));
    expect(clientIp(spoofed)).toBe("203.0.113.5");
  });

  test("X-Envoy-External-Address, when present, wins over x-forwarded-for entirely", () => {
    const req = new Request("http://docs.test/llms.txt", {
      headers: {
        "x-envoy-external-address": "198.51.100.1",
        "x-forwarded-for": "9.9.9.9, 8.8.8.8",
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
    expect(c.maxEntries).toBe(10_000);
  });

  test("overrides from env", () => {
    const c = loadRateLimitConfig({
      DOCS_RL_QUERY_BURST: "5",
      DOCS_RL_QUERY_WINDOW_SEC: "30",
    });
    expect(c.query.capacity).toBe(5);
    expect(c.query.windowMs).toBe(30_000);
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
      headers: { "x-forwarded-for": ip },
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
        {
          query: { capacity: 1, windowMs: 60_000 },
          static: { capacity: 2, windowMs: 60_000 },
          maxEntries: 100,
        },
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

  test("a spoofed leftmost x-forwarded-for hop does not mint a fresh bucket", async () => {
    // The attacker rotates the LEFTMOST hop on every request while the edge-appended rightmost hop
    // (the real, unforgeable identity) stays fixed. If clientIp still trusted the leftmost entry,
    // each request below would land in its OWN bucket and never be throttled — the exact bypass the
    // HIGH finding described. With the rightmost-hop fix, all three collapse onto one bucket.
    const index = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const app = createApp({
      index,
      llmsTxt: "# Caisson\n",
      llmsFull: "# Full\n",
      token: TOKEN,
      limiter: new TokenBucketLimiter(
        {
          query: { capacity: 1, windowMs: 60_000 },
          static: { capacity: 2, windowMs: 60_000 },
          maxEntries: 100,
        },
        () => 0,
      ),
    });
    const realIp = "203.0.113.51";
    const spoofedReq = (fakeLeftHop: string): Request =>
      new Request("http://docs.test/llms.txt", {
        headers: { "x-forwarded-for": `${fakeLeftHop}, ${realIp}` },
      });
    expect((await app(spoofedReq("1.1.1.1"))).status).toBe(200);
    expect((await app(spoofedReq("2.2.2.2"))).status).toBe(200);
    const third = await app(spoofedReq("3.3.3.3"));
    expect(third.status).toBe(429);
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
        {
          query: { capacity: 1, windowMs: 60_000 },
          static: { capacity: 1, windowMs: 60_000 },
          maxEntries: 100,
        },
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
      },
    });
    const res = await app(reqLlms("203.0.113.99"));
    expect(res.status).toBe(200);
    index.close();
  });
});
