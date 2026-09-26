// src/sign.test.ts — evidence-pack signing (ADR-0056).
//
// Golden-with-logic (ADR-0013): the detached signature is byte-pinned by
// `__golden__/signed-manifest.sig`, shipped in THIS commit alongside the code it pins, because the
// golden IS the deterministic output of the logic (a fixed test key over the fixed golden body).
// Run with `BLESS` unset — the .sig golden is read directly and compared in constant time.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  anchorChain,
  buildChain,
  canonicalize,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import {
  Ed25519Signer,
  StubTimestampAuthority,
  type EvidenceSignature,
  evidenceSignablePayload,
  signEvidencePack,
  signaturesEqual,
  timestampCountersignsSignature,
  timestampCountersignsSignatureAsync,
  type SignableManifest,
  verifyEvidenceSignature,
} from "./sign.ts";

interface EvidencePackManifestFixture extends SignableManifest {
  readonly tenantId: string;
  readonly chainAnchor: {
    readonly length: number;
    readonly tipHash: string;
    readonly genesisHash: string;
  };
  readonly [key: string]: unknown;
}

// A FIXED per-tenant test key (32-byte seed) — deterministic, and DISTINCT from any other Caisson
// signing key (ADR-0056 trust model). Its derived public key is pinned below.
const TENANT_SEED = Uint8Array.from(Buffer.from("42".repeat(32), "hex"));
const TENANT_KEY_ID = "tenant-acme-prod/evidence-signing/v1";
const TENANT_PUBLIC_KEY =
  "2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12";

/** A second, distinct per-tenant key — used to prove signing identity is per-tenant, not shared. */
const OTHER_SEED = Uint8Array.from(Buffer.from("a7".repeat(32), "hex"));

/** The golden canonical body (the byte-stable manifest the generator emits), parsed + validated. */
function goldenManifest(): EvidencePackManifestFixture {
  return JSON.parse(
    readFileSync(
      new URL("./__golden__/evidence-pack.manifest.json", import.meta.url),
      "utf8",
    ),
  ) as EvidencePackManifestFixture;
}

/** The byte-pinned detached signature golden (raw hex, no framing). */
function goldenSignatureHex(): string {
  return readFileSync(
    new URL("./__golden__/signed-manifest.sig", import.meta.url),
    "utf8",
  ).trim();
}

describe("evidenceSignablePayload — canonical body ∥ chain tip (ADR-0056)", () => {
  test("is the canonical manifest bytes concatenated with the WORM tip hash", () => {
    const manifest = goldenManifest();
    const golden = JSON.parse(
      readFileSync(
        new URL("./__golden__/evidence-pack.manifest.json", import.meta.url),
        "utf8",
      ),
    ) as JsonValue;
    const expected = canonicalize(golden) + manifest.chainAnchor.tipHash;
    expect(new TextDecoder().decode(evidenceSignablePayload(manifest))).toBe(
      expected,
    );
  });

  test("the signed payload excludes the wall clock and any signature field", () => {
    const payload = new TextDecoder().decode(
      evidenceSignablePayload(goldenManifest()),
    );
    expect(payload).not.toMatch(/generatedAt|signature/);
  });
});

describe("signEvidencePack — deterministic detached Ed25519 (golden, BLESS unset)", () => {
  test("the detached signature is byte-stable against the golden .sig", async () => {
    const signer = new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED);
    const sig = await signEvidencePack(signer, goldenManifest());

    expect(sig.algorithm).toBe("ed25519");
    expect(sig.keyId).toBe(TENANT_KEY_ID);
    expect(sig.publicKey).toBe(TENANT_PUBLIC_KEY);
    expect(sig.signature).toHaveLength(128);
    // Constant-time compare against the committed golden (timing-safe sig compare).
    expect(signaturesEqual(sig.signature, goldenSignatureHex())).toBe(true);
    // Plain equality too, for a readable diff on drift.
    expect(sig.signature).toBe(goldenSignatureHex());
  });

  test("signing is deterministic — the same key + body yields the same signature", async () => {
    const a = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      goldenManifest(),
    );
    const b = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      goldenManifest(),
    );
    expect(a.signature).toBe(b.signature);
  });

  test("the signature is DETACHED — it never enters the canonical body", () => {
    // The manifest schema has no signature field; the body the generator canonicalizes is unchanged.
    const manifest = goldenManifest();
    expect("signature" in manifest).toBe(false);
    expect(
      canonicalize(JSON.parse(JSON.stringify(manifest)) as JsonValue),
    ).not.toMatch(/signature/);
  });
});

