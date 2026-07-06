// src/sign.ts — evidence-pack signing (ADR-0056), carved out of the Compliance edition as the
// standalone signing surface (ADR-0246/0257).
//
// The edge layer that proves PROVENANCE of an evidence pack. The generator (@caisson/compliance-core)
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
import { createHash } from "node:crypto";
import * as ed from "@noble/ed25519";
import {
  canonicalize,
  safeEqualFixed,
  ValidationError,
  type JsonValue,
} from "@caisson/kernel";

/**
 * The minimal structural shape this module signs: any JSON-serializable, byte-stable manifest body
 * carrying the WORM audit-chain anchor whose tip hash gets bound into the signed payload. The
 * evidence-pack manifest (@caisson/compliance-core) satisfies this shape structurally; the signer
 * deliberately does not depend on that package, so the signing surface stands alone.
 */
export interface SignableManifest {
  readonly chainAnchor: { readonly tipHash: string };
}

/** The base-tier signature scheme. A buyer-KMS asymmetric scheme would extend this behind the port. */
export type SignatureAlgorithm = "ed25519";

const ED25519_SECRET_BYTES = 32;
const ED25519_PUBLIC_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

// --- hex helpers (strict; no silent truncation) ------------------------------------------------

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** Decode lowercase/uppercase hex, throwing on odd length or a non-hex char (Buffer would truncate). */
function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new ValidationError("invalid hex string");
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/** Round-trip to a genuine `JsonValue` (drops `undefined`) so `canonicalize` accepts the manifest. */
function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/**
 * The exact bytes that get signed: the canonicalized manifest body concatenated with the WORM
 * audit-chain tip hash (ADR-0056). The JSON body ends in `}` and the tip is a fixed-width 64-char
 * hex digest, so the `∥` boundary is unambiguous. Byte-identical to the generator's
 * `pack.canonicalManifest ∥ pack.manifest.chainAnchor.tipHash`.
 */
export function evidenceSignablePayload(
  manifest: SignableManifest,
): Uint8Array {
  const canonical = canonicalize(toJsonValue(manifest));
  return new TextEncoder().encode(canonical + manifest.chainAnchor.tipHash);
}

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

// --- RFC-3161 timestamp countersignature -------------------------------------------------------

/** The trusted-timestamp countersignature over a detached signature (RFC-3161). */
export interface TimestampToken {
  readonly authority: string;
  readonly algorithm: "rfc3161";
  readonly hashAlgorithm: "sha256";
  /** `sha256(detached signature)` — the RFC-3161 messageImprint the TSA attests to (lowercase hex). */
  readonly messageImprint: string;
  /** Opaque TSA token. Test double = deterministic base64; a live TSA returns a DER `TimeStampToken`. */
  readonly token: string;
  /** The instant the TSA attests the signature existed at (ISO-8601). */
  readonly timestampedAt: string;
}

/**
 * The RFC-3161 authority port. `countersign` attests that a signature existed at a point in time.
 *
 * UN-WIRED LIVE SEAM (ADR-0056, ADR-0047 ethos): a live TSA implementation of this
 * port POSTs a DER `TimeStampReq` (messageImprint = `sha256(signature)`) to the authority over
 * `fetchWithTimeout(tsaUrl, init, ms)` — NEVER the native `AbortSignal.timeout` helper — and parses
 * the DER `TimeStampResp`. It is intentionally NOT wired in v1: no live network call runs on the CI
 * path, leaving the live transport as the only un-exercised path.
 */
export interface TimestampAuthority {
  countersign(signature: Uint8Array): Promise<TimestampToken>;
}

/**
 * A deterministic, network-free RFC-3161 test double. It reproduces the messageImprint a real
 * TSA would attest (`sha256(signature)`) and stamps an injected clock, so countersigning is fully
 * exercised in CI without a live authority. NOT for production use.
 */
export class StubTimestampAuthority implements TimestampAuthority {
  readonly #authority: string;
  readonly #clock: Date;

  constructor(options?: { readonly authority?: string; readonly now?: Date }) {
    this.#authority = options?.authority ?? "urn:caisson:test-tsa";
    this.#clock = options?.now ?? new Date(0);
  }

  countersign(signature: Uint8Array): Promise<TimestampToken> {
    const messageImprint = createHash("sha256").update(signature).digest("hex");
    const timestampedAt = this.#clock.toISOString();
    const token = Buffer.from(
      `rfc3161|${this.#authority}|${messageImprint}|${timestampedAt}`,
      "utf8",
    ).toString("base64");
    return Promise.resolve({
      authority: this.#authority,
      algorithm: "rfc3161",
      hashAlgorithm: "sha256",
      messageImprint,
      token,
      timestampedAt,
    });
  }
}

// --- the detached evidence signature -----------------------------------------------------------

/** A detached evidence-pack signature — sits BESIDE the pack, never inside the canonical body. */
export interface EvidenceSignature {
  readonly algorithm: SignatureAlgorithm;
  /** The per-tenant signing-key id (provenance / rotation lookup). */
  readonly keyId: string;
  /** The Ed25519 public key, lowercase hex (64 chars). */
  readonly publicKey: string;
  /** The detached Ed25519 signature over `evidenceSignablePayload`, lowercase hex (128 chars). */
  readonly signature: string;
  /** The optional RFC-3161 countersignature (present iff a `TimestampAuthority` was supplied). */
  readonly timestamp?: TimestampToken;
}

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
    publicKey: toHex(publicKeyBytes),
    signature: toHex(signatureBytes),
  };
  if (options?.timestampAuthority === undefined) return base;
  const timestamp =
    await options.timestampAuthority.countersign(signatureBytes);
  return { ...base, timestamp };
}

/**
 * Verify a detached evidence signature against the manifest, reusing the one shared `@noble/ed25519`
 * primitive. Fails CLOSED: an unknown algorithm, malformed hex, wrong-length key/signature, or any
 * verification error returns `false` rather than throwing — a forgery must not pass as valid.
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
    return await ed.verifyAsync(signatureBytes, payload, publicKeyBytes);
  } catch {
    return false;
  }
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
 */
export function timestampCountersignsSignature(
  token: TimestampToken,
  signature: EvidenceSignature,
): boolean {
  try {
    const expected = createHash("sha256")
      .update(fromHex(signature.signature))
      .digest("hex");
    return safeEqualFixed(token.messageImprint, expected);
  } catch {
    return false;
  }
}
