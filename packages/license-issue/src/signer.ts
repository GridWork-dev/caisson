// @caisson/license-issue — the signing-identity port + the default Ed25519 signer + its env key loader
// (ADR-0108, implements ADR-0010). This is the PRIVATE half of the license system: the verifier
// (@caisson/license-verify) bakes a public key and `crypto.verify`s offline; HERE the matching PRIVATE
// seed signs. Mirrors `@caisson/compliance` `evidence/sign.ts` (the Signer port + an `@noble/ed25519`
// Ed25519Signer holding the 32-byte seed in a #private field, defensively copied, fail-closed on a bad
// length) and `@caisson/field-crypto` `provider.ts` (a strict env-hex key loader that names the env key
// but NEVER echoes its value). A buyer-supplied KMS asymmetric `Sign` is a documented UN-WIRED seam —
// an implementation of the same `Signer` port whose private key never leaves the HSM; we do NOT wire it.
import { ConfigError, ValidationError } from "@caisson/kernel";
import * as ed from "@noble/ed25519";
import { z } from "zod";

const ED25519_SEED_BYTES = 32;
const ED25519_PUBLIC_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

/** The env var carrying the issuer's signing seed as 64 lowercase/uppercase hex chars (32 bytes). */
export const LICENSE_SIGNING_SEED_ENV = "LICENSE_SIGNING_SEED";

/** The default signing-identity id stamped on issued licenses (rotation/lookup). Override via env. */
export const DEFAULT_SIGNING_KEY_ID = "caisson-license-issuer-v1";

/** Optional env override for the signing-identity id (cosmetic provenance label, never a secret). */
export const LICENSE_SIGNING_KEY_ID_ENV = "LICENSE_SIGNING_KEY_ID";

/** Strict over ONLY the signing-seed var (never the whole env) so unrelated vars are not rejected. */
const SigningSeedEnv = z
  .object({
    [LICENSE_SIGNING_SEED_ENV]: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex chars (32 bytes)"),
  })
  .strip();

/**
 * The signing-identity port (ADR-0108). The base path is {@link Ed25519Signer}; a buyer-supplied AWS
 * KMS asymmetric Sign is a drop-in implementation of this same interface (the seed never leaves the
 * HSM) — a documented UN-WIRED seam (ADR-0047 ethos), NOT the v1 base. `sign` returns the detached
 * 64-byte Ed25519 signature over the EXACT bytes given (the issuer passes `canonicalize(claims)`).
 */
export interface Signer {
  /** Identifies the signing identity. Surfaced for key rotation/lookup; never a secret. */
  readonly keyId: string;
  /** The signature scheme. The verifier (`@caisson/license-verify`) is Ed25519-only. */
  readonly algorithm: "ed25519";
  /** The Ed25519 public key bytes (verifier-facing). */
  publicKey(): Promise<Uint8Array>;
  /** Produce a DETACHED Ed25519 signature over `payload`. */
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/**
 * The default issuer signer over `@noble/ed25519` — the SAME curve + primitive the verifier accepts
 * (`@caisson/license-verify` bakes the matching public key). The 32-byte seed is the issuer's private
 * signing key, held in a #private field (non-enumerable, never logged / JSON-serialized) and defensively
 * copied so a caller cannot mutate it. Construction fails closed on a malformed key.
 */
export class Ed25519Signer implements Signer {
  readonly algorithm = "ed25519" as const;
  readonly keyId: string;
  // Private (#) so the seed cannot leak through enumeration, logging, or serialization.
  readonly #seed: Uint8Array;

  constructor(keyId: string, seed: Uint8Array) {
    const id = keyId.trim();
    if (id.length === 0) {
      throw new ValidationError("signer keyId must be a non-empty string");
    }
    if (seed.length !== ED25519_SEED_BYTES) {
      throw new ValidationError(
        `ed25519 seed must be ${String(ED25519_SEED_BYTES)} bytes, got ${String(seed.length)}`,
      );
    }
    this.keyId = id;
    this.#seed = Uint8Array.from(seed); // defensive copy; caller cannot mutate our key
  }

  /**
   * Build from validated env: a 64-hex-char `LICENSE_SIGNING_SEED` (+ an optional
   * `LICENSE_SIGNING_KEY_ID`). On a missing / short / non-hex seed this throws a typed `ConfigError`
   * whose message NAMES the env key but NEVER echoes its value (the seed must not reach a log/egress
   * path — `@caisson/field-crypto` `fromEnv` discipline).
   */
  static fromEnv(
    env: Record<string, string | undefined> = process.env,
  ): Ed25519Signer {
    const result = SigningSeedEnv.safeParse(env);
    if (!result.success) {
      throw new ConfigError(
        `${LICENSE_SIGNING_SEED_ENV} must be 64 hex chars (32 bytes)`,
        { keys: [LICENSE_SIGNING_SEED_ENV] },
      );
    }
    const seedHex = result.data[LICENSE_SIGNING_SEED_ENV];
    const keyId =
      env[LICENSE_SIGNING_KEY_ID_ENV]?.trim() || DEFAULT_SIGNING_KEY_ID;
    return new Ed25519Signer(
      keyId,
      Uint8Array.from(Buffer.from(seedHex, "hex")),
    );
  }

  async publicKey(): Promise<Uint8Array> {
    const pub = await ed.getPublicKeyAsync(this.#seed);
    if (pub.length !== ED25519_PUBLIC_BYTES) {
      throw new ValidationError(
        "ed25519 public key derivation returned a malformed key",
      );
    }
    return pub;
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    const sig = await ed.signAsync(payload, this.#seed);
    if (sig.length !== ED25519_SIGNATURE_BYTES) {
      throw new ValidationError(
        "ed25519 signing returned a malformed signature",
      );
    }
    return sig;
  }

  /** Never serialize the seed — redact if this signer is ever stringified. */
  toJSON(): Record<string, string> {
    return { signer: "Ed25519Signer", keyId: this.keyId, seed: "[redacted]" };
  }
}

/**
 * UN-WIRED SEAM (ADR-0108 / ADR-0047 ethos): a buyer-supplied AWS KMS asymmetric signer. It implements
 * the same {@link Signer} port — `sign` issues a `Sign` call to KMS (the private key never leaves the
 * HSM) and `publicKey` a `GetPublicKey` — so the issuer service swaps it in by configuration alone,
 * with NO change to `issueLicense`. It is intentionally NOT wired in v1: there is no AWS SDK dependency
 * and no live KMS call on any path. The interface documents the contract a future P7 KMS adapter fills.
 */
export interface KmsSigner extends Signer {
  /** The KMS key ARN/alias the asymmetric Sign/GetPublicKey calls target (provenance / rotation). */
  readonly kmsKeyId: string;
}
