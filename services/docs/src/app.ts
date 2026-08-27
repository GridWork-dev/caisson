// src/app.ts — the HTTP router (ADR-0096), a pure `Request → Response` function over injected deps so
// it is trivially testable without a live socket. Public read surfaces (health + the llms artifacts);
// the retrieval endpoint POST /query is Bearer-gated (timing-safe). Every response carries the security
// headers from the standard security floor (nosniff / frame-deny / HSTS). No CORS header is set — this
// is a server-to-server contract for the support-bot, not a browser surface. `/ready` exists only
// after the versioned local artifact validates and opens; it never rebuilds or calls a dependency.
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  loadOriginGateConfig,
  originRequestAuthorized,
  type OriginGateConfig,
} from "@caisson/kernel/node";
import { withRequestSpan } from "@caisson/observability";
import type { DocsIndex } from "./index-store.ts";
import { clientIp, type RateBucket, type RateLimiter } from "./rate-limit.ts";

/** The one path exempt from the origin gate. MUST equal `healthcheckPath` in
 *  services/docs/railway.toml — a test pins the pair, because a drift there silently re-freezes
 *  the fleet deploy with no local signal. */
export const HEALTH_PROBE_PATH = "/health";

export interface AppDeps {
  index: DocsIndex;
  llmsTxt: string;
  llmsFull: string;
  /** Bearer secret for POST /query. Must be non-empty — server.ts fails closed if it is unset. */
  token: string;
  /** Per-IP token-bucket limiter (hardening #1). Static routes get a looser budget than POST /query. */
  limiter: RateLimiter;
  /** Cloudflare Worker origin gate. Omitted only when the runtime loader supplies the config. */
  originGate?: OriginGateConfig;
}

/** POST /query body. `.strict()` rejects unknown fields; query + k are bounded (no unbounded compute). */
// Exported so tools/security/emit-openapi.ts can generate a true-to-code OpenAPI spec for schema
// fuzzing (Schemathesis) without re-declaring the shape.
export const QuerySchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    k: z.number().int().min(1).max(20).optional(),
  })
  .strict();

// Exported for tests and any future response adapter; every production response uses this floor.
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

// The /llms*.txt artifacts are byte-stable (rebuilt only with the versioned artifact), so they are
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
  const originGate = deps.originGate ?? loadOriginGateConfig(process.env);
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

    // Railway's platform healthcheck reaches the container internally and cannot carry the
    // Worker-injected secret, so gating the probe path froze every deploy in the fleet (ADR-0416
    // ruling 1). Exact equality, never a prefix — Railway probes the configured healthcheckPath
    // and nothing else, so exempting more than the literal string widens the carve for no benefit.
    const healthProbe = pathname === HEALTH_PROBE_PATH;
    const originAuthorized = originRequestAuthorized(req, originGate);
    if (!healthProbe && !originAuthorized) {
      return json({ error: "forbidden" }, 403);
    }

    // /health is intentionally NOT rate-limited — liveness/readiness probes must never be throttled.
    if (healthProbe) {
      if (method !== "GET") return text("method not allowed", 405);
      // Corpus size rides only for callers that proved the origin secret. Through the Worker that
      // is every real probe; the raw *.up.railway.app origin the carve admits gets liveness only.
      return json({
        ok: true,
        ...(originAuthorized ? { chunks: deps.index.size } : {}),
      });
    }
    // The router is constructed only after the artifact's strict manifest + checksum validate and
    // its SQLite index opens. Reaching this route therefore proves the required local artifact is
    // ready; it never triggers a rebuild or an external dependency check.
    if (pathname === "/ready") {
      return method === "GET"
        ? json({ ready: true })
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
