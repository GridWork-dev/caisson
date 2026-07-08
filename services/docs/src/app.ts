// src/app.ts — the HTTP router (ADR-0096), a pure `Request → Response` function over injected deps so
// it is trivially testable without a live socket. Public read surfaces (health + the llms artifacts);
// the retrieval endpoint POST /query is Bearer-gated (timing-safe). Every response carries the security
// headers from the standard security floor (nosniff / frame-deny / HSTS). No CORS header is set — this
// is a server-to-server contract for the support-bot, not a browser surface.
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { withRequestSpan } from "@caisson/observability";
import type { DocsIndex } from "./index-store.ts";
import { clientIp, type RateBucket, type RateLimiter } from "./rate-limit.ts";

export interface AppDeps {
  index: DocsIndex;
  llmsTxt: string;
  llmsFull: string;
  /** Bearer secret for POST /query. Must be non-empty — server.ts fails closed if it is unset. */
  token: string;
  /** Per-IP token-bucket limiter (hardening #1). Static routes get a looser budget than POST /query. */
  limiter: RateLimiter;
}

/** POST /query body. `.strict()` rejects unknown fields; query + k are bounded (no unbounded compute). */
const QuerySchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    k: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

// The /llms*.txt artifacts are byte-stable (rebuilt only at boot from the committed corpus), so they are
// safe to cache at the edge/CDN — this lets Railway/a fronting CDN absorb repeat scrapes instead of every
// hit reaching the origin. NOT applied to POST /query (dynamic, retrieval-dependent).
const LLMS_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=3600",
};

function respond(
  body: string,
  status: number,
  contentType: string,
  extra?: Record<string, string>,
): Response {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": contentType, ...extra },
  });
}

const json = (data: unknown, status = 200): Response =>
  respond(JSON.stringify(data), status, "application/json; charset=utf-8");
const text = (
  body: string,
  status = 200,
  extra?: Record<string, string>,
): Response => respond(body, status, "text/plain; charset=utf-8", extra);

/**
 * Timing-safe Bearer check. `DOCS_SERVICE_TOKEN` is an opaque secret of not-guaranteed-fixed length, so
 * per the security floor's VARIABLE-LENGTH rule both sides are SHA-256-digested to fixed 32-byte buffers
 * before `timingSafeEqual` — this avoids the equal-length guard, which would leak the token's byte length
 * to a remote timing oracle (an attacker could binary-search the length). Normalization is identical on
 * both sides (raw bytes), so only the value is compared.
 */
function authorized(req: Request, token: string): boolean {
  if (token.length === 0) return false; // unconfigured ⇒ fail closed
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

/** Build the request handler. Async because /query awaits retrieval. */
export function createApp(deps: AppDeps): (req: Request) => Promise<Response> {
  /**
   * Per-IP rate gate. Returns a 429 Response when the bucket is exhausted, or `null` to proceed. FAILS OPEN
   * on any limiter internal error (logs to stderr — never silently disables the limiter) so a limiter bug
   * can never take a public route offline.
   */
  const rateLimited = (bucket: RateBucket, req: Request): Response | null => {
    try {
      // Per-IP FIRST, so per-IP abuse stays isolated to the abuser's own bucket. Only a per-IP-ALLOWED
      // request then charges the header-independent service-wide ceiling (Strix vuln-0001 defense-in-
      // depth) — charging global first would let one throttled IP drain it and 429 everyone else
      // (self-DoS amplification). Deny if EITHER trips.
      const decision = deps.limiter.check(bucket, clientIp(req));
      if (!decision.allowed) {
        return text("rate limit exceeded", 429, {
          "Retry-After": String(decision.retryAfterSec),
        });
      }
      const global = deps.limiter.checkGlobal(bucket);
      if (!global.allowed) {
        return text("rate limit exceeded", 429, {
          "Retry-After": String(global.retryAfterSec),
        });
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[service-docs] rate-limiter error (failing open): ${msg}\n`,
      );
      return null;
    }
  };

  return withRequestSpan(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    // /health is intentionally NOT rate-limited — liveness/readiness probes must never be throttled.
    if (pathname === "/health") {
      return method === "GET"
        ? json({ ok: true, chunks: deps.index.size })
        : text("method not allowed", 405);
    }
    if (pathname === "/llms.txt") {
      if (method !== "GET") return text("method not allowed", 405);
      return (
        rateLimited("static", req) ??
        text(deps.llmsTxt, 200, LLMS_CACHE_HEADERS)
      );
    }
    if (pathname === "/llms-full.txt") {
      if (method !== "GET") return text("method not allowed", 405);
      return (
        rateLimited("static", req) ??
        text(deps.llmsFull, 200, LLMS_CACHE_HEADERS)
      );
    }
    if (pathname === "/query") {
      if (method !== "POST") return text("method not allowed", 405);
      // Rate-gate BEFORE the expensive retrieval work below: an unauthenticated flood is the
      // cost-DoS vector we are capping, and EVERY request — authorized or not — is still
      // charged some bucket here (auth never exempts a caller from rate-limiting). A caller
      // presenting the correct Bearer is charged the bigger "trustedQuery" lane instead of the
      // tight anonymous one (G22 follow-up: the support-bot funnels its whole Discord
      // community through one shared egress IP, so the anonymous per-IP budget was
      // collectively squeezing many distinct real users). The Bearer check itself is a cheap
      // O(1) hash compare, not the resource this ordering protects, so doing it before the
      // rate gate doesn't reopen the cost-DoS the ordering guards against.
      const isAuthorized = authorized(req, deps.token);
      const limited = rateLimited(isAuthorized ? "trustedQuery" : "query", req);
      if (limited !== null) return limited;
      if (!isAuthorized) return json({ error: "unauthorized" }, 401);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = QuerySchema.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid query", issues: parsed.error.issues },
          400,
        );
      }
      const chunks = await deps.index.search(
        parsed.data.query,
        parsed.data.k ?? 5,
      );
      return json({ chunks });
    }

    return json({ error: "not found" }, 404);
  });
}
