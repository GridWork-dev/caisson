// The better-auth handler mount (ADR-0283, mirroring apps/site's `/api/auth/[...all]`). Every
// `/api/auth/*` request is served here: the GitHub OAuth start + callback, and get-session. Node
// runtime (better-auth needs node:crypto) + force-dynamic (auth is never cached). Resolved lazily
// per request so the module imports cleanly at build with no admin auth DB / GitHub OAuth app
// configured; when sign-in is unconfigured the endpoint answers 503 rather than crashing.
import { getAdminAuth } from "@/lib/admin-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const auth = getAdminAuth();
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
