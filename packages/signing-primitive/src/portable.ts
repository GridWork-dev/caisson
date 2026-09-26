// src/portable.ts — the BROWSER-SAFE half of the evidence-signing surface (ADR-0396), carved out of
// sign.ts so a client bundle can run the real verify path instead of a hand-ported copy of it.
//
// WHAT MOVED AND WHY. `sign.ts` imports `node:crypto` at module scope, which taints the WHOLE module
// for a bundler even when the importer only wants `verifyEvidenceSignature`. The verify path itself
// was never node-bound: `@noble/ed25519` is dependency-free pure JS (it reaches only
// `globalThis.crypto`), so the primitive below is the SHIPPED one, byte-for-byte, not a re-implementation
// — locked design point 3 (ONE shared Ed25519 primitive for sign and verify) is preserved exactly.
// The only genuine node dependency in this half was `createHash("sha256")` for the RFC-3161
// messageImprint; it becomes `crypto.subtle.digest("SHA-256", …)`, the same digest over the same bytes,
// pinned against the node path in sign.test.ts.
//
// WHAT DID NOT MOVE: `Ed25519Signer` (holds a tenant secret — a signing identity is not a browser
// concern), `signEvidencePack`, `signaturesEqual`, and the SYNC `timestampCountersignsSignature`.
// That last one keeps its `boolean` return and its constant-time `safeEqualFixed` compare: making it
// async would break every existing caller, so this module adds `timestampCountersignsSignatureAsync`
// alongside it (the `hashChainLinkAsync` precedent in @caisson-sh/kernel) rather than changing it.
//
// EVERY name here is re-exported by sign.ts, so the `.` barrel is unchanged for adopters, and the
// `./browser` entry is a strict SUBSET of it (pinned by browser-safety.test.ts).
import * as ed from "@noble/ed25519";
import {
  canonicalize,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel";

/**
 * The minimal structural shape this module signs: any JSON-serializable, byte-stable manifest body
 * carrying the WORM audit-chain anchor whose tip hash gets bound into the signed payload. The
 * evidence-pack manifest (@caisson-sh/compliance-core) satisfies this shape structurally; the signer
 * deliberately does not depend on that package, so the signing surface stands alone.
 */
export interface SignableManifest {
  readonly chainAnchor: { readonly tipHash: string };
}

/**
 * The signature schemes this surface produces. `ed25519` is the base-tier evidence-pack scheme (pure
 * EdDSA over the full message). `ed25519ph` is the external-anchoring prehash variant (RFC-8032 §5.1,
 * SHA-512 prehash) required by Rekor v2 `hashedrekord` — pure Ed25519 is rejected there (it re-hashes
 * the message it is only given the digest of). A caller-KMS asymmetric scheme would extend this behind
 * the port.
 */
export type SignatureAlgorithm = "ed25519" | "ed25519ph";

export const ED25519_PUBLIC_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;

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

// --- byte codecs (no `Buffer`: it is a node global a bundler substitutes with a polyfill, which is
//     exactly the silent-weight failure this entry exists to avoid). Byte-identical to the
//     `Buffer.from(…).toString("hex" | "base64")` encodings they replace. ------------------------

/** Lowercase hex of a byte array — matches `Buffer.from(bytes).toString("hex")`. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Decode lowercase/uppercase hex, throwing on odd length or a non-hex char (`Buffer` would silently
 * TRUNCATE at the first invalid character, which is how a forged short signature could otherwise
 * reach a verifier as a valid short one).
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new ValidationError("invalid hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Base64 of a byte array — matches `Buffer.from(bytes).toString("base64")`. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Hand WebCrypto a plain `ArrayBuffer` (a `BufferSource`): a subarray/TextEncoder view is
 * `Uint8Array<ArrayBufferLike>`, which the strict `crypto.subtle` signatures reject. Copying into a
 * fresh `Uint8Array` yields an `ArrayBuffer`-backed buffer every call site accepts.
 */
function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/** `sha256(bytes)` as lowercase hex — the WebCrypto twin of `createHash("sha256").digest("hex")`. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bufferSource(bytes));
  return bytesToHex(new Uint8Array(digest));
}

/** Fixed-work comparison for a SHA-256 hex digest without importing node:crypto into the browser. */
function safeEqualSha256Hex(actual: string, expected: string): boolean {
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < expected.length; i += 1) {
    difference |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
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
    const signatureBytes = hexToBytes(signature.signature);
    const publicKeyBytes = hexToBytes(signature.publicKey);
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

  async countersign(signature: Uint8Array): Promise<TimestampToken> {
    const messageImprint = await sha256Hex(signature);
    const timestampedAt = this.#clock.toISOString();
    const token = bytesToBase64(
      new TextEncoder().encode(
        `rfc3161|${this.#authority}|${messageImprint}|${timestampedAt}`,
      ),
    );
    return {
      authority: this.#authority,
      algorithm: "rfc3161",
      hashAlgorithm: "sha256",
      messageImprint,
      token,
      timestampedAt,
    };
  }
}

/**
 * The browser-safe twin of `timestampCountersignsSignature`: recompute the messageImprint
 * (`sha256(signature)`) and compare it to the token's. Fails closed on malformed hex. A NEW async
 * name rather than a signature change to the sync one — a browser has only the async
 * `crypto.subtle.digest`, and the sync function's `boolean` contract is published.
 *
 * Both imprints are fixed-length SHA-256 hex digests. The comparison does the same amount of work for
 * every candidate of the expected length, matching the node twin's fail-closed comparison without
 * importing node:crypto. Verdict parity between the two paths is pinned in sign.test.ts.
 */
export async function timestampCountersignsSignatureAsync(
  token: TimestampToken,
  signature: EvidenceSignature,
): Promise<boolean> {
  try {
    const expected = await sha256Hex(hexToBytes(signature.signature));
    return safeEqualSha256Hex(token.messageImprint, expected);
  } catch {
    return false;
  }
}
