// The versioned, self-describing ciphertext envelope (ADR-0046). On-disk layout, base64 into a
// `text` column:
//
//   [ format-version 1B (0x01) | alg-id 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B ]
//
// Self-describing: the decrypt path reads format-version, alg-id, and key_version FROM THE VALUE
// itself, so rotation AND cipher migration need no out-of-band column metadata. An unknown
// format-version or alg-id THROWS ("flag, never guess", ADR-0006). Mirrors the AWS Encryption SDK
// message format + Tink wire format (version byte first → algorithm id → IV → body → tag).
//
// The layout constants and the serialize/parse implementation live in portable.ts (ADR-0396) so the
// browser entry reads and writes the SAME wire format rather than a second copy of it. This module is
// the `Buffer`-typed node face of it: the two functions below delegate, and the constants are
// re-exported unchanged.
import {
  parseEnvelopeBytes,
  serializeEnvelopeBytes,
  type EnvelopeBytesParts,
} from "./portable.ts";

export {
  ALG_AES_256_GCM,
  FORMAT_VERSION,
  HEADER_BYTES,
  NONCE_BYTES,
  TAG_BYTES,
  parseEnvelopeBytes,
  serializeEnvelopeBytes,
} from "./portable.ts";
export type { EnvelopeBytesParts, ParsedEnvelopeBytes } from "./portable.ts";

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
  // `EnvelopeParts` (Buffer fields) is assignable to `EnvelopeBytesParts` — Buffer IS a Uint8Array —
  // so this is the same layout code the browser entry runs, not a parallel one.
  return serializeEnvelopeBytes(parts satisfies EnvelopeBytesParts);
}

/** Re-view a byte range as a `Buffer` WITHOUT copying — the same subarray semantics as before. */
function asBuffer(view: Uint8Array): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

/** Parse the base64 on-disk string; throws on a malformed length or an unknown version/alg. */
export function parseEnvelope(stored: string): ParsedEnvelope {
  const env = parseEnvelopeBytes(stored);
  return {
    formatVersion: env.formatVersion,
    algId: env.algId,
    keyVersion: env.keyVersion,
    nonce: asBuffer(env.nonce),
    ciphertext: asBuffer(env.ciphertext),
    tag: asBuffer(env.tag),
  };
}
