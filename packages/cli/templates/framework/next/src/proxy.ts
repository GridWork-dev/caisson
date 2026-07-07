// Next 16 renamed `middleware.ts` to `proxy.ts` (same request-interception mechanism, new name +
// Node.js runtime by default). Gates everything under /dashboard: no valid session → redirect to
// /login. Adjust `config.matcher` for the routes your app actually protects.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSessionFromRequest } from "./lib/auth";

export function proxy(request: NextRequest): NextResponse {
  const session = resolveSessionFromRequest(request);
  if (session === null) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard/:path*",
};
