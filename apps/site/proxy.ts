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

export function createSiteProxy(
  originGate: OriginGateConfig = loadOriginGateConfig(process.env),
): (request: NextRequest) => NextResponse {
  return (request: NextRequest): NextResponse => {
    if (!originRequestAuthorized(request, originGate)) return forbidden();
    return NextResponse.next();
  };
}

// Resolve once while the proxy module loads. Required-but-invalid production configuration fails
// startup/readiness; Railway remains unchanged while ORIGIN_SECRET_REQUIRED is absent.
export const proxy = createSiteProxy();
