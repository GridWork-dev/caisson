// Shared plumbing for the ADR-0220 operator mutation routes. Every route is gated by the CF-Access
// middleware (ADR-0204), which threads the VERIFIED actor email as `x-admin-actor` — a route trusts
// that header because the middleware `set`s it (replacing any inbound spoof) only after a successful
// `verifyAccessJwt`. A route reached without a verified actor (dev with CF-Access unconfigured, or a
// misconfigured matcher) fails closed to 401 here.
import { ZodError } from "zod";

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

/** The verified CF-Access actor email, or null when the request carries no verified actor. */
export function actorEmail(req: Request): string | null {
  const actor = req.headers.get("x-admin-actor")?.trim() ?? "";
  return actor === "" ? null : actor;
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
