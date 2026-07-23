// The deterministic engine behind the @caisson/signing-primitive "verify workbench" poke (ADR-0378
// lock 2). Pure TypeScript, NO React. It runs the REAL detached-Ed25519 verify path in the browser:
// the package's sign.ts imports node:crypto (createHash) at module top, which taints the whole module
// for a client bundle, so this file MIRRORS the pure verify surface via WebCrypto (crypto.subtle
// Ed25519 + SHA-256) and PINS boolean/byte parity against the real package + its __golden__ fixtures
// in signing-primitive-logic.test.ts. Every constant, name, and value below is cited to the source it
// mirrors; the test is the proof they stay identical. Nothing here fetches, persists, or measures.
//
// Mirrors:
//   canonicalize / sortValue                       → packages/kernel/src/canonical.ts (recursive key sort)
//   evidenceSignablePayload                        → packages/signing-primitive/src/sign.ts
//                                                    (canonicalize(manifest) ∥ chainAnchor.tipHash)
//   verifyEvidenceSignature                        → sign.ts (one shared Ed25519 primitive, fail-closed)
//   timestampCountersignsSignature                 → sign.ts (recompute sha256(signature), compare imprint)
//   the sample manifest / signature / public key   → packages/signing-primitive/src/__golden__/* + sign.test.ts
//   sampleCountersign (RFC-3161 test double)       → sign.ts StubTimestampAuthority.countersign

// --- shared JSON value type (mirror of kernel canonical.ts JsonValue) ---------------------------
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** The signature schemes the surface produces (sign.ts SignatureAlgorithm). Only ed25519 verifies here. */
export type SignatureAlgorithm = "ed25519" | "ed25519ph";

/** The minimal structural shape that gets signed: the WORM audit-chain anchor tip (sign.ts SignableManifest). */
export interface SignableManifest {
  readonly chainAnchor: { readonly tipHash: string };
}

/** A detached evidence-pack signature - sits BESIDE the pack, never inside the canonical body (sign.ts). */
export interface EvidenceSignature {
  readonly algorithm: SignatureAlgorithm;
  readonly keyId: string;
  /** The Ed25519 public key, lowercase hex (64 chars). */
  readonly publicKey: string;
  /** The detached Ed25519 signature over evidenceSignablePayload, lowercase hex (128 chars). */
  readonly signature: string;
  readonly timestamp?: TimestampToken;
}

/** The RFC-3161 trusted-timestamp countersignature over a detached signature (sign.ts TimestampToken). */
export interface TimestampToken {
  readonly authority: string;
  readonly algorithm: "rfc3161";
  readonly hashAlgorithm: "sha256";
  /** sha256(detached signature) - the RFC-3161 messageImprint the TSA attests to (lowercase hex). */
  readonly messageImprint: string;
  /** Opaque TSA token. Test double = deterministic base64; a live TSA returns a DER TimeStampToken. */
  readonly token: string;
  /** The instant the TSA attests the signature existed at (ISO-8601). */
  readonly timestampedAt: string;
}

// --- constants mirrored from packages/signing-primitive/src/sign.ts ---
export const ED25519_PUBLIC_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;

