// @caisson/field-crypto — per-tenant authenticated field encryption (ADR-0043/0046/0045/0006).
// Per-tenant HKDF key derivation + AES-256-GCM behind an AeadCipher seam + a self-describing
// versioned envelope + a key-version rotation registry + a Drizzle encrypted column + a pluggable
// FieldKeyProvider port (derived default, documented KMS adapter). The encryption boundary EQUALS
// the RLS tenant boundary (ADR-0005).

export { deriveTenantKey, deriveInfo, TENANT_KEY_BYTES } from "./derive.ts";

export {
  type AeadCipher,
  type AeadParts,
  AesGcmCipher,
  aesGcm,
  cipherForAlg,
} from "./cipher.ts";

export {
  type ParsedEnvelope,
  type EnvelopeParts,
  serializeEnvelope,
  parseEnvelope,
  FORMAT_VERSION,
  ALG_AES_256_GCM,
  NONCE_BYTES,
  TAG_BYTES,
  HEADER_BYTES,
} from "./envelope.ts";

export { buildAad } from "./aad.ts";

export { encryptField, decryptField } from "./encrypt-field.ts";

export { FIELD_CRYPTO_KEY_SCHEMA_SQL } from "./schema.ts";

export {
  type FieldKeyProvider,
  type SyncFieldKeyProvider,
  DerivedKeyProvider,
} from "./provider.ts";

export {
  type KeyVersionStore,
  InMemoryKeyVersionStore,
  KeyVersionRegistry,
} from "./registry.ts";

export { TenantFieldCrypto } from "./crypto.ts";

export {
  type FieldCryptoContext,
  type DisposableFieldCryptoContext,
  type KmsContextOptions,
  KMS_CONTEXT_PREFETCH_CONCURRENCY,
  KMS_CONTEXT_MAX_PREFETCH_VERSIONS,
  withFieldCryptoContext,
  currentFieldCryptoContext,
  derivedContext,
  kmsContext,
  withKmsFieldCryptoContext,
  sealField,
  openField,
  encryptedColumn,
} from "./column.ts";

export {
  type KmsClient,
  type KmsDeletionReceipt,
  type KmsOperationOptions,
  type WrappedKeyStore,
  type KeyValueStore,
  InMemoryWrappedKeyStore,
  DbWrappedKeyStore,
  KmsKeyProvider,
  LocalKmsClient,
  awsKmsClient,
} from "./kms.ts";

export {
  type PgExecutor,
  type AsyncKeyVersionStore,
  PgKeyVersionStore,
  PgWrappedKeyStore,
} from "./store.pg.ts";

export {
  type KmsSendable,
  type AwsKmsClientConfig,
  createAwsKmsClient,
} from "./kms-aws.ts";

export {
  type GcpKmsSendable,
  type GcpKmsClientConfig,
  createGcpKmsClient,
} from "./kms-gcp.ts";

export {
  type AzureKeyVaultCryptographyClient,
  type AzureKeyVaultClient,
  type AzureKeyVaultKmsClientConfig,
  createAzureKeyVaultKmsClient,
} from "./kms-azure.ts";

export {
  type CryptoShredRequest,
  type CryptoShredReceipt,
  cryptoShred,
  ERASURE_CRYPTO_SHRED,
} from "./crypto-shred.ts";
