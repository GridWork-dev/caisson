// The versioned, self-describing ciphertext envelope (ADR-0046). On-disk layout, base64 into a
// `text` column:
//
//   [ format-version 1B (0x01) | alg-id 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B ]
//
// Self-describing: the decrypt path reads format-version, alg-id, and key_version FROM THE VALUE
// itself, so rotation AND cipher migration need no out-of-band column metadata. An unknown
// format-version or alg-id THROWS ("flag, never guess", ADR-0006). Mirrors the AWS Encryption SDK
// message format + Tink wire format (version byte first → algorithm id → IV → body → tag).

import { ValidationError } from "@caisson/kernel";

export const FORMAT_VERSION = 0x01;

/** Algorithm ids. Add a new id (never reuse) when a new cipher ships behind the AeadCipher seam. */
export const ALG_AES_256_GCM = 0x01;

export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
/** format-version(1) + alg-id(1) + key_version(2). */
export const HEADER_BYTES = 4;
const MIN_ENVELOPE_BYTES = HEADER_BYTES + NONCE_BYTES + TAG_BYTES;

export interface ParsedEnvelope {
  readonly formatVersion: number;
  readonly algId: number;
  readonly keyVersion: number;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

export interface EnvelopeParts {
  readonly algId: number;
  readonly keyVersion: number;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

/** Serialize parts into the base64 on-disk string. */
export function serializeEnvelope(parts: EnvelopeParts): string {
  if (parts.nonce.length !== NONCE_BYTES) {
    throw new ValidationError(
      `field-crypto: nonce must be ${NONCE_BYTES} bytes, got ${parts.nonce.length}`,
    );
  }
  if (parts.tag.length !== TAG_BYTES) {
    throw new ValidationError(
      `field-crypto: tag must be ${TAG_BYTES} bytes, got ${parts.tag.length}`,
    );
  }
  if (
    !Number.isInteger(parts.keyVersion) ||
    parts.keyVersion < 1 ||
    parts.keyVersion > 0xffff
  ) {
    throw new ValidationError(
      `field-crypto: keyVersion must be an integer in [1, 65535], got ${String(parts.keyVersion)}`,
    );
  }
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt8(FORMAT_VERSION, 0);
  header.writeUInt8(parts.algId, 1);
  header.writeUInt16BE(parts.keyVersion, 2);
  return Buffer.concat([
    header,
    parts.nonce,
    parts.ciphertext,
    parts.tag,
  ]).toString("base64");
}

/** Parse the base64 on-disk string; throws on a malformed length or an unknown version/alg. */
export function parseEnvelope(stored: string): ParsedEnvelope {
  const buf = Buffer.from(stored, "base64");
  if (buf.length < MIN_ENVELOPE_BYTES) {
    throw new ValidationError(
      `field-crypto: malformed envelope — ${buf.length} bytes < minimum ${MIN_ENVELOPE_BYTES}`,
    );
  }
  const formatVersion = buf.readUInt8(0);
  if (formatVersion !== FORMAT_VERSION) {
    throw new ValidationError(
      `field-crypto: unknown envelope format-version 0x${formatVersion.toString(16)}`,
    );
  }
  const algId = buf.readUInt8(1);
  if (algId !== ALG_AES_256_GCM) {
    throw new ValidationError(
      `field-crypto: unknown envelope alg-id 0x${algId.toString(16)}`,
    );
  }
  const keyVersion = buf.readUInt16BE(2);
  const nonce = buf.subarray(HEADER_BYTES, HEADER_BYTES + NONCE_BYTES);
  const ciphertext = buf.subarray(
    HEADER_BYTES + NONCE_BYTES,
    buf.length - TAG_BYTES,
  );
  const tag = buf.subarray(buf.length - TAG_BYTES);
  return { formatVersion, algId, keyVersion, nonce, ciphertext, tag };
}
