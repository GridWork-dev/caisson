// @caisson/license-verify — token codec KAT (T6, golden-before-logic / ADR-0013). Asserts the wire
// codec round-trips and decodes a KNOWN signed token to its committed golden. The signed-token KAT
// fixture (`src/__golden__/signed-token.json`) is authored HERE, BEFORE T7's offline Ed25519 verify
// logic that cryptographically proves the same token — the fixture precedes the logic it pins.
// Asserted with `BLESS` unset; re-bless only via `BLESS=1 bun test` when the format legitimately moves.
//
// KAT keypair — deterministic Ed25519 (RFC 8032), a TEST vector, NEVER a production secret:
//   seed (hex) = SHA-256("caisson-license-verify-KAT-seed-v1")
//              = 84ad00d02c1648eb572b65e73c98707f243b3ee3ff1ac85db8c6ce2c255737c8
//   pubkey     = (SPKI DER, base64) MCowBQYDK2VwAyEAbQaycFQ6zDCiACKFQ83ucxYtdL++cvlUXf4dqRwvQgs=
// T7 bakes the above public key into `verify.ts` and proves `crypto.verify` accepts this token's
// signature over the kernel-canonical payload, mapping the SIGNED tier "pro" (cosmetic TIER "PRO").
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { matchGolden } from "@caisson/testing";
import { SIGNATURE_BYTES, decodeToken, encodeToken } from "./token.ts";

/** The deterministic KAT token (see header) — the single known answer the codec must reproduce. */
const KAT_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiJmNDdhYzEwYi01OGNjLTQzNzItYTU2Ny0wZTAyYjJjM2Q0NzkiLCJtYWpvciI6MSwidGllciI6InBybyJ9mLtVqk-91jkIh6xD8M0BPmwVbwZfFtH9A0hnBM7zNgI6C1BHuiZEdyBYBtj2dftdSQRNPX9RnIjV21FDEfgdBQ";

/** The exact signed bytes (kernel-canonical claims JSON) the token carries — verified for-real in T7. */
const KAT_PAYLOAD =
  '{"entitlements":["local-ai"],"expiry":null,"licenseId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","major":1,"tier":"pro"}';

describe("license-verify token codec (T6 KAT, golden-before-logic)", () => {
  test("decode of the known signed token matches the committed golden", () => {
    const decoded = decodeToken(KAT_TOKEN);
    matchGolden(import.meta.url, "signed-token", {
      prefix: decoded.prefix,
      tier: decoded.tier,
      payload: decoded.payload,
      signatureB64url: decoded.signature.toString("base64url"),
    });
  });

  test("decode extracts the cosmetic prefix/tier and the signed payload", () => {
    const decoded = decodeToken(KAT_TOKEN);
    expect(decoded.prefix).toBe("CAISSON");
    expect(decoded.tier).toBe("PRO");
    expect(decoded.payload).toBe(KAT_PAYLOAD);
    expect(decoded.signature).toHaveLength(SIGNATURE_BYTES);
  });

  test("encode is the exact inverse of decode (byte-stable round-trip)", () => {
    expect(encodeToken(decodeToken(KAT_TOKEN))).toBe(KAT_TOKEN);
  });

  test("malformed tokens fail closed with a typed ValidationError", () => {
    const shortBody = Buffer.from("short").toString("base64url"); // valid base64url, < 64 bytes
    const malformed = [
      "", // empty
      "CAISSON-PRO", // missing the body segment
      "caisson-pro-AAAA", // lowercase cosmetic segments
      "CAISSON-PRO-not_base64!!", // illegal body characters
      `CAISSON-PRO-${shortBody}`, // body too short to hold a payload + signature
    ];
    for (const bad of malformed) {
      expect(() => decodeToken(bad)).toThrow(ValidationError);
    }
  });
});
