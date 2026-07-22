// The deterministic engine behind the field-crypto "envelope bench" poke (ADR-0378 lock 2, kimi F1).
// Pure TypeScript, NO React. It runs the REAL @caisson/field-crypto primitive in the browser: the
// package's key path is node:crypto (hkdfSync / createCipheriv, not browser-safe), so this file
// MIRRORS it via WebCrypto (crypto.subtle) and PINS byte/number parity against the package's real
// output + its __golden__ fixtures in field-crypto-logic.test.ts. Every constant, name, and layout
// below is cited to the package source it mirrors; the test is the proof they stay identical.
//
// Mirrors:
//   deriveInfo / deriveTenantKey / TENANT_KEY_BYTES  → packages/field-crypto/src/derive.ts
//   FORMAT_VERSION / ALG_AES_256_GCM / NONCE_BYTES / TAG_BYTES / HEADER_BYTES / serialize / parse
//                                                    → packages/field-crypto/src/envelope.ts
//   buildAad (row-bound 4-tuple)                     → packages/field-crypto/src/aad.ts
//   AES-256-GCM encrypt/decrypt                      → packages/field-crypto/src/cipher.ts
//   encryptField / decryptField (seal/open a row)    → packages/field-crypto/src/encrypt-field.ts
//   KeyVersionRegistry.rotate (a version BUMP)       → packages/field-crypto/src/registry.ts

// --- constants mirrored from packages/field-crypto/src/envelope.ts ---
export const FORMAT_VERSION = 0x01;
export const ALG_AES_256_GCM = 0x01;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
/** format-version(1) + alg-id(1) + key_version(2). */
export const HEADER_BYTES = 4;
/** AES-256 needs a 32-byte key; HKDF-SHA256 expands to exactly this (derive.ts TENANT_KEY_BYTES). */
export const TENANT_KEY_BYTES = 32;
const MIN_ENVELOPE_BYTES = HEADER_BYTES + NONCE_BYTES + TAG_BYTES;

// --- sample inputs (labeled as samples in the UI). The master/salt are the SAME non-secret KAT
//     vectors the package's own tests use (derive.test.ts), so the derived keys equal the shipped
//     golden vectors in packages/field-crypto/src/__golden__/derive-kat.json. Never real key material.
export const DEMO_MASTER_KEY: Uint8Array = new Uint8Array(
  TENANT_KEY_BYTES,
).fill(0x11);
export const DEMO_SALT: Uint8Array = new Uint8Array(TENANT_KEY_BYTES).fill(
  0x22,
);
/** A sample column identity (bound into AAD so a ciphertext cannot move to another column). */
export const DEMO_COLUMN_CONTEXT = "patient.ssn";
/** A sample stable row PK — the row-bound 4-tuple AAD path (encrypt-field.ts). */
export const DEMO_ROW_ID = "00000000-0000-4000-8000-000000000001";
/** The golden-replay nonce: the exact fixed nonce from __golden__/envelope.json (0xab x 12). */
export const GOLDEN_NONCE: Uint8Array = new Uint8Array(NONCE_BYTES).fill(0xab);

export const TENANTS = ["tenant-a", "tenant-b"] as const;
export type TenantId = (typeof TENANTS)[number];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// --- browser-safe byte codecs (no node Buffer; matches Buffer base64/hex byte-for-byte) ---
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

// Hand WebCrypto a plain ArrayBuffer (a `BufferSource`): a subarray/TextEncoder view is
// `Uint8Array<ArrayBufferLike>`, which the strict lib.dom `crypto.subtle` signatures reject. Copying
// into a fresh Uint8Array yields an `ArrayBuffer`-backed buffer that every call site accepts.
function ab(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/** The HKDF `info` domain-separation string — EXACTLY per ADR-0043 (derive.ts deriveInfo). */
export function deriveInfo(keyVersion: number, tenantId: string): string {
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 0xffff) {
    throw new RangeError(
      `field-crypto: keyVersion must be an integer in [1, 65535], got ${String(keyVersion)}`,
    );
  }
  if (tenantId.length === 0) {
    throw new RangeError(
      "field-crypto: refusing to derive a key for an empty tenantId",
    );
  }
  return `caisson-field-crypto:v${keyVersion}:${tenantId}`;
}

/**
 * Derive a tenant's 32-byte key via HKDF-SHA256 (WebCrypto mirror of derive.ts deriveTenantKey,
 * which is node hkdfSync). tenant_id + key_version live in `info` for per-tenant isolation + rotation.
 */
