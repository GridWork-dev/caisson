import {
  loadOriginGateConfig,
  originRequestAuthorized,
  type OriginGateConfig,
} from "@caisson/kernel/node";
import { NextResponse, type NextRequest } from "next/server";

export const config = { matcher: ["/:path*"] };

// This proves Worker-to-origin authenticity only. Route handlers and Server Functions retain
// their own session/authorization checks; Next delivers Server Function calls as POSTs here too.

function forbidden(): NextResponse {
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

// `skipTrailingSlashRedirect` in next.config.ts moves this normalization off Next's pre-proxy
// redirect array and behind the gate above, so `/anything/` can no longer answer 308 on the raw
// origin without the secret. Behaviour for legitimate traffic is unchanged: same 308, same target.
export function normalizeTrailingSlash(
  request: NextRequest,
): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  // A plain URL, not nextUrl.clone(): NextURL re-serializes the pathname through its own
  // formatter and hands back the trailing slash we just stripped.
  const url = new URL(request.url);
  url.pathname = pathname.replace(/\/+$/, "") || "/";
  return NextResponse.redirect(url, 308);
}

export function createSiteProxy(
  originGate: OriginGateConfig = loadOriginGateConfig(process.env),
): (request: NextRequest) => NextResponse {
  return (request: NextRequest): NextResponse => {
    if (!originRequestAuthorized(request, originGate)) return forbidden();
    return normalizeTrailingSlash(request) ?? NextResponse.next();
  };
}

// Resolve once while the proxy module loads. An absent mode is armed; only the exact explicit
// development/test opt-out disables verification. Invalid armed configuration fails startup.
export const proxy = createSiteProxy();
