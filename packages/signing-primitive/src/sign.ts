// src/sign.ts — evidence-pack signing (ADR-0056), carved out of the Compliance edition as the
// standalone signing surface (ADR-0246/0257).
//
// The edge layer that proves PROVENANCE of an evidence pack. The generator (@caisson-sh/compliance-core)
// produces a byte-stable canonical `manifest.json`; this module signs it so a relying party can prove
// *who* sealed it and *what chain state* it was sealed against — without touching the canonical body
// (the signature is DETACHED, so the body stays byte-stable and golden-fixturable, ADR-0013).
//
// Locked design (ADR-0056), each enforced below:
//   1. PER-TENANT Ed25519, DISTINCT FROM THE CAISSON LICENSE KEY. The buyer proves provenance of
//      their OWN evidence with their OWN identity (a key provisioned per tenant, ADR-0045). The
//      license-issuer key (ADR-0010, `crypto.verify` discipline) NEVER signs buyer evidence — wrong
//      trust model. `Ed25519Signer` holds the tenant seed in a private field; it is never logged.
//   2. DETACHED signature over `canonicalize(manifest) ∥ anchor.tipHash`. Binding the WORM
//      audit-chain tip hash ties the pack to the chain state at generation time (ADR-0006/0046).
//      Canonicalization reuses the shipped `audit-chain.ts` primitive, so the signed bytes equal the
//      generator's `pack.canonicalManifest` exactly.
//   3. ONE shared `@noble/ed25519` primitive for sign AND verify — the same curve the license issuer
//      will use, so the verify path is a single primitive across the product.
//   4. RFC-3161 trusted timestamp COUNTERSIGNS the signature (a near-free "existed at time T"
//      attestation over the Ed25519 signature, layered on top — never a replacement). It is
//      test-doubled here: NO live TSA call runs in CI. The live HTTP transport is the
//      only un-exercised path (un-wired seam, ADR-0047 ethos).
//   5. Buyer-supplied AWS KMS Sign and DSSE/in-toto + Sigstore/Rekor are documented UN-WIRED seams,
//      reachable behind the `Signer` / premium-provenance boundary — not the v1 base path.
//
// THE BROWSER SPLIT (ADR-0396): the contracts, the shared `@noble/ed25519` verify path, the signable
// payload, and the RFC-3161 test double live in `./portable.ts` — they were never node-bound, and the
// `node:crypto` import below tainted the whole module for a bundler. They are re-exported here
// verbatim, so this file and the `.` barrel are unchanged for buyers. What stays: the signing identity
// (a tenant secret), and the two constant-time compares that need `node:crypto`'s `timingSafeEqual`.
import { createHash } from "node:crypto";
import * as ed from "@noble/ed25519";
import { safeEqualFixed, ValidationError } from "@caisson-sh/kernel/node";
import {
  ED25519_PUBLIC_BYTES,
  ED25519_SIGNATURE_BYTES,
  bytesToHex,
  evidenceSignablePayload,
  hexToBytes,
} from "./portable.ts";
import type {
  EvidenceSignature,
  SignableManifest,
  SignatureAlgorithm,
  TimestampAuthority,
  TimestampToken,
} from "./portable.ts";

export {
  ED25519_PUBLIC_BYTES,
  ED25519_SIGNATURE_BYTES,
  StubTimestampAuthority,
  evidenceSignablePayload,
  hexToBytes,
  timestampCountersignsSignatureAsync,
  verifyEvidenceSignature,
} from "./portable.ts";
export type {
  EvidenceSignature,
  SignableManifest,
  SignatureAlgorithm,
  TimestampAuthority,
  TimestampToken,
} from "./portable.ts";

const ED25519_SECRET_BYTES = 32;

// --- signer port + Ed25519 implementation ------------------------------------------------------

/**
 * The signing-identity port. The base path is `Ed25519Signer`; a buyer-supplied AWS KMS asymmetric
 * Sign is a drop-in implementation of this same interface (the secret never leaves the HSM) — a
 * documented un-wired seam (ADR-0056), not the v1 base.
 */
