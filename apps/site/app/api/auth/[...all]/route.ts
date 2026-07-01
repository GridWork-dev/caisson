// The better-auth handler mount (Next.js App Router catch-all). Every `/api/auth/*` request
// except the explicit `/api/auth/sign-out` route (a more specific segment, which shadows this
// catch-all) is served here: magic-link sign-in + verify, OAuth start + callback, get-session.
// Node runtime (better-auth needs node:crypto) + force-dynamic (auth is never cached). Resolved
// lazily per request so the module imports cleanly at build with no `DATABASE_URL`; when sign-in
// is unconfigured the endpoint answers 503 rather than crashing.
import { getAuth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const auth = getAuth();
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