// --- browser-safe byte codecs (no node Buffer; match Buffer hex/base64 byte-for-byte) -----------
function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Decode lowercase/uppercase hex, throwing on odd length or a non-hex char (sign.ts fromHex). */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error("invalid hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Hand WebCrypto a plain ArrayBuffer (a BufferSource): a TextEncoder/subarray view is
// Uint8Array<ArrayBufferLike>, which the strict lib.dom crypto.subtle signatures reject. Copying into
// a fresh Uint8Array yields an ArrayBuffer-backed buffer every call site accepts.
function ab(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

// --- canonicalization (mirror of kernel canonical.ts; browser/edge-safe by construction) --------

/** Recursively sort object keys; preserve array order; reject non-finite numbers (canonical.ts sortValue). */
function sortValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(
        `signing-primitive: non-finite number is not canonicalizable: ${String(value)}`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as { readonly [key: string]: JsonValue };
  const out: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortValue(obj[key] as JsonValue);
  }
  return out;
}

/** Deterministic serialization of a JSON value: keys sorted recursively, array order kept (canonical.ts). */
export function canonicalize(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

/** Round-trip to a genuine JsonValue (drops undefined) so canonicalize accepts the manifest (sign.ts toJsonValue). */
function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/**
 * The exact bytes that get signed: the canonicalized manifest body concatenated with the WORM
 * audit-chain tip hash (sign.ts evidenceSignablePayload, ADR-0056). The JSON body ends in `}` and the
 * tip is a fixed-width 64-char hex digest, so the boundary is unambiguous.
 */
export function evidenceSignablePayload(
  manifest: SignableManifest,
): Uint8Array {
  const canonical = canonicalize(toJsonValue(manifest));
  return new TextEncoder().encode(canonical + manifest.chainAnchor.tipHash);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", ab(bytes));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Verify a detached evidence signature against the manifest via the one WebCrypto Ed25519 primitive
 * (mirror of sign.ts verifyEvidenceSignature). Fails CLOSED: an unknown algorithm, malformed hex,
 * wrong-length key/signature, or any verification error returns false rather than throwing.
 */
export async function verifyEvidenceSignature(
  manifest: SignableManifest,
  signature: EvidenceSignature,
): Promise<boolean> {
  if (signature.algorithm !== "ed25519") return false;
  try {
    const payload = evidenceSignablePayload(manifest);
    const signatureBytes = fromHex(signature.signature);
    const publicKeyBytes = fromHex(signature.publicKey);
    if (
      signatureBytes.length !== ED25519_SIGNATURE_BYTES ||
      publicKeyBytes.length !== ED25519_PUBLIC_BYTES
    ) {
      return false;
    }
    const key = await crypto.subtle.importKey(
      "raw",
      ab(publicKeyBytes),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      ab(signatureBytes),
      ab(payload),
    );
  } catch {
    return false;
  }
}

/**
 * Confirm an RFC-3161 token actually countersigns THIS signature - recompute the messageImprint
 * (sha256(signature)) and compare it to the token's (mirror of sign.ts timestampCountersignsSignature).
 * Fails closed on malformed hex. The imprints are PUBLIC integrity tags, so plain equality is correct.
 * ponytail: the shipped path uses safeEqualFixed (a public-tag compare, not a secret) - a client demo
 * of two public hex digests needs no timing-safe compare; the byte result is identical.
 */
export async function timestampCountersignsSignature(
  token: TimestampToken,
  signature: EvidenceSignature,
): Promise<boolean> {
  try {
    const expected = await sha256Hex(fromHex(signature.signature));
    return (
      token.messageImprint.length === expected.length &&
      token.messageImprint === expected
    );
  } catch {
    return false;
  }
}

// --- the RFC-3161 test-double countersign (mirror of sign.ts StubTimestampAuthority.countersign) --
// The shipped surface test-doubles the TSA (NO live network call runs in CI, sign.ts); this reproduces
// its deterministic token for the receipt readout. Parity-pinned against the real stub in the test.

/** The stub authority's default identity (sign.ts StubTimestampAuthority default). */
export const SAMPLE_TSA_AUTHORITY = "urn:caisson:test-tsa";
/** A fixed sample instant (the date the package's own countersign test stamps). Deterministic, no clock read. */
export const SAMPLE_TIMESTAMPED_AT = "2026-06-27T12:00:00.000Z";

export async function sampleCountersign(
  signature: EvidenceSignature,
): Promise<TimestampToken> {
  const messageImprint = await sha256Hex(fromHex(signature.signature));
  const token = bytesToBase64(
    new TextEncoder().encode(
      `rfc3161|${SAMPLE_TSA_AUTHORITY}|${messageImprint}|${SAMPLE_TIMESTAMPED_AT}`,
    ),
  );
  return {
    authority: SAMPLE_TSA_AUTHORITY,
    algorithm: "rfc3161",
    hashAlgorithm: "sha256",
    messageImprint,
    token,
    timestampedAt: SAMPLE_TIMESTAMPED_AT,
  };
}

// --- sample data (labeled as samples in the UI; byte-pinned to real package source in the test) ---

/** The rendered slice of the sample manifest shape (the rest is opaque JSON the signature still covers). */
export interface EvidenceManifestSample extends SignableManifest {
  readonly formatVersion: string;
  readonly tenantId: string;
  readonly framework: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
  };
  readonly chainAnchor: {
    readonly length: number;
    readonly tipHash: string;
    readonly genesisHash: string;
  };
  readonly summary: {
    readonly totalControls: number;
    readonly controlsReady: number;
    readonly controlsWithGaps: number;
    readonly totalEvidenceItems: number;
    readonly posture: string;
  };
}

// The VERBATIM golden evidence pack (packages/signing-primitive/src/__golden__/evidence-pack.manifest.json).
// Embedded as a byte-parity fixture so the whole verify runs client-side with no cross-package bundle
// import; deep-equality against the real golden file is pinned in the test. The lone em dash in a
// framework/statement string is written - so no raw em dash byte lands in this file (ADR-0375)
// while the runtime string stays byte-identical to the golden the signature was taken over.
// ponytail: a JSON.parse of the verbatim fixture, not a hand-typed literal - one source of truth, and
// a transcription error would fail the golden test loudly.
const SAMPLE_MANIFEST_JSON = `{
  "formatVersion": "2",
  "tenantId": "tenant-acme-prod",
  "framework": {
    "id": "soc2-tsc",
    "title": "SOC 2 \u2014 Trust Services Criteria",
    "version": "2024.1"
  },
  "chainAnchor": {
    "length": 128,
    "tipHash": "0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d",
    "genesisHash": "9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c"
  },
  "controls": [
    {
      "controlId": "AUDIT.IMMUTABLE-LOG",
      "title": "Immutable audit log",
      "family": "Audit & Accountability",
      "statement": "Security-relevant events are written to an append-only, hash-chained log that cannot be altered or deleted after the fact, and the chain is anchored in WORM storage.",
      "crosswalk": [
        {
          "framework": "SOC2-TSC",
          "reference": "CC7.2",
          "note": "System monitoring"
        },
        {
          "framework": "HIPAA-Security",
          "reference": "164.312(b)"
        }
      ],
      "evidence": [
        {
          "collectorId": "substrate.audit-chain-integrity",
          "title": "Append-only audit chain integrity (WORM-anchored)",
          "summary": "audit chain verified against its anchor (128 entries)",
          "status": "pass",
          "facts": {
            "entryCount": 128,
            "anchorPresent": true,
            "anchorLength": 128,
            "valid": true,
            "brokenAt": null
          },
          "manualSlots": []
        },
        {
          "collectorId": "substrate.worm-retention",
          "title": "WORM retention floor met for the locked artifact",
          "summary": "locked artifact retained beyond the legal floor",
          "status": "pass",
          "facts": {
            "mode": "GOVERNANCE",
            "retainUntil": "2032-06-27T00:00:00.000Z",
            "requiredUntil": "2031-06-27T00:00:00.000Z",
            "meetsFloor": true
          },
          "manualSlots": [
            {
              "id": "retention-policy-pdf",
              "label": "Signed records-retention policy (PDF)",
              "required": false,
              "filled": false
            }
          ]
        }
      ],
      "readiness": "ready"
    },
    {
      "controlId": "DATA-PROTECTION.TENANT-ISOLATION",
      "title": "Row-level tenant isolation",
      "family": "Access Control",
      "statement": "Every tenant-scoped table enforces FORCE row-level security so that no role \u2014 including the table owner \u2014 can read or write another tenant's rows.",
      "crosswalk": [
        {
          "framework": "SOC2-TSC",
          "reference": "CC6.1"
        }
      ],
      "evidence": [
        {
          "collectorId": "substrate.rls-force",
          "title": "FORCE row-level security posture",
          "summary": "one tenant table is missing a FORCE RLS policy",
          "status": "flagged",
          "reason": "table \\"legacy_export\\" has RLS enabled but not FORCEd; a table owner could bypass the policy",
          "facts": {
            "tablesChecked": 6,
            "tablesForced": 5,
            "tablesMissingForce": 1,
            "missing": [
              "legacy_export"
            ]
          },
          "manualSlots": []
        }
      ],
      "readiness": "gap"
    }
  ],
  "summary": {
    "totalControls": 2,
    "controlsReady": 1,
    "controlsWithGaps": 1,
    "totalEvidenceItems": 3,
    "posture": "1 of 2 controls evidence-ready; 1 gap recorded as a remediation item."
  },
  "crosswalkRollup": {
    "cells": [
      {
        "framework": "HIPAA-Security",
        "reference": "164.312(b)",
        "canonicalControlIds": [
          "AUDIT.IMMUTABLE-LOG"
        ],
        "status": "ready",
        "claim": "maps-to",
        "evidencePointers": [
          "AUDIT.IMMUTABLE-LOG"
        ]
      },
      {
        "framework": "SOC2-TSC",
        "reference": "CC6.1",
        "canonicalControlIds": [
          "DATA-PROTECTION.TENANT-ISOLATION"
        ],
        "status": "gap",
        "claim": "maps-to",
        "evidencePointers": [
          "DATA-PROTECTION.TENANT-ISOLATION"
        ]
      },
      {
        "framework": "SOC2-TSC",
        "reference": "CC7.2",
        "canonicalControlIds": [
          "AUDIT.IMMUTABLE-LOG"
        ],
        "status": "ready",
        "claim": "maps-to",
        "evidencePointers": [
          "AUDIT.IMMUTABLE-LOG"
        ]
      }
    ]
  }
}`;

export const SAMPLE_MANIFEST = JSON.parse(
  SAMPLE_MANIFEST_JSON,
) as EvidenceManifestSample;

/**
 * The sample detached signature - the byte-pinned golden. `signature` is __golden__/signed-manifest.sig
 * verbatim; `publicKey` + `keyId` are the fixed per-tenant test identity that produced it (sign.test.ts
 * TENANT_PUBLIC_KEY / TENANT_KEY_ID). Every field is re-derived and pinned in the test. Never real key
 * material - a fixed non-secret KAT seed.
 */
export const SAMPLE_SIGNATURE: EvidenceSignature = {
  algorithm: "ed25519",
  keyId: "tenant-acme-prod/evidence-signing/v1",
  publicKey: "2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12",
  signature:
    "df3ffdd47e9eb76bdd8c785eece809c4ddf6854e025d1f0879d4eb24c65364e0b6c8fd90ad44f36532b20d2ad173c6ca0d209143e8b014cc7fcce8a4abba4c09",
};

/** The foreign key for the swap-the-key tamper - the exact one the package's own test forges with. */
export const FOREIGN_PUBLIC_KEY = "00".repeat(32);

/** Flip one byte of a hex string (XOR the first byte's low bit) - the flip-one-payload-byte tamper. */
export function flipTipByte(tipHash: string): string {
  const firstByte = Number.parseInt(tipHash.slice(0, 2), 16) ^ 0x01;
  return firstByte.toString(16).padStart(2, "0") + tipHash.slice(2);
}

/** Build the tampered manifest: one flipped chain-tip byte, everything else intact (the anchor is signed). */
export function withTamperedTip(
  manifest: EvidenceManifestSample,
): EvidenceManifestSample {
  return {
    ...manifest,
    chainAnchor: {
      ...manifest.chainAnchor,
      tipHash: flipTipByte(manifest.chainAnchor.tipHash),
    },
  };
}