export async function deriveTenantKey(
  masterKey: Uint8Array,
  salt: Uint8Array,
  keyVersion: number,
  tenantId: string,
): Promise<Uint8Array> {
  const info = textEncoder.encode(deriveInfo(keyVersion, tenantId));
  const ikm = await crypto.subtle.importKey(
    "raw",
    ab(masterKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: ab(salt), info: ab(info) },
    ikm,
    TENANT_KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Build the canonical row-bound AAD 4-tuple `tenant∥keyVersion∥columnContext∥rowId` (aad.ts buildAad).
 * GCM authenticates but does not encrypt the AAD — a ciphertext moved to another tenant, column, or
 * row fails to authenticate on open.
 */
export function buildAad(
  tenantId: string,
  keyVersion: number,
  columnContext: string,
  rowId: string,
): Uint8Array {
  return textEncoder.encode(
    JSON.stringify([tenantId, keyVersion, columnContext, rowId]),
  );
}

export interface ParsedEnvelope {
  readonly formatVersion: number;
  readonly algId: number;
  readonly keyVersion: number;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly tag: Uint8Array;
}

/** Serialize parts into the base64 on-disk string (envelope.ts serializeEnvelope). */
export function serializeEnvelope(parts: {
  algId: number;
  keyVersion: number;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
}): string {
  if (parts.nonce.length !== NONCE_BYTES) {
    throw new RangeError(
      `field-crypto: nonce must be ${NONCE_BYTES} bytes, got ${parts.nonce.length}`,
    );
  }
  if (parts.tag.length !== TAG_BYTES) {
    throw new RangeError(
      `field-crypto: tag must be ${TAG_BYTES} bytes, got ${parts.tag.length}`,
    );
  }
  if (
    !Number.isInteger(parts.keyVersion) ||
    parts.keyVersion < 1 ||
    parts.keyVersion > 0xffff
  ) {
    throw new RangeError(
      `field-crypto: keyVersion must be an integer in [1, 65535], got ${String(parts.keyVersion)}`,
    );
  }
  const header = new Uint8Array(HEADER_BYTES);
  const dv = new DataView(header.buffer);
  dv.setUint8(0, FORMAT_VERSION);
  dv.setUint8(1, parts.algId);
  dv.setUint16(2, parts.keyVersion, false); // big-endian
  const out = new Uint8Array(
    header.length +
      parts.nonce.length +
      parts.ciphertext.length +
      parts.tag.length,
  );
  let o = 0;
  for (const seg of [header, parts.nonce, parts.ciphertext, parts.tag]) {
    out.set(seg, o);
    o += seg.length;
  }
  return bytesToBase64(out);
}

/** Parse the base64 on-disk string; throws on a malformed length or an unknown version/alg (envelope.ts). */
export function parseEnvelope(stored: string): ParsedEnvelope {
  const buf = base64ToBytes(stored);
  if (buf.length < MIN_ENVELOPE_BYTES) {
    throw new RangeError(
      `field-crypto: malformed envelope — ${buf.length} bytes < minimum ${MIN_ENVELOPE_BYTES}`,
    );
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const formatVersion = dv.getUint8(0);
  if (formatVersion !== FORMAT_VERSION) {
    throw new RangeError(
      `field-crypto: unknown envelope format-version 0x${formatVersion.toString(16)}`,
    );
  }
  const algId = dv.getUint8(1);
  if (algId !== ALG_AES_256_GCM) {
    throw new RangeError(
      `field-crypto: unknown envelope alg-id 0x${algId.toString(16)}`,
    );
  }
  const keyVersion = dv.getUint16(2, false);
  const nonce = buf.subarray(HEADER_BYTES, HEADER_BYTES + NONCE_BYTES);
  const ciphertext = buf.subarray(
    HEADER_BYTES + NONCE_BYTES,
    buf.length - TAG_BYTES,
  );
  const tag = buf.subarray(buf.length - TAG_BYTES);
  return { formatVersion, algId, keyVersion, nonce, ciphertext, tag };
}

// --- AES-256-GCM via WebCrypto (mirror of cipher.ts AesGcmCipher). WebCrypto returns ciphertext WITH
//     the 16-byte tag appended; node returns them split — splitting the last TAG_BYTES off recovers
//     the node-identical (ciphertext, tag) pair. Pinned byte-identical in the test. ---
async function gcmEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
  const k = await crypto.subtle.importKey("raw", ab(key), "AES-GCM", false, [
    "encrypt",
  ]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ab(nonce),
        additionalData: ab(aad),
        tagLength: TAG_BYTES * 8,
      },
      k,
      ab(plaintext),
    ),
  );
  return {
    ciphertext: sealed.subarray(0, sealed.length - TAG_BYTES),
    tag: sealed.subarray(sealed.length - TAG_BYTES),
  };
}

async function gcmDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ab(key), "AES-GCM", false, [
    "decrypt",
  ]);
  const sealed = new Uint8Array(ciphertext.length + tag.length);
  sealed.set(ciphertext, 0);
  sealed.set(tag, ciphertext.length);
  // Rejects (throws) on a tampered ciphertext/tag or an AAD mismatch — tamper + cross-tenant surface here.
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ab(nonce),
      additionalData: ab(aad),
      tagLength: TAG_BYTES * 8,
    },
    k,
    ab(sealed),
  );
  return new Uint8Array(plain);
}

// --- the bench engine: seal a value as one tenant, open it as any tenant ---

