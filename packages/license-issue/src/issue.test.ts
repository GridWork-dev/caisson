// @caisson/license-issue — issuer round-trip + golden (ADR-0110, the SINGLE most important guard).
// Proves issue→verify is whole: a token minted here verifies under the SHIPPED `@caisson/license-verify`
// verify logic to its signed tier/entitlements/expiry, and the SAME token satisfies the registry
// Worker's `licenseEntitlementResolver` (the 2nd consumer).
//
// KEY MODEL (ADR-0110): the SHIPPED verifier bakes the PRODUCTION public key, whose private half never
// lives in this repo — so tests sign with a DETERMINISTIC DEV keypair (SHA-256(
// "caisson-license-verify-KAT-seed-v1"), a documented TEST vector) and verify through the explicit-key
// seam `verifyLicenseWithKey(token, DEV_PUB)`. Ed25519 is deterministic (RFC 8032), so the DEV claims
// reproduce the committed golden token BYTE-FOR-BYTE — the same token verify.ts's dev golden pins —
// tying issuer, verifier, and codec to one key. The golden is authored BEFORE the assertions.
import { describe, expect, test } from "bun:test";
import {
  type KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { matchGolden } from "@caisson/testing";
import { verifyLicenseWithKey } from "@caisson/license-verify";
import {
  type RegistryIndex,
  expandEntitlements,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { Ed25519Signer } from "./signer.ts";
import { issueLicense } from "./issue.ts";

/** Build an Ed25519 private KeyObject from a 32-byte seed (PKCS#8 DER = prefix ‖ seed, RFC 8410). */
const privFromSeed = (seed: Uint8Array): KeyObject =>
  createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seed),
    ]),
    format: "der",
    type: "pkcs8",
  });

/** The deterministic DEV seed (a TEST vector, NOT a production secret). */
const DEV_SEED = Uint8Array.from(
  createHash("sha256").update("caisson-license-verify-KAT-seed-v1").digest(),
);
/** An UNRELATED seed — its signatures must be rejected by the DEV public key (forgery path). */
const WRONG_SEED = Uint8Array.from(
  createHash("sha256").update("a-different-key-entirely").digest(),
);

const devPrivate = privFromSeed(DEV_SEED);
/** The DEV public key tests inject to exercise the verify logic against dev-signed tokens.
 * Derived via the private key's PEM (`createPublicKey(KeyObject)`'s overload is absent from bun-types). */
const DEV_PUB: KeyObject = createPublicKey(
  devPrivate.export({ format: "pem", type: "pkcs8" }),
);
const devSigner = new Ed25519Signer("dev", devPrivate);
const wrongSigner = new Ed25519Signer("wrong", privFromSeed(WRONG_SEED));

/** Verify a DEV-signed token through the explicit-key seam (the SHIPPED baked key is prod, not dev). */
const verifyDev = (token: string, now?: Date) =>
  now === undefined
    ? verifyLicenseWithKey(token, DEV_PUB)
    : verifyLicenseWithKey(token, DEV_PUB, now);

// Byte-for-byte mirror of `registry/worker/entitlement-filter.ts` `licenseEntitlementResolver` — the
// 2nd consumer of an issued token (the registry Worker at the edge). It lives in `registry/` (outside
// this package's `rootDir`, so a direct import would break the emitting `tsc` build, TS6059), so the
// resolver's exact logic is reproduced here to prove an issued token satisfies it. The real worker
// verifies through `verifyLicense` (the baked PROD key); here we inject DEV_PUB because the prod
// private half is not in the repo — the resolver SHAPE (bearer-parse → verify → entitlements) is what
// is mirrored. Keep in sync.
const BEARER_RE = /^Bearer\s+(\S+)$/i;
function licenseEntitlementResolver(
  request: Request,
): readonly string[] | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = BEARER_RE.exec(header.trim());
  const token = match?.[1];
  if (token === undefined) return null;
  const verified = verifyDev(token);
  return verified.valid ? verified.entitlements : null;
}

/** The exact DEV claims behind the committed golden token (mirrors verify.test.ts / token.test.ts). */
const DEV_CLAIMS = {
  entitlements: ["local-ai"],
  expiry: null,
  licenseId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  major: 1,
  tier: "pro",
} as const;

const DEV_PAYLOAD =
  '{"entitlements":["local-ai"],"expiry":null,"licenseId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","major":1,"tier":"pro"}';

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

