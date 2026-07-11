// Unit tests for the CAISSON-55 fail-open rate-limit helper. The native Cloudflare binding itself
// isn't available under `bun test` (it's a Workers-runtime-only API) — these drive `rateLimit()`
// against an injected fake binding, exactly the way deploy-entry.test.ts / npm-routes.test.ts inject
// fake R2 buckets for the same reason. The live 429 (a real binding actually denying) is a post-DEPLOY
// operator curl-prove, not something this suite can exercise.
import { describe, expect, test } from "bun:test";
import {
  clientIpKey,
  type RateLimiterBinding,
  rateLimit,
  rateLimitedResponse,
} from "./rate-limit";

const req = (headers?: Record<string, string>): Request =>
  new Request("https://registry.caisson.sh/", { headers });

describe("clientIpKey (CAISSON-55)", () => {
  test("keys on cf-connecting-ip, the Worker's canonical client IP", () => {
    expect(clientIpKey(req({ "cf-connecting-ip": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });

  test("does NOT fall back to x-real-ip — that header belongs to the site's proxy, not this edge Worker", () => {
    expect(clientIpKey(req({ "x-real-ip": "203.0.113.7" }))).toBe("unknown");
  });

  test("falls back to a shared bucket when no edge IP header is present", () => {
    expect(clientIpKey(req())).toBe("unknown");
  });
});

describe("rateLimit (fail-open, CAISSON-55/ADR-0112 precedent)", () => {
  test("a missing binding (not yet provisioned) fails OPEN", async () => {
    const result = await rateLimit(undefined, req());
    expect(result.ok).toBe(true);
  });

  test("a binding that throws (limiter outage) fails OPEN, never blocks the request", async () => {
    const throwing: RateLimiterBinding = {
      limit: () => {
        throw new Error("rate limiting API unavailable");
      },
    };
    const result = await rateLimit(throwing, req());
    expect(result.ok).toBe(true);
  });

  test("a binding whose limit() promise rejects also fails OPEN", async () => {
    const rejecting: RateLimiterBinding = {
      limit: async () => {
        throw new Error("network error");
      },
    };
    const result = await rateLimit(rejecting, req());
    expect(result.ok).toBe(true);
  });

  test("a present binding that answers success:true is allowed", async () => {
    const allowing: RateLimiterBinding = {
      limit: async () => ({ success: true }),
    };
    const result = await rateLimit(allowing, req());
    expect(result.ok).toBe(true);
  });

  test("a malformed answer (missing/undefined success) fails OPEN, not closed", async () => {
    // Deliberately violates the RateLimiterBinding return shape to prove the runtime guard (a real
    // binding answering garbage), not the type — cast, not `any`, and confined to this one test double.
    const malformed = {
      limit: async () => ({}),
    } as unknown as RateLimiterBinding;
    const result = await rateLimit(malformed, req());
    expect(result.ok).toBe(true);
  });

  test("a present binding that answers success:false is a genuine deny", async () => {
    const denying: RateLimiterBinding = {
      limit: async () => ({ success: false }),
    };
    const result = await rateLimit(denying, req());
    expect(result.ok).toBe(false);
  });

  test("the key passed to limit() is the caller's cf-connecting-ip", async () => {
    let seenKey: string | undefined;
    const spy: RateLimiterBinding = {
      limit: async (opts) => {
        seenKey = opts.key;
        return { success: true };
      },
    };
    await rateLimit(spy, req({ "cf-connecting-ip": "198.51.100.42" }));
    expect(seenKey).toBe("198.51.100.42");
  });
});

describe("rateLimitedResponse (catalog-class 429)", () => {
  test("429 with the security-header + no-store convention every other route class uses", async () => {
    const res = rateLimitedResponse();
    expect(res.status).toBe(429);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    // CAISSON-87: clients back off on Retry-After; 60 = the wrangler.toml [[ratelimits]] period.
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });
});
