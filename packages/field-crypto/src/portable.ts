// src/portable.ts — the BROWSER-SAFE half of the field-encryption surface (ADR-0396), carved out of
// derive.ts / envelope.ts / aad.ts / cipher.ts so a client bundle (and any WebCrypto-only runtime:
// a Cloudflare Worker, Deno Deploy, a service worker) can run the real primitive instead of a
// hand-ported copy of it.
//
// WHAT IS SHARED vs TWINNED. The vocabulary — the HKDF `info` string, the envelope layout, the AAD
// tuple, the rotation bound — has exactly ONE implementation, and it lives here; derive.ts,
// envelope.ts, aad.ts, and registry.ts re-export or delegate to it, so the node surface is unchanged
// for adopters. Only the two primitives that are genuinely runtime-bound are twinned:
//
//   node (`.`)                        browser (`./browser`)          why twinned
//   ------------------------------    ---------------------------    -------------------------------
//   deriveTenantKey (hkdfSync)        deriveTenantKeyAsync           WebCrypto HKDF is async-only
//   AesGcmCipher.encrypt/decrypt      aesGcmSealAsync/…OpenAsync     crypto.subtle is async-only
//   parseEnvelope -> Buffer fields    parseEnvelopeBytes -> Uint8Array   Buffer is a node global
//
// Each twin's byte-for-byte agreement with its node counterpart is pinned in browser-parity.test.ts
// against the SAME committed __golden__ fixtures the node path uses — including a both-directions
// interop proof (seal here, open with encryptField's real path, and back). A twin is not a second
// opinion about the format; it is the same format through a different runtime API.
//
// NO `Buffer` MAY APPEAR IN THIS FILE. It is a node global, not an import, so the module-graph
// walker cannot see it — a bundler answers it with the `buffer/` polyfill, silently. The base64/hex
// codecs below exist for exactly that reason and are byte-identical to the `Buffer` calls they
// replace (pinned in browser-parity.test.ts). browser-safety.test.ts scans this graph for the global.
import { ValidationError } from "@caisson-sh/kernel/browser";

// --- key derivation vocabulary (ADR-0043) ------------------------------------------------------

/** AES-256 needs a 32-byte key; HKDF-SHA256 expands the master key to exactly this length. */
export const TENANT_KEY_BYTES = 32;

/** The uint16 ceiling on `key_version`, set by the envelope's 2-byte field (ADR-0046). */
export const MAX_KEY_VERSION = 0xffff;

/** The HKDF `info` domain-separation string — EXACTLY per ADR-0043. Tenant + key-version live here. */
export function deriveInfo(keyVersion: number, tenantId: string): string {
  if (
    !Number.isInteger(keyVersion) ||
    keyVersion < 1 ||
    keyVersion > MAX_KEY_VERSION
  ) {
    throw new ValidationError(
      `field-crypto: keyVersion must be an integer in [1, ${MAX_KEY_VERSION}], got ${String(keyVersion)}`,
    );
  }
  if (tenantId.length === 0) {
    throw new ValidationError(
      "field-crypto: refusing to derive a key for an empty tenantId",
    );
  }
  return `caisson-field-crypto:v${keyVersion}:${tenantId}`;
}

/**
 * The next key version after `current`, bounded by the envelope's uint16 field. Rotation is a version
 * BUMP — never a bulk re-encrypt (registry.ts, ADR-0006/0043). `tenantId` only names the tenant in the
 * overflow message; the arithmetic is tenant-independent.
 */
export function nextKeyVersion(current: number, tenantId?: string): number {
  if (!Number.isInteger(current) || current < 1 || current > MAX_KEY_VERSION) {
    throw new ValidationError(
      `field-crypto: key version must be an integer in [1, ${MAX_KEY_VERSION}], got ${String(current)}`,
    );
  }
  // Negated form on purpose: `next > MAX` reads `false` for a NaN that slipped the guard above, which
  // would skip the very bound this function exists to enforce.
  const next = current + 1;
  if (!(next <= MAX_KEY_VERSION)) {
    throw new ValidationError(
      tenantId === undefined
        ? `field-crypto: key version overflow (max ${MAX_KEY_VERSION})`
        : `field-crypto: key version overflow for tenant ${JSON.stringify(tenantId)}`,
    );
  }
  return next;
}

// --- envelope vocabulary (ADR-0046) ------------------------------------------------------------

export const FORMAT_VERSION = 0x01;

/** Algorithm ids. Add a new id (never reuse) when a new cipher ships behind the AeadCipher seam. */
export const ALG_AES_256_GCM = 0x01;

export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
/** format-version(1) + alg-id(1) + key_version(2). */
export const HEADER_BYTES = 4;
const MIN_ENVELOPE_BYTES = HEADER_BYTES + NONCE_BYTES + TAG_BYTES;

/** The `Uint8Array` shape of {@link import("./envelope.ts").EnvelopeParts}; `Buffer` satisfies it. */
export interface EnvelopeBytesParts {
  readonly algId: number;
  readonly keyVersion: number;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly tag: Uint8Array;
}

