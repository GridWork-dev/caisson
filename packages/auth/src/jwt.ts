// EdDSA (Ed25519) account JWT — the cross-plane / cross-service seam (ADR-0015, arch spec §2).
// A better-auth JWT plugin mints these for the active account; services verify them against a
// cached JWKS (the public key). Asymmetric verify via node:crypto — NOT timingSafeEqual (that is
// for opaque Bearer tokens) and NOT crypto for symmetric HMAC (that is the Stripe webhook path).
import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { AuthnError } from "@caisson-sh/kernel";
import type { Role, SessionContext } from "./session.ts";

export interface AccountClaims {
  userId: string;
  accountId: string;
  role: Role;
}

export interface SignOptions {
  ttlSeconds?: number;
  /** Override the current time (seconds). For tests. */
  now?: number;
}

const HEADER = { alg: "EdDSA", typ: "JWT" } as const;

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Generate an Ed25519 keypair (issuer holds the private key; verifiers cache the public key). */
export function generateAccountKeyPair(): {
  publicKey: KeyObject;
  privateKey: KeyObject;
} {
  return generateKeyPairSync("ed25519");
}

export function signAccountJwt(
  claims: AccountClaims,
  privateKey: KeyObject,
  { ttlSeconds = 900, now = Math.floor(Date.now() / 1000) }: SignOptions = {},
): string {
  const payload = {
    sub: claims.userId,
    account_id: claims.accountId,
    role: claims.role,
    iat: now,
    exp: now + ttlSeconds,
  };
  const signingInput = `${encodeSegment(HEADER)}.${encodeSegment(payload)}`;
  const signature = cryptoSign(null, Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

/**
 * Verify an account JWT against the public key and return the session it asserts. Throws
 * `AuthnError` (401) on a malformed token, bad signature, expiry, or invalid claims — never
 * leaks why beyond a generic reason.
 */
export function verifyAccountJwt(
  token: string,
  publicKey: KeyObject,
  { now = Math.floor(Date.now() / 1000) }: { now?: number } = {},
): SessionContext {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthnError("Invalid token");
  const [headerSeg, payloadSeg, signatureSeg] = parts as [
    string,
    string,
    string,
  ];

  const signingInput = `${headerSeg}.${payloadSeg}`;
  let valid: boolean;
  try {
    valid = cryptoVerify(
      null,
      Buffer.from(signingInput),
      publicKey,
      Buffer.from(signatureSeg, "base64url"),
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new AuthnError("Invalid token");

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(
      Buffer.from(payloadSeg, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    throw new AuthnError("Invalid token");
  }

  if (typeof claims.exp !== "number" || claims.exp < now) {
    throw new AuthnError("Invalid token");
  }
  const { sub, account_id: accountId, role } = claims;
  if (
    typeof sub !== "string" ||
    typeof accountId !== "string" ||
    (role !== "owner" && role !== "seat")
  ) {
    throw new AuthnError("Invalid token");
  }
  return { userId: sub, accountId, role };
}