describe("issueLicense — golden (golden-before-logic, ADR-0013)", () => {
  test("issuing the DEV claims with the DEV key reproduces the committed golden token", async () => {
    const token = await issueLicense(devSigner, DEV_CLAIMS);
    matchGolden(import.meta.url, "issued-token", {
      token,
      payload: DEV_PAYLOAD,
    });
  });
});

describe("issueLicense — round-trip through the SHIPPED verifier", () => {
  test("an issued token verifies to its SIGNED tier/entitlements, fields preserved", async () => {
    const token = await issueLicense(devSigner, DEV_CLAIMS);
    const result = verifyDev(token);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.entitlements).toEqual(["local-ai"]);
    expect(result.claims?.licenseId).toBe(DEV_CLAIMS.licenseId);
    expect(result.claims?.major).toBe(1);
    expect(result.claims?.expiry).toBeNull();
  });

  test("the signed payload equals canonicalize(claims) AND is key-order independent", async () => {
    // Same claims, keys in a DIFFERENT insertion order → byte-identical canonical payload → same token.
    const shuffled = {
      tier: "pro",
      major: 1,
      licenseId: DEV_CLAIMS.licenseId,
      expiry: null,
      entitlements: ["local-ai"],
    };
    const a = await issueLicense(devSigner, DEV_CLAIMS);
    const b = await issueLicense(devSigner, shuffled);
    expect(b).toBe(a);
    // The signed payload the verifier re-derives is exactly the canonical bytes.
    expect(verifyDev(a).claims).not.toBeNull();
    const body = a.slice(a.indexOf("-", a.indexOf("-") + 1) + 1);
    const decoded = Buffer.from(body, "base64url");
    expect(decoded.subarray(0, decoded.length - 64).toString("utf8")).toBe(
      DEV_PAYLOAD,
    );
  });

  test("a token signed by the WRONG key → community (forgery rejected)", async () => {
    const forged = await issueLicense(wrongSigner, {
      ...DEV_CLAIMS,
      licenseId: VALID_UUID,
    });
    const result = verifyDev(forged);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });
});

