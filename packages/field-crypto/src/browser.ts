// The browser-safe entry (`@caisson-sh/field-crypto/browser`, ADR-0396): per-tenant HKDF key derivation,
// AES-256-GCM seal/open, the row-bound AAD tuple, and the self-describing envelope codec — the real
// primitive, safe inside a client bundle or any WebCrypto-only runtime. ADDITIVE: the `.` barrel is
// untouched and stays the full node-capable surface, and every name here is also on `.` (the subset
// test in browser-safety.test.ts pins that direction, one-way).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - the KMS adapters (kms-aws / kms-gcp / kms-azure) and their vendor SDKs — cloud-KMS calls belong
//     on a server holding the credential, never in a bundle the buyer's users download.
//   - column.ts (the Drizzle `customType` seam), store.pg.ts, and schema.ts — database-side.
//   - `deriveTenantKey` / `AesGcmCipher` / `encryptField` / `decryptField` — the node:crypto twins of
//     what is exported here. Their browser counterparts are the `…Async` names below.
//   - crypto-shred.ts — it composes the registry + provider ports, which reach the stores above.
export {
  ALG_AES_256_GCM,
  FORMAT_VERSION,
  HEADER_BYTES,
  MAX_KEY_VERSION,
  NONCE_BYTES,
  TAG_BYTES,
  TENANT_KEY_BYTES,
  aesGcmOpenAsync,
  aesGcmSealAsync,
  buildAadBytes,
  deriveInfo,
  deriveTenantKeyAsync,
  nextKeyVersion,
  parseEnvelopeBytes,
  serializeEnvelopeBytes,
} from "./portable.ts";
export type {
  AeadBytesParts,
  EnvelopeBytesParts,
  ParsedEnvelopeBytes,
} from "./portable.ts";
