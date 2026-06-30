// src/app.ts — the license-ISSUER HTTP router (ADR-0108, implements ADR-0010). A pure
// `Request → Response` function over injected deps (token, signer, registry index, tenant Transactor)
// so it is testable without a live socket. Issuance is LAZY + bearer-gated: POST /issue mints a signed
// license for an account by resolving its server-side entitlements (the EXISTING `resolveAccountEntitlements`
// inside `withTenant`, RLS-scoped) and signing them via `@caisson/license-issue`. /health is public
// (like services/docs). Every response carries the gridwork security-floor headers (nosniff / frame-deny
// / HSTS). The Bearer gate is timing-safe over the VARIABLE-LENGTH token (SHA-256 → `timingSafeEqual`,
// the security-floor rule) and fail-closed when the token is unset. Server-to-server contract — no CORS.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { issueLicense, type Signer } from "@caisson/license-issue";
import { licenseTierSchema } from "@caisson/license-verify";
import type { RegistryIndex } from "@caisson/registry-schema";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import { resolveAccountEntitlements } from "./resolve-entitlements.ts";

export interface IssueAppDeps {
  /** Bearer secret for POST /issue. Must be non-empty — server.ts fails closed if it is unset. */
  token: string;
  /** The signing identity (default Ed25519Signer over a PKCS8 env key; KMS is an un-wired seam). */
  signer: Signer;
  /** The built registry index — membership truth for entitlement expansion (ADR-0071). */
  index: RegistryIndex;
  /** The tenant Transactor — `resolveAccountEntitlements` runs inside `withTenant` over it (RLS). */
  db: Transactor;
}

/**
 * POST /issue body. `.strict()` rejects unknown fields; the account id + version are bounded. The
 * tier is the SHARED `licenseTierSchema` (never re-declared). `entitlements` are NOT taken from the
 * caller — they are resolved server-side from the account's purchases (ADR-0071), so a caller cannot
 * mint itself entitlements it did not buy. `expiry` is an ISO-8601 instant or `null` (perpetual-per-major).
 */
const IssueBody = z
  .object({
    accountId: z.string().trim().min(1).max(256),
    tier: licenseTierSchema,
    major: z.number().int().nonnegative(),
    expiry: z.string().datetime({ offset: true }).nullable(),
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
 * Timing-safe Bearer check. `LICENSE_ISSUE_TOKEN` is an opaque secret of not-guaranteed-fixed length, so
 * per the security floor's VARIABLE-LENGTH rule both sides are SHA-256-digested to fixed 32-byte buffers
 * before `timingSafeEqual` — avoiding the equal-length guard that would leak the token's byte length to a
 * remote timing oracle. Normalization is identical on both sides (raw bytes), so only the value compares.
 */
function authorized(req: Request, token: string): boolean {
  if (token.length === 0) return false; // unconfigured ⇒ fail closed
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

/** Build the request handler. Async because /issue awaits the tenant read + the signer. */
export function createApp(
  deps: IssueAppDeps,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    if (pathname === "/health") {
      return method === "GET"
        ? json({ ok: true })
        : text("method not allowed", 405);
    }

    if (pathname === "/issue") {
      if (method !== "POST") return text("method not allowed", 405);
      if (!authorized(req, deps.token))
        return json({ error: "unauthorized" }, 401);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = IssueBody.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid issue request", issues: parsed.error.issues },
          400,
        );
      }
      const { accountId, tier, major, expiry } = parsed.data;

      // Server-side entitlement truth: resolve the account's purchases → member slugs, RLS-scoped.
      // A stored purchased id absent from the index fails closed (`expandEntitlements` throws); we map
      // that to a 422 with a GENERIC message (never echo internal ids).
      let entitlements: string[];
      try {
        const resolved = await withTenant(deps.db, accountId, (tx) =>
          resolveAccountEntitlements(tx, accountId, deps.index),
        );
        entitlements = [...resolved].sort();
      } catch {
        return json({ error: "could not resolve account entitlements" }, 422);
      }

      const claims = {
        licenseId: randomUUID(),
        tier,
        entitlements,
        major,
        expiry,
      };
      const token = await issueLicense(deps.signer, claims);
      return json({ token, licenseId: claims.licenseId });
    }

    return json({ error: "not found" }, 404);
  };
}
