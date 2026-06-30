// @caisson/license-issue — the signing-identity port + the default Ed25519 signer + its env key loader
// (ADR-0108, implements ADR-0010). This is the PRIVATE half of the license system: the verifier
// (@caisson/license-verify) bakes the PRODUCTION public key and `crypto.verify`s offline; HERE the
// matching PRIVATE key signs. The key is loaded as `node:crypto` PKCS8 — the SAME primitive the
// verifier accepts (Ed25519 over SPKI) — from `CAISSON_LICENSE_SIGNING_KEY` (PKCS8 DER, base64; the
// operator-provisioned production key, ADR-0107). Holding a `KeyObject` (not raw seed bytes) means the
// private material never enumerates, logs, or JSON-serializes, and `crypto.sign` does the math. A
// strict loader names the env key but NEVER echoes its value (`@caisson/field-crypto` `fromEnv`
// discipline). A buyer-supplied KMS asymmetric `Sign` is a documented UN-WIRED seam — an implementation
// of the same `Signer` port whose private key never leaves the HSM; we do NOT wire it.
import { ConfigError, ValidationError } from "@caisson/kernel";
import {
  type KeyObject,
  createPrivateKey,
  sign as cryptoSign,
} from "node:crypto";
import { z } from "zod";

const ED25519_PUBLIC_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

/** The env var carrying the issuer's signing key as base64-encoded Ed25519 PKCS8 DER (the private key). */
export const LICENSE_SIGNING_KEY_ENV = "CAISSON_LICENSE_SIGNING_KEY";

/** The default signing-identity id stamped on issued licenses (rotation/lookup). Override via env. */
export const DEFAULT_SIGNING_KEY_ID = "caisson-license-issuer-v1";

/** Optional env override for the signing-identity id (cosmetic provenance label, never a secret). */
export const LICENSE_SIGNING_KEY_ID_ENV = "LICENSE_SIGNING_KEY_ID";

/** Strict over ONLY the signing-key var (never the whole env) so unrelated vars are not rejected. */
const SigningKeyEnv = z
  .object({
    [LICENSE_SIGNING_KEY_ENV]: z
      .string()
      .min(1, "must be base64-encoded Ed25519 PKCS8 DER"),
  })
  .strip();

/**
 * The signing-identity port (ADR-0108). The base path is {@link Ed25519Signer}; a buyer-supplied AWS
 * KMS asymmetric Sign is a drop-in implementation of this same interface (the key never leaves the
 * HSM) — a documented UN-WIRED seam (ADR-0047 ethos), NOT the v1 base. `sign` returns the detached
 * 64-byte Ed25519 signature over the EXACT bytes given (the issuer passes `canonicalize(claims)`).
 */
export interface Signer {
  /** Identifies the signing identity. Surfaced for key rotation/lookup; never a secret. */
  readonly keyId: string;
  /** The signature scheme. The verifier (`@caisson/license-verify`) is Ed25519-only. */
  readonly algorithm: "ed25519";
  /** The raw 32-byte Ed25519 public key point (verifier-facing). */
  publicKey(): Promise<Uint8Array>;
  /** Produce a DETACHED Ed25519 signature over `payload`. */
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/**
 * The default issuer signer over `node:crypto` Ed25519 — the SAME primitive the verifier accepts
 * (`@caisson/license-verify` bakes the matching SPKI public key). The private key is a `KeyObject`
 * held in a #private field: `node:crypto` never exposes its bytes through enumeration, logging, or
 * JSON-serialization, and `crypto.sign` performs the signature in-engine — strictly safer than holding
 * a raw seed. Construction fails closed on a non-Ed25519 / non-private key.
 */
export class Ed25519Signer implements Signer {
  readonly algorithm = "ed25519" as const;
  readonly keyId: string;
  // A node KeyObject — opaque; the private bytes never enumerate, log, or JSON-serialize.
  readonly #key: KeyObject;

  constructor(keyId: string, privateKey: KeyObject) {
    const id = keyId.trim();
    if (id.length === 0) {
      throw new ValidationError("signer keyId must be a non-empty string");
    }
    if (privateKey.type !== "private") {
      throw new ValidationError("signer requires a PRIVATE key");
    }
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new ValidationError("signer requires an Ed25519 private key");
    }
    this.keyId = id;
    this.#key = privateKey;
  }

  /**
   * Build from validated env: a base64 PKCS8-DER `CAISSON_LICENSE_SIGNING_KEY` (+ an optional
   * `LICENSE_SIGNING_KEY_ID`). On a missing / malformed / non-Ed25519 key this throws a typed
   * `ConfigError` whose message NAMES the env key but NEVER echoes its value (the key must not reach a
   * log/egress path — `@caisson/field-crypto` `fromEnv` discipline). The base64 decode + DER parse run
   * inside a try so a parse error cannot leak the bytes through an exception message.
   */
  static fromEnv(
    env: Record<string, string | undefined> = process.env,
  ): Ed25519Signer {
    const result = SigningKeyEnv.safeParse(env);
    if (!result.success) {
      throw new ConfigError(
        `${LICENSE_SIGNING_KEY_ENV} must be base64-encoded Ed25519 PKCS8 DER`,
        { keys: [LICENSE_SIGNING_KEY_ENV] },
      );
    }
    let key: KeyObject;
    try {
      key = createPrivateKey({
        key: Buffer.from(result.data[LICENSE_SIGNING_KEY_ENV], "base64"),
        format: "der",
        type: "pkcs8",
      });
    } catch {
      // NEVER include the caught error or the key bytes — only the env key name.
      throw new ConfigError(
        `${LICENSE_SIGNING_KEY_ENV} is not a valid Ed25519 PKCS8 DER key`,
        { keys: [LICENSE_SIGNING_KEY_ENV] },
      );
    }
    if (key.asymmetricKeyType !== "ed25519") {
      throw new ConfigError(
        `${LICENSE_SIGNING_KEY_ENV} must be an Ed25519 key`,
        {
          keys: [LICENSE_SIGNING_KEY_ENV],
        },
      );
    }
    const keyId =
      env[LICENSE_SIGNING_KEY_ID_ENV]?.trim() || DEFAULT_SIGNING_KEY_ID;
    return new Ed25519Signer(keyId, key);
  }

  async publicKey(): Promise<Uint8Array> {
    // Export the public point directly from the private key's JWK (`x` = the raw 32-byte Ed25519
    // point, base64url). Avoids `createPublicKey(KeyObject)`, whose KeyObject overload bun-types omits.
    const jwk = this.#key.export({ format: "jwk" }) as { x?: string };
    if (jwk.x === undefined) {
      throw new ValidationError(
        "ed25519 public key derivation returned a malformed key",
      );
    }
    const raw = Buffer.from(jwk.x, "base64url");
    if (raw.length !== ED25519_PUBLIC_BYTES) {
      throw new ValidationError(
        "ed25519 public key derivation returned a malformed key",
      );
    }
    return Uint8Array.from(raw);
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    const sig = cryptoSign(null, Buffer.from(payload), this.#key);
    if (sig.length !== ED25519_SIGNATURE_BYTES) {
      throw new ValidationError(
        "ed25519 signing returned a malformed signature",
      );
    }
    return Uint8Array.from(sig);
  }

  /** Never serialize the key — the KeyObject is opaque, but redact defensively if stringified. */
  toJSON(): Record<string, string> {
    return { signer: "Ed25519Signer", keyId: this.keyId, key: "[redacted]" };
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
