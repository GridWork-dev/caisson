// Plain Bun.serve HTTP binding for the base app — framework-agnostic on purpose (the per-edition
// framework is a deferred fork). Sessions come ONLY from a verified EdDSA account JWT (the auth→RLS
// seam, ADR-0015); all errors render through the kernel's redaction-safe envelope with the
// security headers from the floor.
import type { KeyObject } from "node:crypto";
import { AuthnError, toErrorResponse } from "@stack/kernel";
import { verifyAccountJwt } from "@stack/auth";
import type { BaseApp } from "./app.ts";

export interface ServerDeps {
  app: BaseApp;
  /** The JWKS public key the account JWT is verified against. */
  authPublicKey: KeyObject;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/** Build the request handler. Pass to `Bun.serve({ fetch })` or any WinterCG runtime. */
export function createFetchHandler(
  deps: ServerDeps,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const url = new URL(req.url);
    try {
      if (req.method === "POST" && url.pathname === "/spend") {
        const token = bearer(req);
        if (token === null) throw new AuthnError();
        const session = verifyAccountJwt(token, deps.authPublicKey);
        const body = (await req.json()) as {
          amount: number;
          idempotencyKey: string;
        };
        return json(200, await deps.app.spend(session, body));
      }

      if (req.method === "POST" && url.pathname === "/webhooks/stripe") {
        const signature = req.headers.get("stripe-signature") ?? "";
        const raw = await req.text();
        return json(200, await deps.app.handleStripeWebhook(raw, signature));
      }

      if (req.method === "POST" && url.pathname === "/mcp") {
        const token = bearer(req) ?? "";
        const body = (await req.json()) as { tool: string; args?: unknown };
        return json(200, {
          result: await deps.app.mcpQuery(token, body.tool, body.args ?? {}),
        });
      }

      return json(404, { error: { code: "not_found", message: "Not found" } });
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return json(status, body);
    }
  };
}