export interface Signer {
  /** Identifies the signing identity (per-tenant). Surfaced on the signature for key rotation/lookup. */
  readonly keyId: string;
  readonly algorithm: SignatureAlgorithm;
  /** The public key bytes (verifier-facing). */
  publicKey(): Promise<Uint8Array>;
  /** Produce a DETACHED signature over `payload`. */
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/**
 * Per-tenant Ed25519 signer over `@noble/ed25519`. The 32-byte seed is the tenant's signing key
 * (ADR-0045 derivation), held in a private field and never logged — and it MUST NOT be the Caisson
 * license-issuer key (ADR-0010). Construction fails closed on a malformed key.
 */
export class Ed25519Signer implements Signer {
  readonly algorithm: SignatureAlgorithm = "ed25519";
  readonly keyId: string;
  // Private (#) so the seed is non-enumerable and cannot leak through logging/serialization.
  readonly #secretKey: Uint8Array;

  constructor(keyId: string, secretKey: Uint8Array) {
    const id = keyId.trim();
    if (id.length === 0) {
      throw new ValidationError("signer keyId must be a non-empty string");
    }
    if (secretKey.length !== ED25519_SECRET_BYTES) {
      throw new ValidationError(
        `ed25519 secret key must be ${String(ED25519_SECRET_BYTES)} bytes, got ${String(secretKey.length)}`,
      );
    }
    this.keyId = id;
    this.#secretKey = Uint8Array.from(secretKey); // defensive copy; caller cannot mutate our key
  }

  publicKey(): Promise<Uint8Array> {
    return ed.getPublicKeyAsync(this.#secretKey);
  }

  sign(payload: Uint8Array): Promise<Uint8Array> {
    return ed.signAsync(payload, this.#secretKey);
  }
}

// --- the detached evidence signature -----------------------------------------------------------

export interface SignEvidencePackOptions {
  /** RFC-3161 authority to countersign the signature. Test-doubled in CI; live TSA is an un-wired seam. */
  readonly timestampAuthority?: TimestampAuthority;
}

/**
 * Sign an evidence-pack manifest, producing a detached signature (+ optional RFC-3161 countersign).
 * The signature covers `canonicalize(manifest) ∥ anchor.tipHash`; it is NOT injected into the body,
 * so the manifest stays byte-stable. Fails closed on a malformed signing result.
 */
export async function signEvidencePack(
  signer: Signer,
  manifest: SignableManifest,
  options?: SignEvidencePackOptions,
): Promise<EvidenceSignature> {
  const payload = evidenceSignablePayload(manifest);
  const [publicKeyBytes, signatureBytes] = await Promise.all([
    signer.publicKey(),
    signer.sign(payload),
  ]);
  if (signatureBytes.length !== ED25519_SIGNATURE_BYTES) {
    throw new ValidationError(
      `detached signature must be ${String(ED25519_SIGNATURE_BYTES)} bytes, got ${String(signatureBytes.length)}`,
    );
  }
  if (publicKeyBytes.length !== ED25519_PUBLIC_BYTES) {
    throw new ValidationError(
      `ed25519 public key must be ${String(ED25519_PUBLIC_BYTES)} bytes, got ${String(publicKeyBytes.length)}`,
    );
  }
  const base: EvidenceSignature = {
    algorithm: signer.algorithm,
    keyId: signer.keyId,
    publicKey: bytesToHex(publicKeyBytes),
    signature: bytesToHex(signatureBytes),
  };
  if (options?.timestampAuthority === undefined) return base;
  const timestamp =
    await options.timestampAuthority.countersign(signatureBytes);
  return { ...base, timestamp };
}

/**
 * Constant-time equality for two detached signatures (or public keys) given as hex. Ed25519
 * signatures are deterministic, so the key holder can re-sign and compare; this compare is
 * timing-safe (`safeEqualFixed`) so it never leaks how many leading bytes matched.
 */
export function signaturesEqual(a: string, b: string): boolean {
  return safeEqualFixed(a, b);
}

/**
 * Confirm an RFC-3161 token actually countersigns THIS signature — recompute the messageImprint
 * (`sha256(signature)`) and constant-time compare it to the token's. Fails closed on malformed hex.
 * The browser twin is `timestampCountersignsSignatureAsync` (portable.ts); their verdicts are pinned
 * equal in sign.test.ts.
 */
export function timestampCountersignsSignature(
  token: TimestampToken,
  signature: EvidenceSignature,
): boolean {
  try {
    const expected = createHash("sha256")
      .update(hexToBytes(signature.signature))
      .digest("hex");
    return safeEqualFixed(token.messageImprint, expected);
  } catch {
    return false;
  }
}