describe("issueLicense — expiry semantics (perpetual-per-major)", () => {
  const at = new Date("2026-06-30T00:00:00.000Z");

  test("perpetual (expiry null) verifies valid", async () => {
    const token = await issueLicense(devSigner, {
      ...DEV_CLAIMS,
      licenseId: VALID_UUID,
    });
    expect(verifyDev(token, at).valid).toBe(true);
  });

  test("an in-date expiry verifies valid", async () => {
    const token = await issueLicense(devSigner, {
      entitlements: ["local-ai"],
      expiry: "2099-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    expect(verifyDev(token, at).valid).toBe(true);
  });

  test("an elapsed expiry → community", async () => {
    const token = await issueLicense(devSigner, {
      entitlements: ["local-ai"],
      expiry: "2020-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    const result = verifyDev(token, at);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });
});

describe("issueLicense — updatesWindows passthrough (ADR-0244/0255 per-entitlement updates windows)", () => {
  test("claims carrying an updatesWindows map round-trip through issue → verify", async () => {
    const token = await issueLicense(devSigner, {
      ...DEV_CLAIMS,
      licenseId: VALID_UUID,
      updatesWindows: { "local-ai": "2027-07-06T00:00:00.000Z" },
    });
    const result = verifyDev(token);
    expect(result.valid).toBe(true);
    expect(result.claims?.updatesWindows).toEqual({
      "local-ai": "2027-07-06T00:00:00.000Z",
    });
  });

  test("claims WITHOUT the field still issue (pre-window shape preserved — the golden pins it)", async () => {
    const token = await issueLicense(devSigner, DEV_CLAIMS);
    expect(verifyDev(token).claims?.updatesWindows).toBeUndefined();
  });

  test("a malformed updatesWindows value is rejected BEFORE signing", async () => {
    await expect(
      issueLicense(devSigner, {
        ...DEV_CLAIMS,
        updatesWindows: { "local-ai": "soon" },
      }),
    ).rejects.toThrow();
  });

  test("a null VALUE in the map is rejected BEFORE signing (unbounded = no key, never null)", async () => {
    await expect(
      issueLicense(devSigner, {
        ...DEV_CLAIMS,
        updatesWindows: { "local-ai": null },
      }),
    ).rejects.toThrow();
  });
});

describe("issueLicense — entitledSince passthrough (ADR-0257 snapshot-at-sale claim)", () => {
  test("claims carrying an entitledSince map round-trip through issue → verify", async () => {
    const token = await issueLicense(devSigner, {
      ...DEV_CLAIMS,
      licenseId: VALID_UUID,
      entitledSince: { compliance: "2026-07-06T00:00:00.000Z" },
    });
    const result = verifyDev(token);
    expect(result.valid).toBe(true);
    expect(result.claims?.entitledSince).toEqual({
      compliance: "2026-07-06T00:00:00.000Z",
    });
  });

  test("claims WITHOUT the field still issue (pre-snapshot shape preserved — the golden pins it)", async () => {
    const token = await issueLicense(devSigner, DEV_CLAIMS);
    expect(verifyDev(token).claims?.entitledSince).toBeUndefined();
  });

  test("a malformed entitledSince value is rejected BEFORE signing", async () => {
    await expect(
      issueLicense(devSigner, {
        ...DEV_CLAIMS,
        entitledSince: { compliance: "soon" },
      }),
    ).rejects.toThrow();
  });

  test("a null VALUE in the map is rejected BEFORE signing (grandfathered = no key, never null)", async () => {
    await expect(
      issueLicense(devSigner, {
        ...DEV_CLAIMS,
        entitledSince: { compliance: null },
      }),
    ).rejects.toThrow();
  });
});

describe("issueLicense — strict claims (the issuer never signs a bad shape)", () => {
  test("an unknown tier is rejected BEFORE signing (strict parse)", async () => {
    await expect(
      issueLicense(devSigner, { ...DEV_CLAIMS, tier: "enterprise" }),
    ).rejects.toThrow();
  });

  test("an extra/unknown claim is rejected BEFORE signing (.strict())", async () => {
    await expect(
      issueLicense(devSigner, { ...DEV_CLAIMS, forged: true }),
    ).rejects.toThrow();
  });

  test("a non-UUID licenseId is rejected BEFORE signing", async () => {
    await expect(
      issueLicense(devSigner, { ...DEV_CLAIMS, licenseId: "not-a-uuid" }),
    ).rejects.toThrow();
  });
});

describe("issueLicense — the 2nd consumer: registry Worker resolver", () => {
  /** One index entry — base = oss/Apache (no edition, no price); an edition member = commercial/paid. */
  const entry = (id: string, editions: readonly string[]): unknown => {
    const open = editions.length === 0;
    return {
      id,
      latest: "1.0.0",
      versions: [
        {
          version: "1.0.0",
          publishedAt: "2026-01-01T00:00:00.000Z",
          gateAttestation: "ci-run-1@deadbeef",
          manifest: {
            id,
            version: "1.0.0",
            kind: "base",
            tier: open ? "oss" : "paid",
            license: open ? "Apache-2.0" : "LicenseRef-Caisson-Commercial",
            priceCents: open ? null : 4900,
            editions: [...editions],
            description: id,
          },
        },
      ],
    };
  };

  /** A synthetic index whose modules cover the issued entitlements so expansion does not throw. */
  const index: RegistryIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      entry("@caisson/kernel", []),
      entry("@caisson/local-ai", ["local-ai"]),
    ],
  });

  test("the issued token passes licenseEntitlementResolver and its entitlements expand cleanly", async () => {
    // Sign PURCHASED ids (the edition slug) — what the worker re-expands against the live index.
    const token = await issueLicense(devSigner, {
      entitlements: ["local-ai", "@caisson/kernel"],
      expiry: null,
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    const request = new Request("https://registry.caisson.sh/index.json", {
      headers: { authorization: `Bearer ${token}` },
    });
    const resolved = licenseEntitlementResolver(request);
    expect(resolved).toEqual(["local-ai", "@caisson/kernel"]);
    // The worker then expands these against the index — must NOT throw (every id is known).
    expect(() => expandEntitlements(index, resolved ?? [])).not.toThrow();
    expect([...expandEntitlements(index, resolved ?? [])].sort()).toEqual([
      "@caisson/kernel",
      "@caisson/local-ai",
    ]);
  });

  test("an absent Authorization header resolves to null (community → base only)", () => {
    const request = new Request("https://registry.caisson.sh/index.json");
    expect(licenseEntitlementResolver(request)).toBeNull();
  });
});
