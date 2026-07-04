// @caisson/license-verify — token wire codec (ADR-0010). A pure, framework-free codec for the
// signed license-token wire format `PREFIX-TIER-base64url(payload ‖ signature)`.
//
// This module is the CODEC layer ONLY: it joins/splits the wire string and the payload‖signature
// bytes. It does NOT canonicalize, sign, or verify — claims parsing (Zod `.strict()`) and offline
// Ed25519 verification (`crypto.verify` over the kernel-canonical payload, baked-in public key) land
// in `claims.ts` / `verify.ts`. The cosmetic PREFIX/TIER are informational and MUST NOT be
// trusted for authorization; the SIGNED payload is the sole authority (verified downstream).
import { ValidationError } from "@caisson/kernel";
import { z } from "zod";

/**
 * Ed25519 signatures are a fixed 64 bytes (RFC 8032). The codec splits the decoded body into
 * `payload ‖ signature` on this fixed tail length — unambiguous without an explicit delimiter.
 */
export const SIGNATURE_BYTES = 64;

/** A license token is small; reject anything larger than this at the boundary (cheap DoS floor). */
const MAX_TOKEN_LENGTH = 8192;

/** The decoded wire token: cosmetic prefix/tier + the signed payload bytes + the detached signature. */
export interface LicenseToken {
  /** Cosmetic brand prefix (e.g. `CAISSON`) — informational, NEVER trusted for authorization. */
  readonly prefix: string;
  /** Cosmetic tier label (e.g. `PRO`) — informational; the signed-payload tier is authoritative. */
  readonly tier: string;
  /** The exact signed bytes as a UTF-8 string (canonical claims JSON). Verified in T7, not here. */
  readonly payload: string;
  /** The detached 64-byte Ed25519 signature over `payload`. */
  readonly signature: Buffer;
}

/**
 * Boundary schema for the raw token string: `PREFIX-TIER-BODY`, where PREFIX and TIER are
 * hyphen-free uppercase-alphanumeric segments and BODY is base64url. The first two hyphens are the
 * unambiguous separators (PREFIX/TIER contain no hyphen; base64url's own `-`/`_` stay inside BODY).
 */
const tokenStringSchema = z
  .string()
  .min(1)
  .max(MAX_TOKEN_LENGTH)
  .regex(
    /^[A-Z0-9]+-[A-Z0-9]+-[A-Za-z0-9_-]+$/,
    "expected PREFIX-TIER-base64url(payload+signature)",
  );

/** Encode a decoded token back to its wire string. The exact inverse of {@link decodeToken}. */
export function encodeToken(token: LicenseToken): string {
  const body = Buffer.concat([
    Buffer.from(token.payload, "utf8"),
    token.signature,
  ]);
  return `${token.prefix}-${token.tier}-${body.toString("base64url")}`;
}

/**
 * Decode a wire token string into its parts. Fail-closed: any malformed shape, non-canonical
 * base64url body, or a body too short to contain a payload + 64-byte signature throws a typed
 * {@link ValidationError} — never a raw throw, never a silent partial. The caller (T7) verifies the
 * signature over the canonicalized payload BEFORE trusting any field.
 */
export function decodeToken(raw: string): LicenseToken {
  const parsed = tokenStringSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Malformed license token");
  }
  const value = parsed.data;

  const firstHyphen = value.indexOf("-");
  const secondHyphen = value.indexOf("-", firstHyphen + 1);
  const prefix = value.slice(0, firstHyphen);
  const tier = value.slice(firstHyphen + 1, secondHyphen);
  const bodyB64 = value.slice(secondHyphen + 1);

  const body = Buffer.from(bodyB64, "base64url");
  // base64url decode is lenient; require an exact round-trip so non-canonical bodies fail closed.
  if (body.toString("base64url") !== bodyB64) {
    throw new ValidationError("Malformed license token");
  }
  if (body.length <= SIGNATURE_BYTES) {
    throw new ValidationError("Malformed license token");
  }

  const payload = body
    .subarray(0, body.length - SIGNATURE_BYTES)
    .toString("utf8");
  const signature = Buffer.from(body.subarray(body.length - SIGNATURE_BYTES));
  return { prefix, tier, payload, signature };
}
