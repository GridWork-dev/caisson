// The better-auth handler mount (Next.js App Router catch-all). Every `/api/auth/*` request
// except the explicit `/api/auth/sign-out` route (a more specific segment, which shadows this
// catch-all) is served here: magic-link sign-in + verify, OAuth start + callback, get-session.
// Node runtime (better-auth needs node:crypto) + force-dynamic (auth is never cached). Resolved
// lazily per request so the module imports cleanly at build with no `DATABASE_URL`; when sign-in
// is unconfigured the endpoint answers 503 rather than crashing.
import { getAuth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ADR-0366 (session-token hash-at-rest): these three better-auth endpoints feed a client-supplied
// or previously-listed token into a SECOND adapter lookup outside the normal resolved-session read
// path, which the wrap can't serve correctly — `/list-sessions` returns the STORED HMAC lookup key
// as `token` (not a usable credential, but not what a caller expects either), and
// `/revoke-session` / `/revoke-other-sessions` re-hash an already-hashed value on the way back in,
// so the lookup never matches, nothing is revoked, and better-auth still answers `{status:true}` —
// a false success on a security action. Denied outright rather than patched in the wrap: teaching
// the wrap to accept a 64-hex value as "pre-hashed" would let a leaked lookup key double as a
// bearer credential, defeating ADR-0366. Unsupported until the wrap grows a real pre-hashed path.
// `/revoke-sessions` (revoke ALL of the caller's own sessions, keyed by the verified userId — never
// a client-supplied token) is deliberately NOT here; it never touches `token` and works correctly.
const DENIED_PATHS = new Set([
  "/api/auth/list-sessions",
  "/api/auth/revoke-session",
  "/api/auth/revoke-other-sessions",
]);

async function handle(request: Request): Promise<Response> {
  if (DENIED_PATHS.has(new URL(request.url).pathname)) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }
  const auth = await getAuth();
  if (auth === null) {
    return new Response(JSON.stringify({ error: "auth_unavailable" }), {
      status: 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }
  return auth.handler(request);
}

export const GET = handle;
export const POST = handle;
