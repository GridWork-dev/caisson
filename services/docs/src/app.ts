// src/app.ts — the HTTP router (ADR-0096), a pure `Request → Response` function over injected deps so
// it is trivially testable without a live socket. Public read surfaces (health + the llms artifacts);
// the retrieval endpoint POST /query is Bearer-gated (timing-safe). Every response carries the security
// headers from the gridwork security floor (nosniff / frame-deny / HSTS). No CORS header is set — this
// is a server-to-server contract for the support-bot, not a browser surface.
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DocsIndex } from "./index-store.ts";

export interface AppDeps {
  index: DocsIndex;
  llmsTxt: string;
  llmsFull: string;
  /** Bearer secret for POST /query. Must be non-empty — server.ts fails closed if it is unset. */
  token: string;
}

/** POST /query body. `.strict()` rejects unknown fields; query + k are bounded (no unbounded compute). */
const QuerySchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    k: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

function respond(body: string, status: number, contentType: string): Response {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": contentType },
  });
}

const json = (data: unknown, status = 200): Response =>
  respond(JSON.stringify(data), status, "application/json; charset=utf-8");
const text = (body: string, status = 200): Response =>
  respond(body, status, "text/plain; charset=utf-8");

/**
 * Timing-safe Bearer check. `DOCS_SERVICE_TOKEN` is an opaque secret of not-guaranteed-fixed length, so
 * per the security floor's VARIABLE-LENGTH rule both sides are SHA-256-digested to fixed 32-byte buffers
 * before `timingSafeEqual` — this avoids the equal-length guard, which would leak the token's byte length
 * to a remote timing oracle (an attacker could binary-search the length). Normalization is identical on
 * both sides (raw bytes), so only the value is compared.
 */
function authorized(req: Request, token: string): boolean {
  if (token.length === 0) return false; // unconfigured ⇒ fail closed
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

/** Build the request handler. Async because /query awaits retrieval. */
export function createApp(deps: AppDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    if (pathname === "/health") {
      return method === "GET"
        ? json({ ok: true, chunks: deps.index.size })
        : text("method not allowed", 405);
    }
    if (pathname === "/llms.txt") {
      return method === "GET"
        ? text(deps.llmsTxt)
        : text("method not allowed", 405);
    }
    if (pathname === "/llms-full.txt") {
      return method === "GET"
        ? text(deps.llmsFull)
        : text("method not allowed", 405);
    }
    if (pathname === "/query") {
      if (method !== "POST") return text("method not allowed", 405);
      if (!authorized(req, deps.token))
        return json({ error: "unauthorized" }, 401);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = QuerySchema.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid query", issues: parsed.error.issues },
          400,
        );
      }
      const chunks = await deps.index.search(
        parsed.data.query,
        parsed.data.k ?? 5,
      );
      return json({ chunks });
    }

    return json({ error: "not found" }, 404);
  };
}
