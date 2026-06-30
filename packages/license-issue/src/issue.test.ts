// @caisson/license-issue — issuer round-trip + golden (ADR-0108, the SINGLE most important guard).
// Proves issue→verify is whole: a token minted here verifies under the SHIPPED `@caisson/license-verify`
// `verifyLicense` to its signed tier/entitlements/expiry, and the SAME token satisfies the registry
// Worker's `licenseEntitlementResolver` (the 2nd consumer). The signer uses the DETERMINISTIC KAT seed
// — SHA-256("caisson-license-verify-KAT-seed-v1") — so the issued signature validates against the
// public key BAKED into verify.ts (the verifier takes no injectable pubkey; the only way to exercise the
// real verify path is to sign with the KAT private seed). Ed25519 is deterministic (RFC 8032), so the
// KAT claims must reproduce the committed golden token BYTE-FOR-BYTE — the same token verify.ts's own
// KAT pins — tying issuer, verifier, and codec to one key. The golden is authored BEFORE the assertions.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { matchGolden } from "@caisson/testing";
import { verifyLicense } from "@caisson/license-verify";
import {
  type RegistryIndex,
  expandEntitlements,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { Ed25519Signer } from "./signer.ts";
import { issueLicense } from "./issue.ts";

// Byte-for-byte mirror of `registry/worker/entitlement-filter.ts` `licenseEntitlementResolver` — the
// 2nd consumer of an issued token (the registry Worker at the edge). It lives in `registry/` (outside
// this package's `rootDir`, so a direct import would break the emitting `tsc` build, TS6059), so the
// resolver's exact logic is reproduced here to prove an issued token satisfies it. Keep in sync.
const BEARER_RE = /^Bearer\s+(\S+)$/i;
function licenseEntitlementResolver(
  request: Request,
): readonly string[] | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = BEARER_RE.exec(header.trim());
  const token = match?.[1];
  if (token === undefined) return null;
  const verified = verifyLicense(token);
  return verified.valid ? verified.entitlements : null;
}

/** The deterministic KAT seed verify.ts bakes the matching public key for (a TEST vector, NOT a secret). */
const KAT_SEED = Uint8Array.from(
  createHash("sha256").update("caisson-license-verify-KAT-seed-v1").digest(),
);
/** An UNRELATED seed — its signatures must be rejected by the baked-in public key (forgery path). */
const WRONG_SEED = Uint8Array.from(
  createHash("sha256").update("a-different-key-entirely").digest(),
);

const katSigner = new Ed25519Signer("kat", KAT_SEED);
const wrongSigner = new Ed25519Signer("wrong", WRONG_SEED);

/** The exact KAT claims behind the committed golden token (mirrors verify.test.ts / token.test.ts). */
const KAT_CLAIMS = {
  entitlements: ["local-ai"],
  expiry: null,
  licenseId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  major: 1,
  tier: "pro",
} as const;

const KAT_PAYLOAD =
  '{"entitlements":["local-ai"],"expiry":null,"licenseId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","major":1,"tier":"pro"}';

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

describe("issueLicense — KAT golden (golden-before-logic, ADR-0013)", () => {
  test("issuing the KAT claims with the KAT seed reproduces the committed golden token", async () => {
    const token = await issueLicense(katSigner, KAT_CLAIMS);
    matchGolden(import.meta.url, "issued-token", {
      token,
      payload: KAT_PAYLOAD,
    });
  });
});

describe("issueLicense — round-trip through the SHIPPED verifier", () => {
  test("an issued token verifies to its SIGNED tier/entitlements, fields preserved", async () => {
    const token = await issueLicense(katSigner, KAT_CLAIMS);
    const result = verifyLicense(token);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.entitlements).toEqual(["local-ai"]);
    expect(result.claims?.licenseId).toBe(KAT_CLAIMS.licenseId);
    expect(result.claims?.major).toBe(1);
    expect(result.claims?.expiry).toBeNull();
  });

  test("the signed payload equals canonicalize(claims) AND is key-order independent", async () => {
    // Same claims, keys in a DIFFERENT insertion order → byte-identical canonical payload → same token.
    const shuffled = {
      tier: "pro",
      major: 1,
      licenseId: KAT_CLAIMS.licenseId,
      expiry: null,
      entitlements: ["local-ai"],
    };
    const a = await issueLicense(katSigner, KAT_CLAIMS);
    const b = await issueLicense(katSigner, shuffled);
    expect(b).toBe(a);
    // The signed payload the verifier re-derives is exactly the canonical bytes.
    expect(verifyLicense(a).claims).not.toBeNull();
    const body = a.slice(a.indexOf("-", a.indexOf("-") + 1) + 1);
    const decoded = Buffer.from(body, "base64url");
    expect(decoded.subarray(0, decoded.length - 64).toString("utf8")).toBe(
      KAT_PAYLOAD,
    );
  });

  test("a token signed by the WRONG key → community (forgery rejected)", async () => {
    const forged = await issueLicense(wrongSigner, {
      ...KAT_CLAIMS,
      licenseId: VALID_UUID,
    });
    const result = verifyLicense(forged);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });
});

describe("issueLicense — expiry semantics (perpetual-per-major)", () => {
  const at = new Date("2026-06-30T00:00:00.000Z");

  test("perpetual (expiry null) verifies valid", async () => {
    const token = await issueLicense(katSigner, {
      ...KAT_CLAIMS,
      licenseId: VALID_UUID,
    });
    expect(verifyLicense(token, at).valid).toBe(true);
  });

  test("an in-date expiry verifies valid", async () => {
    const token = await issueLicense(katSigner, {
      entitlements: ["local-ai"],
      expiry: "2099-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    expect(verifyLicense(token, at).valid).toBe(true);
  });

  test("an elapsed expiry → community", async () => {
    const token = await issueLicense(katSigner, {
      entitlements: ["local-ai"],
      expiry: "2020-01-01T00:00:00.000Z",
      licenseId: VALID_UUID,
      major: 1,
      tier: "pro",
    });
    const result = verifyLicense(token, at);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });
});

describe("issueLicense — strict claims (the issuer never signs a bad shape)", () => {
  test("an unknown tier is rejected BEFORE signing (strict parse)", async () => {
    await expect(
      issueLicense(katSigner, { ...KAT_CLAIMS, tier: "enterprise" }),
    ).rejects.toThrow();
  });

  test("an extra/unknown claim is rejected BEFORE signing (.strict())", async () => {
    await expect(
      issueLicense(katSigner, { ...KAT_CLAIMS, forged: true }),
    ).rejects.toThrow();
  });

  test("a non-UUID licenseId is rejected BEFORE signing", async () => {
    await expect(
      issueLicense(katSigner, { ...KAT_CLAIMS, licenseId: "not-a-uuid" }),
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
    const token = await issueLicense(katSigner, {
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