describe("verifyEvidenceSignature — one shared @noble/ed25519 primitive", () => {
  test("a valid signature verifies", async () => {
    const manifest = goldenManifest();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
    );
    expect(await verifyEvidenceSignature(manifest, sig)).toBe(true);
  });

  test("a tampered manifest fails verification (TM-L)", async () => {
    const manifest = goldenManifest();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
    );
    const tampered: EvidencePackManifestFixture = {
      ...manifest,
      tenantId: "tenant-evil-co",
    };
    expect(await verifyEvidenceSignature(tampered, sig)).toBe(false);
  });

  test("a flipped chain tip fails verification (the anchor is bound into the payload)", async () => {
    const manifest = goldenManifest();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
    );
    const movedTip: EvidencePackManifestFixture = {
      ...manifest,
      chainAnchor: { ...manifest.chainAnchor, tipHash: "f".repeat(64) },
    };
    expect(await verifyEvidenceSignature(movedTip, sig)).toBe(false);
  });

  test("a foreign public key fails verification", async () => {
    const manifest = goldenManifest();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
    );
    const forged = { ...sig, publicKey: "00".repeat(32) };
    expect(await verifyEvidenceSignature(manifest, forged)).toBe(false);
  });

  test("fails CLOSED on a malformed signature / unknown algorithm (never throws)", async () => {
    const manifest = goldenManifest();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
    );
    expect(
      await verifyEvidenceSignature(manifest, { ...sig, signature: "zz" }),
    ).toBe(false);
    expect(
      await verifyEvidenceSignature(manifest, { ...sig, signature: "ab" }),
    ).toBe(false);
    expect(
      await verifyEvidenceSignature(manifest, {
        ...sig,
        algorithm: "rsa" as unknown as "ed25519",
      }),
    ).toBe(false);
  });
});

describe("per-tenant key, distinct from the Caisson license key (ADR-0056)", () => {
  test("different per-tenant keys yield different public keys and signatures", async () => {
    const manifest = goldenManifest();
    const a = await signEvidencePack(
      new Ed25519Signer("tenant-a/v1", TENANT_SEED),
      manifest,
    );
    const b = await signEvidencePack(
      new Ed25519Signer("tenant-b/v1", OTHER_SEED),
      manifest,
    );
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(signaturesEqual(a.signature, b.signature)).toBe(false);
    // Each signature verifies only under its own identity — no cross-tenant acceptance.
    expect(await verifyEvidenceSignature(manifest, a)).toBe(true);
    expect(
      await verifyEvidenceSignature(manifest, { ...a, publicKey: b.publicKey }),
    ).toBe(false);
  });

  test("the signer rejects a malformed key fail-closed", () => {
    expect(() => new Ed25519Signer(TENANT_KEY_ID, new Uint8Array(31))).toThrow(
      ValidationError,
    );
    expect(() => new Ed25519Signer("  ", TENANT_SEED)).toThrow(ValidationError);
  });
});

