// Revokes the better-auth server session row AND clears the cookie, then redirects home.
// POST-only (a sign-out is a state change, never a GET — avoids a prefetch/crawler accidentally
// signing a buyer out). This explicit segment shadows the `/api/auth/[...all]` catch-all for
// `/api/auth/sign-out`, keeping the dashboard's plain-form-POST sign-out working (better-auth's
// own handler answers JSON, not a redirect — the wrong shape for a native `<form method="post">`
// navigation, so this shadow stays; G19 fix: it now ALSO calls the real revoke instead of relying
// on the DB row's own expiry).
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth-server";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * True only when the request's `Origin` names the SAME host as `Host` (IN-01, logout-CSRF): the
 * durable session cookie is `SameSite=Strict`, so a cross-site auto-submitting form never actually
 * sends it here — but a `Set-Cookie: …; Max-Age=0` in the RESPONSE is honored by the victim's
 * browser regardless of how the request arrived, so the cookie-clear loop below could still force
 * a signed-in visitor's browser to drop its real session cookie from an attacker's page. A same-site
 * `<form method="post">` (the dashboard's own sign-out button) always carries an `Origin` header
 * matching its own host, so failing closed on an absent/mismatched one costs nothing legitimate.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return new Response(null, { status: 403 });
  }
  const auth = getAuth();
  if (auth !== null) {
    try {
      // Revokes the session row server-side (better-auth reads the session token off the request
      // cookie via `headers`) — a captured raw token can no longer authenticate past this call,
      // closing the "logout doesn't revoke the DB row" gap. Best-effort: an already-expired/absent
      // session must never block the cookie clear + redirect below.
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // No session / already signed out / auth transiently unavailable — fall through to the
      // unconditional cookie clear below either way.
    }
  }
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (
      cookie.name.endsWith("session_token") ||
      cookie.name.endsWith("session_data") ||
      cookie.name === ACTIVE_ACCOUNT_COOKIE // IN-03: no security impact, just a stale preference
    ) {
      jar.delete(cookie.name);
    }
  }
  redirect("/");
}
