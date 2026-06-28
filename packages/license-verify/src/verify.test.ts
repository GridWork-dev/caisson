// @caisson/license-verify — offline verify behavior (T7, ADR-0010). Proves the KAT golden token
// (committed in T6) cryptographically verifies to its signed tier, and that every failure path
// fails safe to community: tamper → community, absent → community, expired → community, unknown
// tier → community, non-canonical payload → community, wrong key → community.
//
// Test tokens are minted from the DETERMINISTIC KAT seed (SHA-256("caisson-license-verify-KAT-seed-v1"))
// using pure local `node:crypto` — a documented TEST vector, NEVER a production secret, and never a
// network call. The minted KAT token must reproduce the committed golden byte-for-byte (Ed25519 is
// deterministic, RFC 8032), tying this verifier to the same key the codec golden pins.
import { describe, expect, test } from "bun:test";
import { canonicalize } from "@caisson/kernel";
import {
  type KeyObject,
  createHash,
  createPrivateKey,
  sign as cryptoSign,
} from "node:crypto";
import { encodeToken } from "./token.ts";
import { verifyLicense } from "./verify.ts";

/** The deterministic KAT signing key, reconstructed from the documented seed (test vector only). */
const KAT_SEED = createHash("sha256")
  .update("caisson-license-verify-KAT-seed-v1")
  .digest();
// Ed25519 PKCS#8 DER = 16-byte fixed prefix ‖ 32-byte raw seed (RFC 8410).
const KAT_PRIVATE_KEY: KeyObject = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    KAT_SEED,
  ]),
  format: "der",
  type: "pkcs8",
});

/** A second, UNRELATED key — its signatures must be rejected by the baked-in public key. */
const WRONG_PRIVATE_KEY: KeyObject = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    createHash("sha256").update("a-different-key-entirely").digest(),
  ]),
  format: "der",
  type: "pkcs8",
});

/** Mint a wire token: canonicalize the claims, sign the canonical bytes, encode the codec frame. */
function mint(
  claims: Record<string, unknown>,
  key: KeyObject = KAT_PRIVATE_KEY,
): string {
  const payload = canonicalize(claims as Parameters<typeof canonicalize>[0]);
  const signature = cryptoSign(null, Buffer.from(payload, "utf8"), key);
  return encodeToken({ prefix: "CAISSON", tier: "PRO", payload, signature });
}

/** The exact KAT claims behind the committed golden token. */
const KAT_CLAIMS = {
  entitlements: ["local-ai"],
  expiry: null,
  licenseId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  major: 1,
  tier: "pro",
} as const;

/** The committed golden KAT token (T6 `__golden__/signed-token.json` source). */
const KAT_TOKEN =
  "<redacted-license-token>";

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

describe("verifyLicense — KAT golden (offline, deterministic)", () => {
  test("the seed reproduces the committed KAT token byte-for-byte", () => {
    expect(mint(KAT_CLAIMS)).toBe(KAT_TOKEN);
  });

  test("a valid signed token verifies to its SIGNED tier with zero network", () => {
    const result = verifyLicense(KAT_TOKEN);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.entitlements).toEqual(["local-ai"]);
    expect(result.claims?.licenseId).toBe(KAT_CLAIMS.licenseId);
    expect(result.claims?.major).toBe(1);
  });

  test("the SIGNED tier is authority — the cosmetic wire TIER is ignored", () => {
    // Re-frame the SAME signed bytes under a cosmetic "FREE" wire tier; the signed "pro" still wins.
    const payload = canonicalize(
      KAT_CLAIMS as Parameters<typeof canonicalize>[0],
    );
    const signature = cryptoSign(
      null,
      Buffer.from(payload, "utf8"),
      KAT_PRIVATE_KEY,
    );
    const reframed = encodeToken({
      prefix: "CAISSON",
      tier: "FREE",
      payload,
      signature,
    });
    expect(verifyLicense(reframed).tier).toBe("pro");
  });
});

describe("verifyLicense — fail-safe-to-community (threat TM-LIC)", () => {
  test("absent token (null / undefined / empty) → community, never throws", () => {
    for (const absent of [null, undefined, ""] as const) {
      const result = verifyLicense(absent);
      expect(result.valid).toBe(false);
      expect(result.tier).toBe("community");
      expect(result.entitlements).toEqual([]);
      expect(result.claims).toBeNull();
    }
  });

  test("a tampered signature → community", () => {
    // Flip the final base64url char of the wire body → corrupts the detached signature.
    const tampered =
      KAT_TOKEN.slice(0, -1) + (KAT_TOKEN.endsWith("A") ? "B" : "A");
    const result = verifyLicense(tampered);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });

  test("a malformed wire string → community (decode fails closed)", () => {
    for (const bad of ["", "CAISSON-PRO", "not-a-token", "caisson-pro-AAAA"]) {
      expect(verifyLicense(bad).tier).toBe("community");
    }
  });

  test("a token signed by the WRONG key → community", () => {
    const forged = mint(
      { ...KAT_CLAIMS, licenseId: VALID_UUID },
      WRONG_PRIVATE_KEY,
    );
    expect(verifyLicense(forged).valid).toBe(false);
    expect(verifyLicense(forged).tier).toBe("community");
  });

  test("an EXPIRED token → community (perpetual-per-major: only null never lapses)", () => {
    const expired = mint({
      entitlements: ["local-ai"],
      expiry: "2020-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    const result = verifyLicense(expired, new Date("2026-06-27T00:00:00.000Z"));
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });

  test("an in-date expiry → valid (the boundary clock is injectable)", () => {
    const future = mint({
      entitlements: ["local-ai"],
      expiry: "2099-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    const result = verifyLicense(future, new Date("2026-06-27T00:00:00.000Z"));
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
  });

  test("an UNKNOWN tier fails strict parsing → community (never escalates)", () => {
    const unknownTier = mint({
      entitlements: ["local-ai"],
      expiry: null,
      licenseId: VALID_UUID,
      major: 1,
      tier: "enterprise",
    });
    expect(verifyLicense(unknownTier).tier).toBe("community");
  });

  test("an extra/unknown claim fails .strict() → community", () => {
    const extra = mint({
      entitlements: ["local-ai"],
      expiry: null,
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
      forged: true,
    });
    expect(verifyLicense(extra).valid).toBe(false);
    expect(verifyLicense(extra).tier).toBe("community");
  });

  test("a NON-CANONICAL signed payload → community (canonical conformance)", () => {
    // Sign authentic bytes whose key order is NOT canonical; the signature is genuine but the
    // payload is not `canonicalize(claims)`, so format conformance rejects it.
    const nonCanonical =
      '{"tier":"pro","major":1,"licenseId":"' +
      VALID_UUID +
      '","expiry":null,"entitlements":["local-ai"]}';
    const signature = cryptoSign(
      null,
      Buffer.from(nonCanonical, "utf8"),
      KAT_PRIVATE_KEY,
    );
    const token = encodeToken({
      prefix: "CAISSON",
      tier: "PRO",
      payload: nonCanonical,
      signature,
    });
    expect(verifyLicense(token).tier).toBe("community");
  });
});
