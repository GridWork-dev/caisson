// Shared plumbing for the ADR-0220 operator mutation routes. Every route is gated by the app's
// proxy gate (`src/proxy.ts`, ADR-0283 — supersedes the CF-Access-JWT middleware of ADR-0204),
// which threads the verified actor email as `x-admin-actor` for logging continuity. Per the
// security floor ("middleware is not a substitute for route-level checks"), a route's OWN auth
// decision never trusts that header — `requireAdmin` below re-runs the real better-auth session +
// GitHub-numeric-id-allowlist check directly (`verifyAdminSession`), so a route reached by any
// bypass of the proxy (a misconfigured matcher, a future internal caller) still fails closed on
// its own.
import { toErrorResponse } from "@caisson/kernel";
import { ZodError } from "zod";
import { verifyAdminSession } from "./admin-session.ts";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // The security-floor response headers (the mutation surface is operator-only, never embedded).
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Shape the success response for a dual-logged mutation (ADR-0220). The state change and its
 * queryable `admin_action_log` row commit atomically; the tamper-evident WORM anchor is appended
 * AFTER that commit. When that post-commit append fails the mutation is ALREADY durable, so this
 * must NOT read as a retryable `mutation failed` (a retry would double-apply the money/entitlement
 * change). Return a DISTINCT do-not-retry body — still HTTP 200, because the action succeeded and is
 * recorded — carrying `worm: "failed"` + an explicit message; the route's `catch` (a genuine
 * PRE-commit failure, nothing applied) is the only path that 500s, and that one IS safe to retry.
 */
export function mutationResponse(result: { worm: "ok" | "failed" }): Response {
  if (result.worm === "failed") {
    return json(
      {
        ...result,
        ok: true,
        message:
          "Mutation committed and recorded in the action log, but the tamper-evident WORM append failed. Do NOT retry (a retry would double-apply). Re-anchor the audit chain out of band.",
      },
      200,
    );
  }
  return json(result);
}

/**
 * Map a caught mutation error to its real HTTP shape (kernel's `toErrorResponse`, ADR-0019): a
 * `CaissonError` (e.g. a `NotFoundError` on a nonexistent target account) keeps its real
 * `code`/`httpStatus`, instead of every thrown value collapsing to a generic 500. Routed through this
 * module's own `json()` so the security headers stay on every response, not just the 200 path.
 */
export function mutationErrorResponse(err: unknown): Response {
  const { status, body } = toErrorResponse(err);
  return json(body, status);
}

/**
 * Route-level session verification (ADR-0283, security-floor "middleware is not a substitute").
 * Re-verifies the request's better-auth session + GitHub-allowlist directly — the SAME check the
 * proxy gate already ran — rather than trusting the `x-admin-actor` header it threads. Returns the
 * verified actor email, or null when the request carries no verified session.
 */
export async function requireAdmin(req: Request): Promise<string | null> {
  const actor = await verifyAdminSession(req);
  return actor?.email ?? null;
}

/** Parse a JSON body with a Zod `.strict()` schema; returns the value or a 400 Response. */
export async function parseBody<T>(
  req: Request,
  schema: { parse: (v: unknown) => T },
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: json({ error: "invalid JSON body" }, 400) };
  }
  try {
    return { ok: true, value: schema.parse(raw) };
  } catch (err) {
    const issues = err instanceof ZodError ? err.issues : undefined;
    return {
      ok: false,
      response: json({ error: "invalid request", issues }, 400),
    };
  }
}
