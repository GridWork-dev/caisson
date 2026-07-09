// App-level per-IP rate limiting for the registry read Worker (CAISSON-55). Uses the NATIVE Cloudflare
// Workers Rate Limiting binding (`[[ratelimits]]` in wrangler.toml, `simple` algorithm) — not KV, not a
// Durable Object, not the zone WAF (its one free-tier slot is already spent on /query + /api/auth/* on
// the site). wrangler.toml is the single source of truth for the actual limit/period per route class;
// this module is only the runtime call shape + the fail-open policy shared by every call site.
//
// Fail-OPEN is the binding invariant (ADR-0112 precedent — the buyer-MCP rate limit: "a rate limit is
// abuse-throttling, NOT an auth boundary"): a MISSING binding (not yet provisioned at DEPLOY, mirroring
// the TARBALLS/REVOCATIONS optional-binding pattern in deploy-entry.ts) or ANY thrown error (a limiter
// outage) must never turn into a blocked install. The ONLY path that denies is a genuine bucket-empty
// response from a binding that answered successfully.

/** Structural slice of Cloudflare's `RateLimit` binding — zero `@cloudflare/workers-types` runtime dep,
 *  same convention as the R2 structural types in deploy-entry.ts/npm-routes.ts. `key` can be any string;
 *  every call site here keys on the caller's edge IP (see {@link clientIpKey}). */
export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * The Worker's canonical client IP. `cf-connecting-ip` is set by the Cloudflare edge itself and cannot
 * be spoofed by the caller — NOT `x-real-ip` (that header is the SITE's own reverse-proxy convention,
 * meaningless at this Worker, which sits directly on the CF edge with no proxy in front of it). Absent
 * only in contexts with no real edge request (e.g. a raw `new Request()` in a test); those requests
 * share one "unknown" bucket rather than bypassing the limiter entirely.
 */
export function clientIpKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Fail-open rate-limit check. `ok: false` ONLY when a present binding answers with a genuine deny
 * (`success: false`). `binding === undefined` (not yet provisioned) or the binding THROWING (a transient
 * Rate Limiting API outage) both read as `ok: true` — abuse-throttling degrades silently, an install
 * never breaks because of it.
 */
export async function rateLimit(
  binding: RateLimiterBinding | undefined,
  request: Request,
): Promise<{ ok: boolean }> {
  if (binding === undefined) return { ok: true };
  try {
    const { success } = await binding.limit({ key: clientIpKey(request) });
    return { ok: success };
  } catch {
    // ponytail: fail-open on any limiter error — see the file-level doc comment (ADR-0112 precedent).
    return { ok: true };
  }
}

const RATE_LIMIT_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "cache-control": "private, no-store",
};

/** The 429 response for a denied catalog request (handler.ts's own `json()` helper is private to that
 *  module, and the catalog-class check runs one layer up in deploy-entry.ts — see that file's fetch()).
 *  The npm surface (packument/tarball) instead reuses its OWN already-exported `errorJson` in
 *  npm-routes.ts, so every route class's error shape stays whatever that route class already emits. */
export function rateLimitedResponse(): Response {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: RATE_LIMIT_HEADERS,
  });
}
