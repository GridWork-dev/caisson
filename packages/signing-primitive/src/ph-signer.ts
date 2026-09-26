// src/ph-signer.ts — the DEPLOYMENT-LEVEL Ed25519ph anchoring signer for external anchoring
// (SPEC external-anchoring §Design, Fork R-α / ADR-0346 §5).
//
// Rekor v2 `hashedrekord` rejects a PURE Ed25519 signature (it is given only a digest and would
// re-hash it), so the accepted binding is Ed25519ph — the RFC-8032 §5.1 prehash variant. Fork R-α
// locks this to a DEPLOYMENT anchoring key, NOT the per-tenant seed: `externally-transparent` trust
// comes entirely from public-log inclusion (checkpoint + proof), and the anchor bytes already commit
// each tenant's chain tip via `tipHash`, so Rekor only needs SOME valid verifier material — not
// authorship trust. A deployment key removes the hardest surface (reaching a BYOK/KMS/crypto-shredded
// tenant key from a background job) with no loss of the property being sold.
//
// This is DISTINCT from `@caisson-sh/audit-worm`'s unrelated `Ed25519AnchorSigner` (which signs each WORM
// anchor's core at mint with node:crypto) — different key, different purpose, deliberately different
// name to avoid the collision. This signer uses `@noble/curves` `ed25519ph` (the only vetted JS
// prehash primitive; `@noble/ed25519` is PureEdDSA-only), proven interop against the live public v2
// instance from Bun in the R1 de-risk.
import { ed25519, ed25519ph } from "@noble/curves/ed25519.js";
import { ConfigError, ValidationError } from "@caisson-sh/kernel";
import { z } from "zod";
import type { SignatureAlgorithm, Signer } from "./sign.ts";

const ED25519_SEED_BYTES = 32;
const ED25519_PUBLIC_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

/** The env var carrying the deployment anchoring seed as base64 of the raw 32-byte Ed25519 seed. */
export const REKOR_ANCHORING_KEY_ENV = "CAISSON_REKOR_ANCHORING_KEY";

/** The default anchoring-key identity id (rotation/lookup label, never a secret). */
export const DEFAULT_REKOR_ANCHORING_KEY_ID = "caisson-rekor-anchoring-v1";

/** Optional env override for the identity id (cosmetic provenance label, never a secret). */
export const REKOR_ANCHORING_KEY_ID_ENV = "CAISSON_REKOR_ANCHORING_KEY_ID";

/** Strict over ONLY the anchoring seed var (never the whole env) so unrelated vars are not rejected. */
const AnchoringKeyEnv = z
  .object({
    [REKOR_ANCHORING_KEY_ENV]: z
      .string()
      .min(1, "must be base64 of a raw 32-byte Ed25519 seed"),
  })
  .strip();

/**
 * The deployment-level Ed25519ph anchoring signer. Implements the shared {@link Signer} port with
 * `algorithm: "ed25519ph"`; `sign(bytes)` returns a DETACHED 64-byte Ed25519ph signature over the EXACT
 * bytes given (the caller passes the canonical anchor bytes — hashes only, no PII). The 32-byte seed is
 * held in a private field and never logged/serialized; construction fails closed on a wrong-length seed.
 * `publicKey()` returns the raw 32-byte Ed25519 key (the caller DER-wraps it for the Rekor verifier).
 */
export class Ed25519PhSigner implements Signer {
  readonly algorithm: SignatureAlgorithm = "ed25519ph";
  readonly keyId: string;
  // Private (#) so the seed is non-enumerable and cannot leak through logging/serialization.
  readonly #seed: Uint8Array;

  constructor(keyId: string, seed: Uint8Array) {
    const id = keyId.trim();
    if (id.length === 0) {
      throw new ValidationError("anchoring signer keyId must be non-empty");
    }
    if (seed.length !== ED25519_SEED_BYTES) {
      throw new ValidationError(
        `ed25519ph seed must be ${String(ED25519_SEED_BYTES)} bytes, got ${String(seed.length)}`,
      );
    }
    this.keyId = id;
    this.#seed = Uint8Array.from(seed); // defensive copy; caller cannot mutate our key
  }

  /**
   * Build from validated env: a base64 raw-32-byte-seed `CAISSON_REKOR_ANCHORING_KEY` (+ an optional
   * `CAISSON_REKOR_ANCHORING_KEY_ID`). On a missing / malformed / wrong-length key this throws a typed
   * `ConfigError` that NAMES the env key but NEVER echoes its value — the decode runs inside a try so a
   * parse error cannot leak the seed bytes through an exception message.
   */
  static fromEnv(
    env: Record<string, string | undefined> = process.env,
  ): Ed25519PhSigner {
    const result = AnchoringKeyEnv.safeParse(env);
    if (!result.success) {
      throw new ConfigError(
        `${REKOR_ANCHORING_KEY_ENV} must be base64 of a raw 32-byte Ed25519 seed`,
        { keys: [REKOR_ANCHORING_KEY_ENV] },
      );
    }
    let seed: Uint8Array;
    try {
      seed = Uint8Array.from(
        Buffer.from(result.data[REKOR_ANCHORING_KEY_ENV], "base64"),
      );
    } catch {
      // NEVER include the caught error or the key bytes — only the env key name.
      throw new ConfigError(`${REKOR_ANCHORING_KEY_ENV} is not valid base64`, {
        keys: [REKOR_ANCHORING_KEY_ENV],
      });
    }
    if (seed.length !== ED25519_SEED_BYTES) {
      throw new ConfigError(
        `${REKOR_ANCHORING_KEY_ENV} must decode to exactly ${String(ED25519_SEED_BYTES)} bytes`,
        { keys: [REKOR_ANCHORING_KEY_ENV] },
      );
    }
    const keyId =
      env[REKOR_ANCHORING_KEY_ID_ENV]?.trim() || DEFAULT_REKOR_ANCHORING_KEY_ID;
    return new Ed25519PhSigner(keyId, seed);
  }

  publicKey(): Promise<Uint8Array> {
    const pub = ed25519.getPublicKey(this.#seed);
    if (pub.length !== ED25519_PUBLIC_BYTES) {
      return Promise.reject(
        new ValidationError("ed25519ph derived a malformed public key"),
      );
    }
    return Promise.resolve(pub);
  }

  sign(payload: Uint8Array): Promise<Uint8Array> {
    // ed25519ph internally SHA-512-prehashes `payload` and signs the prehash (RFC-8032 §5.1); the
    // verifier is handed digest = SHA-512(payload). Proven against the live log in R1.
    const sig = ed25519ph.sign(payload, this.#seed);
    if (sig.length !== ED25519_SIGNATURE_BYTES) {
      return Promise.reject(
        new ValidationError("ed25519ph produced a malformed signature"),
      );
    }
    return Promise.resolve(sig);
  }

  /** Never serialize the seed — redact defensively if stringified. */
  toJSON(): Record<string, string> {
    return { signer: "Ed25519PhSigner", keyId: this.keyId, key: "[redacted]" };
  }
}