export interface SealResult {
  readonly wire: string;
  readonly sealedBy: TenantId;
  readonly keyVersion: number;
}

export type OpenFailReason = "malformed" | "auth";

export type OpenResult =
  | {
      readonly ok: true;
      readonly plaintext: string;
      readonly keyVersion: number;
    }
  | { readonly ok: false; readonly reason: OpenFailReason };

/**
 * Seal `plaintext` for `tenant` under `keyVersion` as a row-bound envelope — the same shape
 * encrypt-field.ts encryptField produces (4-tuple AAD, self-describing envelope). `goldenReplay`
 * pins the fixed golden nonce for byte-identical deterministic output (asserted in the test);
 * otherwise a fresh CSPRNG nonce is drawn per seal, exactly like the shipped cipher.ts encrypt.
 */
export async function sealEnvelope(input: {
  tenant: TenantId;
  keyVersion: number;
  plaintext: string;
  goldenReplay: boolean;
}): Promise<SealResult> {
  const key = await deriveTenantKey(
    DEMO_MASTER_KEY,
    DEMO_SALT,
    input.keyVersion,
    input.tenant,
  );
  const aad = buildAad(
    input.tenant,
    input.keyVersion,
    DEMO_COLUMN_CONTEXT,
    DEMO_ROW_ID,
  );
  const nonce = input.goldenReplay
    ? GOLDEN_NONCE
    : crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const { ciphertext, tag } = await gcmEncrypt(
    key,
    nonce,
    textEncoder.encode(input.plaintext),
    aad,
  );
  const wire = serializeEnvelope({
    algId: ALG_AES_256_GCM,
    keyVersion: input.keyVersion,
    nonce,
    ciphertext,
    tag,
  });
  return { wire, sealedBy: input.tenant, keyVersion: input.keyVersion };
}

/**
 * Open `wire` as `asTenant`. The key version comes FROM the envelope (self-describing), so a value
 * sealed under an older version still opens after rotation. Opening as the wrong tenant derives a
 * different key and the GCM tag fails to authenticate → { ok: false, reason: "auth" }: the shipped
 * cross-tenant isolation claim, proven under the cursor. Fail-closed, never a wrong-plaintext read.
 */
export async function openEnvelope(input: {
  wire: string;
  asTenant: TenantId;
}): Promise<OpenResult> {
  let env: ParsedEnvelope;
  try {
    env = parseEnvelope(input.wire);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const key = await deriveTenantKey(
    DEMO_MASTER_KEY,
    DEMO_SALT,
    env.keyVersion,
    input.asTenant,
  );
  const aad = buildAad(
    input.asTenant,
    env.keyVersion,
    DEMO_COLUMN_CONTEXT,
    DEMO_ROW_ID,
  );
  try {
    const plain = await gcmDecrypt(
      key,
      env.nonce,
      env.ciphertext,
      env.tag,
      aad,
    );
    return {
      ok: true,
      plaintext: textDecoder.decode(plain),
      keyVersion: env.keyVersion,
    };
  } catch {
    return { ok: false, reason: "auth" };
  }
}

/** The uint16 key-version ceiling (registry.ts rotate bounds bumps by the envelope's u16 field). */
export const MAX_KEY_VERSION = 0xffff;

/** Bump to the next key version — a version BUMP, never a bulk re-encrypt (registry.ts rotate). */
export function rotateKeyVersion(current: number): number {
  const next = current + 1;
  if (next > MAX_KEY_VERSION)
    throw new RangeError("field-crypto: key version overflow");
  return next;
}

export interface EnvelopeSegment {
  readonly label: string;
  readonly hex: string;
  readonly byteLength: number;
  readonly note?: string;
}

/**
 * Break an envelope into its labeled byte segments for the ByteStrip readout — the real on-disk
 * layout from envelope.ts: [ver 1B | alg 1B | key_version u16 BE | nonce 12B | ciphertext | tag 16B].
 */
export function envelopeSegments(wire: string): EnvelopeSegment[] {
  const env = parseEnvelope(wire);
  return [
    {
      label: "ver",
      hex: env.formatVersion.toString(16).padStart(2, "0"),
      byteLength: 1,
      note: "FORMAT_VERSION 0x01",
    },
    {
      label: "alg",
      hex: env.algId.toString(16).padStart(2, "0"),
      byteLength: 1,
      note: "ALG_AES_256_GCM 0x01",
    },
    {
      label: "key_version",
      hex: env.keyVersion.toString(16).padStart(4, "0"),
      byteLength: 2,
      note: `u16 BE = ${env.keyVersion}`,
    },
    {
      label: "nonce",
      hex: bytesToHex(env.nonce),
      byteLength: NONCE_BYTES,
      note: "NONCE_BYTES 12",
    },
    {
      label: "ciphertext",
      hex: bytesToHex(env.ciphertext),
      byteLength: env.ciphertext.length,
    },
    {
      label: "tag",
      hex: bytesToHex(env.tag),
      byteLength: TAG_BYTES,
      note: "TAG_BYTES 16",
    },
  ];
}