describe("RFC-3161 countersignature — test-doubled, no live CI call (TM-M)", () => {
  test("the timestamp countersigns the signature and layers on top of it", async () => {
    const manifest = goldenManifest();
    const tsa = new StubTimestampAuthority({
      now: new Date("2026-06-27T12:00:00.000Z"),
    });
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
      { timestampAuthority: tsa },
    );

    expect(sig.timestamp).toBeDefined();
    const token = sig.timestamp;
    if (token === undefined) throw new Error("expected a timestamp token");
    expect(token.algorithm).toBe("rfc3161");
    expect(token.timestampedAt).toBe("2026-06-27T12:00:00.000Z");
    // The token attests to sha256(signature) — it countersigns THIS signature, not the body.
    const expectedImprint = createHash("sha256")
      .update(Buffer.from(sig.signature, "hex"))
      .digest("hex");
    expect(token.messageImprint).toBe(expectedImprint);
    expect(timestampCountersignsSignature(token, sig)).toBe(true);
    // The countersign is additive: the underlying Ed25519 signature still verifies on its own.
    expect(await verifyEvidenceSignature(manifest, sig)).toBe(true);
  });

  test("absent a TSA, no timestamp is attached (countersign is optional)", async () => {
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      goldenManifest(),
    );
    expect(sig.timestamp).toBeUndefined();
  });

  test("timestampCountersignsSignature rejects a token bound to a different signature", async () => {
    const manifest = goldenManifest();
    const tsa = new StubTimestampAuthority();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
      { timestampAuthority: tsa },
    );
    const token = sig.timestamp;
    if (token === undefined) throw new Error("expected a timestamp token");
    const other = await signEvidencePack(
      new Ed25519Signer("tenant-b/v1", OTHER_SEED),
      manifest,
    );
    expect(timestampCountersignsSignature(token, other)).toBe(false);
  });

  // The ./browser entry (ADR-0396) cannot use the sync node:crypto path, so portable.ts adds an
  // async WebCrypto twin. Two implementations of one rule only stay honest if their verdicts are
  // pinned equal — including on the fail-closed branches, where a twin that threw instead of
  // returning false would hand a client a crash where the node path hands it a `false`.
  test("the async browser twin returns the same verdict as the node path, every branch", async () => {
    const manifest = goldenManifest();
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
      {
        timestampAuthority: new StubTimestampAuthority({
          now: new Date("2026-06-27T12:00:00.000Z"),
        }),
      },
    );
    const token = sig.timestamp;
    if (token === undefined) throw new Error("expected a timestamp token");
    const other = await signEvidencePack(
      new Ed25519Signer("tenant-b/v1", OTHER_SEED),
      manifest,
    );
    const cases: readonly EvidenceSignature[] = [
      sig,
      other,
      { ...sig, signature: "zz" },
      { ...sig, signature: "abc" },
      { ...sig, signature: "" },
    ];
    for (const candidate of cases) {
      expect(await timestampCountersignsSignatureAsync(token, candidate)).toBe(
        timestampCountersignsSignature(token, candidate),
      );
    }
    // …and the shared verdict is not uniformly false, which would make the loop vacuous.
    expect(timestampCountersignsSignature(token, sig)).toBe(true);
  });
});

describe("signaturesEqual — constant-time sig compare (TM-L)", () => {
  test("true for identical hex, false for an equal-length difference", () => {
    const a = "ab".repeat(64);
    const b = "ab".repeat(64);
    const c = `${"ab".repeat(63)}cd`;
    expect(signaturesEqual(a, b)).toBe(true);
    expect(signaturesEqual(a, c)).toBe(false);
  });
});

describe("integration — sign a manifest-shaped fixture", () => {
  test("a structural evidence-pack manifest round-trips through sign + verify", async () => {
    const entries = buildChain(
      Array.from({ length: 8 }, (_unused, i) => ({ seq: i, event: "lock" })),
    );
    const anchor = anchorChain(entries);
    if (anchor.genesisHash === undefined) {
      throw new Error("expected an anchored non-empty chain");
    }
    const manifest = {
      formatVersion: "2",
      tenantId: "tenant-acme-prod",
      framework: {
        id: "soc2-tsc",
        title: "SOC 2 — Trust Services Criteria",
        version: "2024.1",
      },
      chainAnchor: {
        length: anchor.length,
        tipHash: anchor.tipHash,
        genesisHash: anchor.genesisHash,
      },
      controls: [
        {
          controlId: "AUDIT.IMMUTABLE-LOG",
          title: "Immutable audit log",
          family: "Audit & Accountability",
          statement:
            "Security-relevant events are written to an append-only, hash-chained log anchored in WORM storage.",
          crosswalk: [{ framework: "SOC2-TSC", reference: "CC7.2" }],
          evidence: [
            {
              collectorId: "substrate.audit-chain-integrity",
              title: "Append-only audit chain integrity",
              summary: `audit chain verified (${String(entries.length)} entries)`,
              status: "pass",
              facts: { entryCount: entries.length, valid: true },
              manualSlots: [],
            },
          ],
          readiness: "ready",
        },
      ],
      summary: {
        totalControls: 1,
        controlsReady: 1,
        controlsWithGaps: 0,
        totalEvidenceItems: 1,
        posture: "1 of 1 controls evidence-ready.",
      },
      crosswalkRollup: { cells: [] },
    } satisfies EvidencePackManifestFixture;
    const sig = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      manifest,
    );
    const canonicalManifest = canonicalize(manifest as JsonValue);
    // The signed bytes equal exactly the canonical body ∥ the chain tip.
    expect(new TextDecoder().decode(evidenceSignablePayload(manifest))).toBe(
      canonicalManifest + anchor.tipHash,
    );
    expect(await verifyEvidenceSignature(manifest, sig)).toBe(true);
  });
});
