// Session resolution for the account JWT `@caisson-sh/auth` issues (EdDSA/Ed25519, `signAccountJwt`
// / `verifyAccountJwt`). This app only ever VERIFIES — the private key stays with whatever issues
// the token (better-auth's JWT plugin, or your own issuer service); `AUTH_JWT_PUBLIC_KEY` is the
// base64 SPKI DER public half from `generateAccountKeyPair()`.
import { createPublicKey, type KeyObject } from "node:crypto";
import type { NextRequest } from "next/server";
import { ConfigError } from "@caisson-sh/kernel";
import { verifyAccountJwt } from "@caisson-sh/auth";
import type { SessionContext } from "@caisson-sh/auth";

/** The cookie carrying the account JWT. Rename to match your issuer's cookie if different. */
export const SESSION_COOKIE = "caisson_session";

let cachedPublicKey: KeyObject | undefined;

function getPublicKey(): KeyObject {
  if (cachedPublicKey === undefined) {
    const encoded = process.env.AUTH_JWT_PUBLIC_KEY;
    if (encoded === undefined) {
      throw new ConfigError("AUTH_JWT_PUBLIC_KEY is not set");
    }
    cachedPublicKey = createPublicKey({
      key: Buffer.from(encoded, "base64"),
      format: "der",
      type: "spki",
    });
  }
  return cachedPublicKey;
}

/**
 * Verify a raw JWT string. Never throws: a missing/invalid/expired token resolves to `null` — the
 * same "no session" shape `SessionProvider.resolveSession` returns. Callers enforce it with
 * `requireSession` from `@caisson-sh/auth` (throws `AuthnError`, map it with `toErrorResponse`).
 */
export function verifySessionToken(
  token: string | undefined,
): SessionContext | null {
  if (token === undefined) return null;
  try {
    return verifyAccountJwt(token, getPublicKey());
  } catch {
    return null;
  }
}

/**
 * Resolve the session straight off an incoming request — `proxy.ts` and Route Handlers both get a
 * real `NextRequest`. Next 16 runs `proxy.ts` on the Node.js runtime by default (unlike the old
 * Edge-only `middleware.ts`), so `node:crypto`'s EdDSA verify works here with no edge shim.
 * Server Actions never see a `Request` — read the cookie via `next/headers`'s `cookies()` instead
 * and call `verifySessionToken` directly (see `src/app/actions/notes.ts`).
 */
export function resolveSessionFromRequest(
  request: NextRequest,
): SessionContext | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}
