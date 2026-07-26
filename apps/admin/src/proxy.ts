// App-wide auth gate (ADR-0283 — supersedes the CF-Access-JWT middleware of ADR-0204, itself
// superseding ADR-0140's edge-alone posture). apps/admin renders cross-tenant business data and
// ships no other auth, so EVERY route must be gated — a per-page check would leave siblings open
// (same reasoning as the file this replaces).
//
// Named `proxy.ts` (not `middleware.ts`): Next 16 deprecated `middleware.ts` in favor of
// `proxy.ts`, which defaults to the Node.js runtime (no `export const runtime` — Next throws if
// one is set here). That default is load-bearing this time, unlike the old file: verifying a
// better-auth session needs `pg`/`node:crypto`, which never ran in the old file's Edge runtime.
//
// The OAuth start+callback (`/api/auth/*`), the sign-in page (`/login`), and the Railway
// healthcheck (`/healthz`) are the only unguarded routes. A page request with no verified session
// redirects to `/login?next=<path>`; an API request 401s (a `fetch()` can't usefully follow an
// HTML redirect). CF-Access can keep gating at the edge in parallel during the ADR-0283 rollout
// window (code-live-first, gate-drop-second) — this app no longer depends on it either way.
import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateInternalProofRequest,
  parseInternalProofAuthConfig,
} from "@/lib/internal-proof-auth";
import { verifyAdminSession } from "@/lib/admin-session";

export const config = {
  // Anchored, not prefix-matched: `(?:/|$)` after each excluded segment so `/loginboard` or
  // `/api/authz` are NOT accidentally un-gated (a bare `login|api/auth` alternation would match
  // any pathname merely STARTING with those letters).
  matcher: [
    "/((?!_next/|favicon\\.ico|healthz(?:/|$)|login(?:/|$)|api/auth(?:/|$)).*)",
  ],
};

/** Header carrying the verified admin actor email to route handlers (ADR-0220 — unchanged shape;
 *  only the verification mechanism behind it moved from CF-Access-JWT to better-auth+allowlist). */
const ACTOR_HEADER = "x-admin-actor";
const INTERNAL_PROOF_PATH = "/api/internal/audit/proof";

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

export async function proxy(req: NextRequest): Promise<NextResponse> {
  if (req.nextUrl.pathname === INTERNAL_PROOF_PATH) {
    const config = parseInternalProofAuthConfig({
      secret: process.env.CAISSON_PROOF_PROXY_SECRET,
      internalHost: process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST,
    });
    if (
      config !== null &&
      authenticateInternalProofRequest(req, config) !== null
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
}
