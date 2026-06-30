// @caisson/license-verify — offline verify behavior (T7, ADR-0010 / ADR-0110). Proves every failure
// path fails safe to community: tamper → community, absent → community, expired → community, unknown
// tier → community, non-canonical payload → community, wrong key → community.
//
// KEY MODEL (ADR-0110): verify.ts bakes the PRODUCTION issuer public key, whose private half
// (`CAISSON_LICENSE_SIGNING_KEY`) never lives in this repo — so tests CANNOT mint prod-signed tokens.
// Instead they mint with a DETERMINISTIC DEV keypair (SHA-256("caisson-license-verify-KAT-seed-v1"),
// a documented TEST vector, NEVER a production secret) and exercise the verify LOGIC through the
// explicit-key seam `verifyLicenseWithKey(token, DEV_PUBLIC_KEY)`. The SHIPPED baked key is pinned
// separately by a real prod-signed golden token (`__golden__/prod-signed-token.json`, minted offline
// with the production private key) verified through the production `verifyLicense` entrypoint. Ed25519
// is deterministic (RFC 8032), so the dev seed reproduces the codec golden byte-for-byte.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { canonicalize } from "@caisson/kernel";
import {
  type KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
} from "node:crypto";
import { encodeToken } from "./token.ts";
import { verifyLicense, verifyLicenseWithKey } from "./verify.ts";

/** The deterministic DEV signing key, reconstructed from the documented seed (test vector only). */
const DEV_SEED = createHash("sha256")
  .update("caisson-license-verify-KAT-seed-v1")
  .digest();
// Ed25519 PKCS#8 DER = 16-byte fixed prefix ‖ 32-byte raw seed (RFC 8410).
const DEV_PRIVATE_KEY: KeyObject = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    DEV_SEED,
  ]),
  format: "der",
  type: "pkcs8",
});
/** The DEV public key — what tests inject so the verify logic runs against dev-signed tokens.
 * Derived via the private key's PEM (`createPublicKey(KeyObject)`'s overload is absent from bun-types). */
const DEV_PUBLIC_KEY: KeyObject = createPublicKey(
  DEV_PRIVATE_KEY.export({ format: "pem", type: "pkcs8" }),
);

/** A second, UNRELATED key — its signatures must be rejected by the DEV public key (forgery path). */
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
  key: KeyObject = DEV_PRIVATE_KEY,
): string {
  const payload = canonicalize(claims as Parameters<typeof canonicalize>[0]);
  const signature = cryptoSign(null, Buffer.from(payload, "utf8"), key);
  return encodeToken({ prefix: "CAISSON", tier: "PRO", payload, signature });
}

/** Verify a DEV-signed token through the explicit-key seam (the baked key is prod, not the dev key). */
const verifyDev = (token: string | null | undefined, now?: Date) =>
  now === undefined
    ? verifyLicenseWithKey(token, DEV_PUBLIC_KEY)
    : verifyLicenseWithKey(token, DEV_PUBLIC_KEY, now);

/** The exact DEV claims behind the committed dev golden token (mirrors token.test.ts). */
const DEV_CLAIMS = {
  entitlements: ["local-ai"],
  expiry: null,
  licenseId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  major: 1,
  tier: "pro",
} as const;

/** The committed dev golden token (T6 `__golden__/signed-token.json` source). */
const DEV_TOKEN =
  "<redacted-license-token>";

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

describe("verifyLicense — production baked-key KAT (the SHIPPED contract)", () => {
  /** A real token signed by the PRODUCTION private key — the public key baked into verify.ts. */
  const prodGolden = JSON.parse(
    readFileSync(
      new URL("./__golden__/prod-signed-token.json", import.meta.url),
      "utf8",
    ),
  ) as { token: string; payload: string };

  test("the baked production key verifies a real prod-signed token (default entrypoint)", () => {
    const result = verifyLicense(prodGolden.token);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.entitlements).toEqual(["ai-kit", "compliance", "local-ai"]);
    expect(result.claims?.licenseId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  test("a DEV-key-signed token is REJECTED by the default entrypoint (the bake actually happened)", () => {
    // If verify.ts still baked the dev/KAT key, this dev-signed token would verify — proving the
    // shipped key is the production key, not the publicly-documented test vector.
    const devSigned = mint(DEV_CLAIMS);
    const result = verifyLicense(devSigned);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });
});

describe("verifyLicense — dev golden (offline, deterministic, explicit-key seam)", () => {
  test("the seed reproduces the committed dev token byte-for-byte", () => {
    expect(mint(DEV_CLAIMS)).toBe(DEV_TOKEN);
  });

  test("a valid signed token verifies to its SIGNED tier with zero network", () => {
    const result = verifyDev(DEV_TOKEN);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.entitlements).toEqual(["local-ai"]);
    expect(result.claims?.licenseId).toBe(DEV_CLAIMS.licenseId);
    expect(result.claims?.major).toBe(1);
  });

  test("the SIGNED tier is authority — the cosmetic wire TIER is ignored", () => {
    // Re-frame the SAME signed bytes under a cosmetic "FREE" wire tier; the signed "pro" still wins.
    const payload = canonicalize(
      DEV_CLAIMS as Parameters<typeof canonicalize>[0],
    );
    const signature = cryptoSign(
      null,
      Buffer.from(payload, "utf8"),
      DEV_PRIVATE_KEY,
    );
    const reframed = encodeToken({
      prefix: "CAISSON",
      tier: "FREE",
      payload,
      signature,
    });
    expect(verifyDev(reframed).tier).toBe("pro");
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
      DEV_TOKEN.slice(0, -1) + (DEV_TOKEN.endsWith("A") ? "B" : "A");
    const result = verifyDev(tampered);
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
      { ...DEV_CLAIMS, licenseId: VALID_UUID },
      WRONG_PRIVATE_KEY,
    );
    expect(verifyDev(forged).valid).toBe(false);
    expect(verifyDev(forged).tier).toBe("community");
  });

  test("an EXPIRED token → community (perpetual-per-major: only null never lapses)", () => {
    const expired = mint({
      entitlements: ["local-ai"],
      expiry: "2020-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    const result = verifyDev(expired, new Date("2026-06-27T00:00:00.000Z"));
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
    const result = verifyDev(future, new Date("2026-06-27T00:00:00.000Z"));
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
    expect(verifyDev(unknownTier).tier).toBe("community");
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
    expect(verifyDev(extra).valid).toBe(false);
    expect(verifyDev(extra).tier).toBe("community");
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
      DEV_PRIVATE_KEY,
    );
    const token = encodeToken({
      prefix: "CAISSON",
      tier: "PRO",
      payload: nonCanonical,
      signature,
    });
    expect(verifyDev(token).tier).toBe("community");
  });
});
