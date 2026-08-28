// App-wide edge + auth gate. The Cloudflare origin secret and Access JWT layers are armed by
// default; only exact development/test mode opt-outs disable them. Exact `/healthz` is the narrow
// exception: it answers ahead of BOTH edge layers, because Railway's platform healthcheck reaches
// the container internally and can carry neither the Worker-injected origin secret nor an Access
// JWT (ADR-0416 ruling 1 — before this carve every deploy failed at admin's healthcheck and froze
// the whole fleet). The route itself is status-only for unauthenticated callers, so the class the
// carve admits — the raw *.up.railway.app origin the Worker never sees — gets a liveness ping and
// nothing more. Better-auth plus the immutable numeric GitHub-ID allowlist remains the independent
// application authorization layer for every non-bootstrap route.
//
// Named `proxy.ts` (not `middleware.ts`): Next 16 deprecated `middleware.ts` in favor of
// `proxy.ts`, which defaults to the Node.js runtime (no `export const runtime` — Next throws if
// one is set here). That default is load-bearing this time, unlike the old file: verifying a
// better-auth session needs `pg`/`node:crypto`, which never ran in the old file's Edge runtime.
//
// Bootstrap/static routes bypass only the better-auth session check. They still pass through both
// edge layers when armed, except for the exact origin-authenticated `/healthz` canary path above.
import {
  loadOriginGateConfig,
  originRequestAuthorized,
  servingRevision,
  REVISION_HEADER,
  type OriginGateConfig,
} from "@caisson/kernel/node";
import { NextResponse, type NextRequest } from "next/server";
import {
  loadCloudflareAccessConfig,
  verifyCloudflareAccessRequest,
  type CloudflareAccessConfig,
} from "@/lib/cloudflare-access";
import {
  authenticateInternalProofRequest,
  parseInternalProofAuthConfig,
} from "@/lib/internal-proof-auth";
import { verifyAdminSession } from "@/lib/admin-session";

export const config = {
  matcher: ["/:path*"],
};

// The edge layers never replace route authorization. Better-auth/internal-proof checks below stay
// authoritative for app actions, including Server Function POSTs delivered to their host route.

/** Header carrying the verified admin actor email to route handlers (ADR-0220 — unchanged shape;
 *  only the verification mechanism behind it moved from CF-Access-JWT to better-auth+allowlist). */
const ACTOR_HEADER = "x-admin-actor";
const INTERNAL_PROOF_PATH = "/api/internal/audit/proof";

/** The one path exempt from both edge layers. MUST equal `healthcheckPath` in
 *  apps/admin/railway.toml — a test pins the pair, because a drift there silently re-freezes the
 *  fleet deploy with no local signal. */
export const HEALTH_PROBE_PATH = "/healthz";

export interface AdminProxyOptions {
  originGate?: OriginGateConfig;
  access?: CloudflareAccessConfig;
}

function edgeForbidden(): NextResponse {
  return NextResponse.json(
    { error: "forbidden" },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security":
          "max-age=63072000; includeSubDomains; preload",
      },
    },
  );
}

function sessionExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /^\/healthz(?:\/|$)/.test(pathname) ||
    /^\/login(?:\/|$)/.test(pathname) ||
    /^\/api\/auth(?:\/|$)/.test(pathname)
  );
}

// Duplicated from apps/site/proxy.ts rather than shared: @caisson/kernel is framework-agnostic
// (services/docs and services/license run on Bun.serve) and must not import next/server.
export function normalizeTrailingSlash(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  // A plain URL, not nextUrl.clone(): NextURL re-serializes the pathname through its own
  // formatter and hands back the trailing slash we just stripped.
  const url = new URL(req.url);
  url.pathname = pathname.replace(/\/+$/, "") || "/";
  return NextResponse.redirect(url, 308);
}

function deny(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  const res = NextResponse.redirect(url);
  // Best-effort: drop a stale/disallowed session cookie so a re-visit doesn't optimistically
  // render authed chrome client-side before the next server check runs.
  for (const cookie of req.cookies.getAll()) {
    if (
      cookie.name.endsWith("session_token") ||
      cookie.name.endsWith("session_data")
    ) {
      res.cookies.delete(cookie.name);
    }
  }
  return res;
}

export function createAdminProxy(
  options: AdminProxyOptions = {},
): (req: NextRequest) => Promise<NextResponse> {
  // Resolve once per instance so jose's remote JWKS cache survives across requests. A required
  // but malformed configuration throws while the proxy module loads, failing startup/readiness.
  const originGate = options.originGate ?? loadOriginGateConfig(process.env);
  const access = options.access ?? loadCloudflareAccessConfig(process.env);

  const route = async (req: NextRequest): Promise<NextResponse> => {
    // Exact equality, never a prefix: `/healthz/`, `/healthzz` and `/healthz/anything` are not the
    // probe path and stay behind both gates. Railway probes the configured healthcheckPath and
    // nothing else, so exempting more than the literal string widens the carve for no benefit.
    if (req.nextUrl.pathname === HEALTH_PROBE_PATH) return NextResponse.next();
    if (!originRequestAuthorized(req, originGate)) return edgeForbidden();
    if (!(await verifyCloudflareAccessRequest(req, access))) {
      return edgeForbidden();
    }

    // Behind BOTH edge gates by design — `skipTrailingSlashRedirect` in next.config.ts moved this
    // off Next's pre-proxy redirect array, where `/healthz/` had been answering 308 without
    // passing either. Normalizing here also keeps sessionExempt's anchored patterns honest.
    const normalized = normalizeTrailingSlash(req);
    if (normalized !== null) return normalized;

    if (sessionExempt(req.nextUrl.pathname)) return NextResponse.next();

    if (req.nextUrl.pathname === INTERNAL_PROOF_PATH) {
      const proofConfig = parseInternalProofAuthConfig({
        secret: process.env.CAISSON_PROOF_PROXY_SECRET,
        internalHost: process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST,
      });
      if (
        proofConfig !== null &&
        authenticateInternalProofRequest(req, proofConfig) !== null
      ) {
        return NextResponse.next();
      }
      return deny(req);
    }

    const actor = await verifyAdminSession(req);
    if (actor === null) return deny(req);
    // Thread the VERIFIED actor to route handlers. `set` REPLACES any inbound x-admin-actor, so a
    // client cannot spoof the audit actor — the only value a route ever sees is this verified one.
    const headers = new Headers(req.headers);
    headers.set(ACTOR_HEADER, actor.email);
    return NextResponse.next({ request: { headers } });
  };

  // Stamp the serving revision at the ONE exit point, so every branch above carries it — the
  // health passthrough, both edge 403s, the 308, the session redirect, the authed pass-through.
  // The 403 and the redirect matter most: admin is fronted by Cloudflare Access, so those are the
  // responses an operator actually sees while diagnosing, and a body tells them nothing about
  // which build produced it. Ungated for the same reason the site's is.
  return async (req: NextRequest): Promise<NextResponse> => {
    const response = await route(req);
    response.headers.set(REVISION_HEADER, servingRevision());
    return response;
  };
}

export const proxy = createAdminProxy();
