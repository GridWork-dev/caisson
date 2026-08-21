// App-wide edge + auth gate. Cloud Run/staging enables the Cloudflare origin secret and Access JWT
// layers through explicit runtime flags; Railway leaves them disabled during the migration window.
// Better-auth plus the immutable numeric GitHub-ID allowlist remains the independent application
// authorization layer for every non-bootstrap route.
//
// Named `proxy.ts` (not `middleware.ts`): Next 16 deprecated `middleware.ts` in favor of
// `proxy.ts`, which defaults to the Node.js runtime (no `export const runtime` — Next throws if
// one is set here). That default is load-bearing this time, unlike the old file: verifying a
// better-auth session needs `pg`/`node:crypto`, which never ran in the old file's Edge runtime.
//
// Bootstrap/static routes bypass only the better-auth session check. They still pass through the
// origin and Access layers when those runtime flags are enabled, including `/healthz`.
import {
  loadOriginGateConfig,
  originRequestAuthorized,
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

  return async (req: NextRequest): Promise<NextResponse> => {
    if (!originRequestAuthorized(req, originGate)) return edgeForbidden();
    if (!(await verifyCloudflareAccessRequest(req, access))) {
      return edgeForbidden();
    }

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
}

export const proxy = createAdminProxy();
