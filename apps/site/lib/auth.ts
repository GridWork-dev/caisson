// The dashboard auth seam (ADR-0015 / ADR-0114): resolves the logged-in buyer's session from the
// EdDSA-JWT cookie, never trusting any client-supplied account id. `better-auth` is the chosen
// SessionProvider runtime (packages/auth/src/session.ts) — wiring the FULL better-auth sign-in
// flow (magic link / OAuth / its own Drizzle tables) is a separate, larger seam this task does not
// build; what's here is the half ADR-0114 scoped: read the cookie, verify it with `@caisson/auth`'s
// `verifyAccountJwt`, and gate `/dashboard` on the result. `requireDashboardSession` is the ONE
// call every dashboard route makes before any tenant read.
import { createPublicKey, type KeyObject } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type SessionContext, verifyAccountJwt } from "@caisson/auth";
import { ConfigError } from "@caisson/kernel";

/** `Secure; HttpOnly; SameSite=Strict` (security floor) — set by the auth runtime at sign-in. */
export const SESSION_COOKIE_NAME = "caisson_session";

const PUBLIC_KEY_ENV = "CAISSON_ACCOUNT_JWT_PUBLIC_KEY";

let cachedPublicKey: KeyObject | undefined;

/**
 * Load the account-JWT verification key from env: a base64-encoded SPKI DER Ed25519 public key,
 * mirroring `@caisson/license-issue`'s `Ed25519Signer.fromEnv` loader convention (same algorithm,
 * same encoding, same "name the env var, never echo the value" discipline). Throws `ConfigError`
 * when unset or malformed — callers MUST treat that as "no session" (see `getSession` below),
 * never propagate it as a 500.
 */
function loadPublicKey(): KeyObject {
  if (cachedPublicKey) return cachedPublicKey;
  const raw = process.env[PUBLIC_KEY_ENV];
  if (raw === undefined || raw.trim() === "") {
    throw new ConfigError(`${PUBLIC_KEY_ENV} is not set`);
  }
  try {
    cachedPublicKey = createPublicKey({
      key: Buffer.from(raw.trim(), "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    throw new ConfigError(
      `${PUBLIC_KEY_ENV} is not a valid base64 SPKI Ed25519 public key`,
    );
  }
  return cachedPublicKey;
}

/**
 * Resolve the current request's session from the `caisson_session` cookie, or `null`. Never
 * throws — a missing cookie, an unconfigured verification key, a malformed/expired/forged token
 * all collapse to "no session" (fail closed): the caller redirects to `/login` either way.
 */
export async function getSession(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined || token.length === 0) return null;
  try {
    const publicKey = loadPublicKey();
    return verifyAccountJwt(token, publicKey);
  } catch {
    return null;
  }
}

/**
 * Require a session for an authed dashboard route; redirects to `/login?next=<pathname>` when
 * absent (never throws a 401 into a page render). `pathname` is the route requiring auth, used
 * only to return the buyer to where they started after sign-in.
 */
export async function requireDashboardSession(
  pathname: string,
): Promise<SessionContext> {
  const session = await getSession();
  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  return session;
}
