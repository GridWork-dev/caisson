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

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
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
      cookie.name.endsWith("session_data")
    ) {
      jar.delete(cookie.name);
    }
  }
  redirect("/");
}
