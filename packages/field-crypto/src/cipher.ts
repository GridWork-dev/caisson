// The AEAD cipher seam (ADR-0045). v1 ships AES-256-GCM via native `node:crypto` — zero dependency,
// AES-NI accelerated, FIPS 140-approved. Written behind the `AeadCipher` interface so an alternate
// (e.g. XChaCha20-Poly1305 for unlimited per-key volume) is a drop-in without touching the envelope,
// column, or provider. AEAD discipline: a fresh CSPRNG nonce per encrypt; the caller binds
// `tenant_id || key_version || column-context` as AAD; decrypt authenticates (tamper + AAD-mismatch
// throw); a (key, nonce) pair is never reused.
//
// The browser twins of this seam are `aesGcmSealAsync` / `aesGcmOpenAsync` (portable.ts, ADR-0396):
// the same AES-256-GCM over `crypto.subtle`, byte-parity-pinned against this implementation.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ValidationError } from "@caisson-sh/kernel";
import {
  ALG_AES_256_GCM,
  NONCE_BYTES,
  TAG_BYTES,
  TENANT_KEY_BYTES,
} from "./portable.ts";

export { aesGcmOpenAsync, aesGcmSealAsync } from "./portable.ts";
export type { AeadBytesParts } from "./portable.ts";

export interface AeadParts {
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

export interface AeadCipher {
  /** The envelope alg-id this cipher serializes under (ADR-0046). */
  readonly algId: number;
  /** Encrypt with a fresh internal nonce; `aad` is authenticated but not encrypted. */
  encrypt(key: Buffer, plaintext: Buffer, aad: Buffer): AeadParts;
  /** Decrypt; throws on a tampered ciphertext/tag or an AAD mismatch. */
  decrypt(key: Buffer, parts: AeadParts, aad: Buffer): Buffer;
}

function assertKey(key: Buffer): void {
  if (key.length !== TENANT_KEY_BYTES) {
    throw new ValidationError(
      `field-crypto: AES-256-GCM key must be ${TENANT_KEY_BYTES} bytes, got ${key.length}`,
    );
  }
}

export class AesGcmCipher implements AeadCipher {
  readonly algId = ALG_AES_256_GCM;

  encrypt(key: Buffer, plaintext: Buffer, aad: Buffer): AeadParts {
    assertKey(key);
    // A fresh 96-bit CSPRNG nonce per message — NEVER derived from the plaintext (GCM nonce reuse
    // is catastrophic). Per-tenant-derived keys (ADR-0043) put the 2^32 random-nonce bound per
    // tenant, ample headroom.
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return { nonce, ciphertext, tag };
  }

  decrypt(key: Buffer, parts: AeadParts, aad: Buffer): Buffer {
    assertKey(key);
    if (parts.nonce.length !== NONCE_BYTES) {
      throw new ValidationError(
        `field-crypto: nonce must be ${NONCE_BYTES} bytes`,
      );
    }
    if (parts.tag.length !== TAG_BYTES) {
      throw new ValidationError(
        `field-crypto: auth tag must be ${TAG_BYTES} bytes`,
      );
    }
    const decipher = createDecipheriv("aes-256-gcm", key, parts.nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(parts.tag);
    // `final()` throws if the tag/AAD do not authenticate — tamper + AAD-mismatch surface here.
    return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
  }
}

/** The single AES-256-GCM instance (stateless). */
export const aesGcm = new AesGcmCipher();

/** Resolve the cipher for an envelope alg-id (defense-in-depth; the envelope already validated it). */
export function cipherForAlg(algId: number): AeadCipher {
  if (algId === ALG_AES_256_GCM) return aesGcm;
  throw new ValidationError(
    `field-crypto: no cipher registered for alg-id 0x${algId.toString(16)}`,
  );
}
