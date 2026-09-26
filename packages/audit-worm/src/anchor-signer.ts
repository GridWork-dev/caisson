// src/anchor-signer.ts — the DEDICATED anchor-signing identity for the WORM audit chain. Each
// per-length anchor's account-bound v2 envelope is signed at mint so a client or
// an offline pack verifier can check tamper-evidence against a pinned public key — making the trust
// root independent of the row-serving API (SECURITY-PREPLAN H2/H4).
//
// Domain-separated from any other signing key ON PURPOSE: an anchor-key compromise must not forge
// signatures issued under a different key, and rotating another key must not invalidate
// anchor-verification history. This follows the same Ed25519Signer discipline used elsewhere in this
// repo — the key is held as an opaque KeyObject (never enumerated, logged, or JSON-serialized) and
// loaded from a DEDICATED env var whose VALUE is never echoed in an error. This package NEVER
// generates or commits a real key; production key material is operator-provisioned (as other signing
// keys are, ADR-0107) and injected via env.
import {
  type KeyObject,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
} from "node:crypto";
import { ConfigError, ValidationError } from "@caisson-sh/kernel";
import {
  EVIDENCE_PACK_KEY_ID_MAX_LENGTH,
  isEvidencePackKeyId,
} from "@caisson-sh/kernel/evidence";
import { z } from "zod";

const ED25519_SIGNATURE_BYTES = 64;

/** The env var carrying the anchor-signing key as base64-encoded Ed25519 PKCS8 DER (the private key). */
export const ANCHOR_SIGNING_KEY_ENV = "CAISSON_ANCHOR_SIGNING_KEY";

/** The default anchor-signing identity id stamped on signed anchors (rotation/lookup). */
export const DEFAULT_ANCHOR_SIGNING_KEY_ID = "caisson-anchor-signer-v1";

/** Optional env override for the identity id (cosmetic provenance label, never a secret). */
export const ANCHOR_SIGNING_KEY_ID_ENV = "CAISSON_ANCHOR_SIGNING_KEY_ID";

/**
 * The anchor-signing port. `sign` returns a DETACHED 64-byte Ed25519 signature over the EXACT bytes
 * given (the store passes the v2 domain/account-bound anchor envelope). `keyId` is a rotation/lookup
 * label, never a secret. A caller-supplied KMS asymmetric signer is a drop-in implementation.
 */
export interface AnchorSigner {
  readonly keyId: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/** Strict over ONLY the anchor-signing var (never the whole env) so unrelated vars are not rejected. */
const SigningKeyEnv = z
  .object({
    [ANCHOR_SIGNING_KEY_ENV]: z
      .string()
      .min(1, "must be base64-encoded Ed25519 PKCS8 DER"),
  })
  .strip();

/**
 * The default anchor signer over the node Ed25519 primitive — the SAME scheme the client/offline
 * verifier checks. The private key is a `KeyObject` in a #private field: its bytes never enumerate,
 * log, or JSON-serialize, and the sign happens in-engine. Construction fails closed on a
 * non-Ed25519 / non-private key.
 */
export class Ed25519AnchorSigner implements AnchorSigner {
  readonly keyId: string;
  readonly #key: KeyObject;

  constructor(keyId: string, privateKey: KeyObject) {
    const id = keyId.trim();
    if (!isEvidencePackKeyId(id)) {
      throw new ValidationError(
        `anchor signer keyId must be control-free and at most ${String(EVIDENCE_PACK_KEY_ID_MAX_LENGTH)} characters`,
      );
    }
    if (privateKey.type !== "private") {
      throw new ValidationError("anchor signer requires a PRIVATE key");
    }
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new ValidationError(
        "anchor signer requires an Ed25519 private key",
      );
    }
    this.keyId = id;
    this.#key = privateKey;
  }

  /**
   * Build from validated env: a base64 PKCS8-DER `CAISSON_ANCHOR_SIGNING_KEY` (+ an optional
   * `CAISSON_ANCHOR_SIGNING_KEY_ID`). On a missing / malformed / non-Ed25519 key this throws a typed
   * `ConfigError` that NAMES the env key but NEVER echoes its value — the decode/parse run inside a
   * try so a parse error cannot leak the bytes through an exception message.
   */
  static fromEnv(
    env: Record<string, string | undefined> = process.env,
  ): Ed25519AnchorSigner {
    const result = SigningKeyEnv.safeParse(env);
    if (!result.success) {
      throw new ConfigError(
        `${ANCHOR_SIGNING_KEY_ENV} must be base64-encoded Ed25519 PKCS8 DER`,
        { keys: [ANCHOR_SIGNING_KEY_ENV] },
      );
    }
    let key: KeyObject;
    try {
      key = createPrivateKey({
        key: Buffer.from(result.data[ANCHOR_SIGNING_KEY_ENV], "base64"),
        format: "der",
        type: "pkcs8",
      });
    } catch {
      // NEVER include the caught error or the key bytes — only the env key name.
      throw new ConfigError(
        `${ANCHOR_SIGNING_KEY_ENV} is not a valid Ed25519 PKCS8 DER key`,
        { keys: [ANCHOR_SIGNING_KEY_ENV] },
      );
    }
    if (key.asymmetricKeyType !== "ed25519") {
      throw new ConfigError(
        `${ANCHOR_SIGNING_KEY_ENV} must be an Ed25519 key`,
        {
          keys: [ANCHOR_SIGNING_KEY_ENV],
        },
      );
    }
    const keyId =
      env[ANCHOR_SIGNING_KEY_ID_ENV]?.trim() || DEFAULT_ANCHOR_SIGNING_KEY_ID;
    return new Ed25519AnchorSigner(keyId, key);
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    const sig = cryptoSign(null, Buffer.from(payload), this.#key);
    if (sig.length !== ED25519_SIGNATURE_BYTES) {
      throw new ValidationError(
        "ed25519 anchor signing returned a malformed signature",
      );
    }
    return Uint8Array.from(sig);
  }

  /** Matching public SPKI DER, safe for browser/offline-verifier configuration. */
  publicKeySpkiBase64(): string {
    // Node accepts a private KeyObject directly and derives only its public half. The installed Bun
    // node typings lag that overload, hence the narrow signature cast; private bytes never export.
    return createPublicKey(
      this.#key as unknown as Parameters<typeof createPublicKey>[0],
    )
      .export({ format: "der", type: "spki" })
      .toString("base64");
  }

  /** Never serialize the key — the KeyObject is opaque, but redact defensively if stringified. */
  toJSON(): Record<string, string> {
    return {
      signer: "Ed25519AnchorSigner",
      keyId: this.keyId,
      key: "[redacted]",
    };
  }
}