/** The `Uint8Array` shape of {@link import("./envelope.ts").ParsedEnvelope}. */
export interface ParsedEnvelopeBytes {
  readonly formatVersion: number;
  readonly algId: number;
  readonly keyVersion: number;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly tag: Uint8Array;
}

// --- byte codecs (byte-identical to the `Buffer.from(…).toString(…)` calls they replace) --------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Decode the standard or URL-safe base64 alphabets accepted by the previous Buffer-backed path. */
function base64ToBytes(b64: string): Uint8Array {
  let binary: string;
  try {
    const normalized = b64
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    binary = atob(padded);
  } catch {
    throw new ValidationError(
      "field-crypto: malformed envelope — not valid base64",
    );
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < out.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Serialize parts into the base64 on-disk string. The single implementation behind
 * `serializeEnvelope` — a `Buffer`-carrying `EnvelopeParts` is assignable to
 * {@link EnvelopeBytesParts}, so the node entry delegates here rather than repeating the layout.
 */
export function serializeEnvelopeBytes(parts: EnvelopeBytesParts): string {
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
    parts.keyVersion > MAX_KEY_VERSION
  ) {
    throw new ValidationError(
      `field-crypto: keyVersion must be an integer in [1, ${MAX_KEY_VERSION}], got ${String(parts.keyVersion)}`,
    );
  }
  const out = new Uint8Array(
    HEADER_BYTES +
      parts.nonce.length +
      parts.ciphertext.length +
      parts.tag.length,
  );
  const header = new DataView(out.buffer, 0, HEADER_BYTES);
  header.setUint8(0, FORMAT_VERSION);
  header.setUint8(1, parts.algId);
  header.setUint16(2, parts.keyVersion, false); // big-endian, matching writeUInt16BE
  out.set(parts.nonce, HEADER_BYTES);
  out.set(parts.ciphertext, HEADER_BYTES + parts.nonce.length);
  out.set(
    parts.tag,
    HEADER_BYTES + parts.nonce.length + parts.ciphertext.length,
  );
  return bytesToBase64(out);
}

/**
 * Parse the base64 on-disk string; throws on a malformed length or an unknown version/alg. The single
 * implementation behind `parseEnvelope`, which re-wraps these views as `Buffer`s without copying.
 */
export function parseEnvelopeBytes(stored: string): ParsedEnvelopeBytes {
  const buf = base64ToBytes(stored);
  if (buf.length < MIN_ENVELOPE_BYTES) {
    throw new ValidationError(
      `field-crypto: malformed envelope — ${buf.length} bytes < minimum ${MIN_ENVELOPE_BYTES}`,
    );
  }
  const header = new DataView(buf.buffer, buf.byteOffset, HEADER_BYTES);
  const formatVersion = header.getUint8(0);
  if (formatVersion !== FORMAT_VERSION) {
    throw new ValidationError(
      `field-crypto: unknown envelope format-version 0x${formatVersion.toString(16)}`,
    );
  }
  const algId = header.getUint8(1);
  if (algId !== ALG_AES_256_GCM) {
    throw new ValidationError(
      `field-crypto: unknown envelope alg-id 0x${algId.toString(16)}`,
    );
  }
  return {
    formatVersion,
    algId,
    keyVersion: header.getUint16(2, false),
    nonce: buf.subarray(HEADER_BYTES, HEADER_BYTES + NONCE_BYTES),
    ciphertext: buf.subarray(
      HEADER_BYTES + NONCE_BYTES,
      buf.length - TAG_BYTES,
    ),
    tag: buf.subarray(buf.length - TAG_BYTES),
  };
}

// --- AAD (ADR-0045/0055) -----------------------------------------------------------------------

/**
 * Build the canonical AAD for a field — the single implementation behind `buildAad`. `columnContext`
 * is the column's stable identity (e.g. "ssn"). Pass `rowId` (the row's stable PK) for row-bound
 * SEC/HIPAA fields → a 4-tuple; omit it for the transparent low-sensitivity column → the unchanged
 * 3-tuple. Omitting `rowId` must yield the SAME bytes as the legacy 3-tuple: pushing `undefined`
 * would serialize as `null` and break every existing ciphertext + golden.
 */
export function buildAadBytes(
  tenantId: string,
  keyVersion: number,
  columnContext: string,
  rowId?: string,
): Uint8Array {
  const tuple =
    rowId === undefined
      ? [tenantId, keyVersion, columnContext]
      : [tenantId, keyVersion, columnContext, rowId];
  return new TextEncoder().encode(JSON.stringify(tuple));
}

// --- the WebCrypto twins -----------------------------------------------------------------------

/**
 * Hand WebCrypto a plain `ArrayBuffer` (a `BufferSource`): a subarray/TextEncoder view is
 * `Uint8Array<ArrayBufferLike>`, which the strict `crypto.subtle` signatures reject. Copying into a
 * fresh `Uint8Array` yields an `ArrayBuffer`-backed buffer every call site accepts.
 */
function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/**
 * Derive a tenant's 32-byte data-encryption key — the WebCrypto twin of `deriveTenantKey`
 * (node `hkdfSync`). Same HKDF-SHA256 over the same `(ikm, salt, info)`, so it produces the SAME key
 * bytes; pinned against `__golden__/derive-kat.json` and against the node function itself.
 * `masterKey` (32B IKM) and `salt` (32B per-deployment, non-secret) come from the caller's validated
 * config; `keyVersion` + `tenantId` are bound into HKDF `info` for rotation + per-tenant domain
 * separation (ADR-0043, Fork 3 confirmed — separation lives in `info`, not the salt).
 */
export async function deriveTenantKeyAsync(
  masterKey: Uint8Array,
  salt: Uint8Array,
  keyVersion: number,
  tenantId: string,
): Promise<Uint8Array> {
  if (masterKey.length !== TENANT_KEY_BYTES) {
    throw new ValidationError(
      `field-crypto: MASTER_FIELD_KEY must be ${TENANT_KEY_BYTES} bytes, got ${masterKey.length}`,
    );
  }
  if (salt.length !== TENANT_KEY_BYTES) {
    throw new ValidationError(
      `field-crypto: FIELD_CRYPTO_SALT must be ${TENANT_KEY_BYTES} bytes, got ${salt.length}`,
    );
  }
  const info = new TextEncoder().encode(deriveInfo(keyVersion, tenantId));
  const ikm = await crypto.subtle.importKey(
    "raw",
    bufferSource(masterKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bufferSource(salt),
      info: bufferSource(info),
    },
    ikm,
    TENANT_KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** The AEAD output triple — the `Uint8Array` shape of cipher.ts's `AeadParts`. */
export interface AeadBytesParts {
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly tag: Uint8Array;
}

function assertAesKey(key: Uint8Array): void {
  if (key.length !== TENANT_KEY_BYTES) {
    throw new ValidationError(
      `field-crypto: AES-256-GCM key must be ${TENANT_KEY_BYTES} bytes, got ${key.length}`,
    );
  }
}

/**
 * AES-256-GCM seal — the WebCrypto twin of `AesGcmCipher.encrypt`. `aad` is authenticated but not
 * encrypted. WebCrypto returns ciphertext WITH the 16-byte tag appended where node returns them
 * split; splitting the last `TAG_BYTES` off recovers the node-identical `(ciphertext, tag)` pair.
 *
 * NONCE DISCIPLINE — always draws a fresh 96-bit CSPRNG nonce per message, exactly as the node cipher
 * does. The public API deliberately has no caller-supplied nonce seam: reusing a (key, nonce) pair
 * across two messages breaks GCM catastrophically.
 */
export async function aesGcmSealAsync(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<AeadBytesParts> {
  return aesGcmSealWithNonceForTest(
    key,
    plaintext,
    aad,
    crypto.getRandomValues(new Uint8Array(NONCE_BYTES)),
  );
}

/**
 * Deterministic KAT seam for this package's relative-import parity suite. It is intentionally absent
 * from both public barrels and package export conditions; application and demo code cannot select a
 * nonce. Keeping the runtime-bound primitive here avoids a third AES-GCM implementation in tests.
 * @internal
 */
export async function aesGcmSealWithNonceForTest(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
  nonce: Uint8Array,
): Promise<AeadBytesParts> {
  assertAesKey(key);
  if (nonce.length !== NONCE_BYTES) {
    throw new ValidationError(
      `field-crypto: nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`,
    );
  }
  const subtleKey = await crypto.subtle.importKey(
    "raw",
    bufferSource(key),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(nonce),
        additionalData: bufferSource(aad),
        tagLength: TAG_BYTES * 8,
      },
      subtleKey,
      bufferSource(plaintext),
    ),
  );
  return {
    nonce,
    ciphertext: sealed.subarray(0, sealed.length - TAG_BYTES),
    tag: sealed.subarray(sealed.length - TAG_BYTES),
  };
}

/**
 * AES-256-GCM open — the WebCrypto twin of `AesGcmCipher.decrypt`. THROWS on a tampered
 * ciphertext/tag or an AAD mismatch (a cross-tenant, cross-column, or cross-row relocation), exactly
 * like the node path: fail-closed, never a silent wrong-plaintext read.
 */
export async function aesGcmOpenAsync(
  key: Uint8Array,
  parts: AeadBytesParts,
  aad: Uint8Array,
): Promise<Uint8Array> {
  assertAesKey(key);
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
  const subtleKey = await crypto.subtle.importKey(
    "raw",
    bufferSource(key),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const sealed = new Uint8Array(parts.ciphertext.length + parts.tag.length);
  sealed.set(parts.ciphertext, 0);
  sealed.set(parts.tag, parts.ciphertext.length);
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bufferSource(parts.nonce),
      additionalData: bufferSource(aad),
      tagLength: TAG_BYTES * 8,
    },
    subtleKey,
    sealed.buffer,
  );
  return new Uint8Array(plain);
}
