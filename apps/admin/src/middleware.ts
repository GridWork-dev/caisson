// App-wide auth gate (Strix vuln-0003, supersedes ADR-0140's CF-Access-edge-alone posture). apps/admin
// ships no other auth and renders cross-tenant business data, so EVERY route must be gated — a per-page
// check would leave siblings open. Cloudflare Access injects `Cf-Access-Jwt-Assertion` only on
// edge-routed requests; a request that reaches the raw Railway origin directly has no valid one, so a
// fail-closed in-app verify closes the origin-bypass the pentest used. The healthcheck + Next static
// assets are excluded (the Railway probe must never be gated).
import { NextResponse, type NextRequest } from "next/server";
import {
  accessConfig,
  extractAccessToken,
  verifyAccessJwt,
} from "@/lib/cf-access";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|healthz).*)"],
};

function deny(body = "forbidden"): NextResponse {
  return new NextResponse(body, {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Header carrying the verified CF-Access actor email to route handlers (ADR-0220). Server-set only. */
const ACTOR_HEADER = "x-admin-actor";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const cfg = accessConfig();
  if (cfg === null) {
    // Unconfigured. In production this is fail-closed: without CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD we
    // cannot tell an edge-routed request from a direct-origin one, so we deny (the operator MUST set
    // both to activate the gate — see the ADR/runbook). Locally there is no CF Access edge, so allow —
    // but STILL strip any inbound x-admin-actor so a spoofed header can never be trusted (the mutation
    // routes then 401 for lack of a verified actor until CF-Access is configured).
    if (process.env.NODE_ENV === "production") {
      return deny("admin access not configured");
    }
    const headers = new Headers(req.headers);
    headers.delete(ACTOR_HEADER);
    return NextResponse.next({ request: { headers } });
  }
  const token = extractAccessToken(req);
  if (token === null) return deny();
  try {
    const { email } = await verifyAccessJwt(token, cfg);
    // Thread the VERIFIED actor to route handlers. `set` REPLACES any inbound x-admin-actor, so a
    // client cannot spoof the audit actor — the only value a route ever sees is this verified one.
    const headers = new Headers(req.headers);
    headers.set(ACTOR_HEADER, email);
    return NextResponse.next({ request: { headers } });
  } catch {
    // Bad signature, wrong aud/iss, expired, missing email claim, or an unreachable JWKS — all deny.
    return deny();
  }
}
