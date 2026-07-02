// The KMS port interface, extracted to a leaf module so `kms-aws.ts` can import the type without
// creating a `kms.ts` ↔ `kms-aws.ts` cycle: `kms.ts` value-imports `createAwsKmsClient` from
// `kms-aws.ts`, and `kms-aws.ts` needs only this type. With `tsPreCompilationDeps: true` the
// dependency-cruiser `no-circular` rule counts the type-only edge, so the type lives here (a leaf with
// no intra-package imports) and both `kms.ts` (re-exports for back-compat) and `kms-aws.ts` import it.

/**
 * The KMS port. A production impl calls the cloud KMS; the test double wraps locally. Every operation
 * is scoped by `keyId` — a per-(tenant|subject) key identifier. Provisioning per SUBJECT (rather than
 * per tenant) is what makes `scheduleKeyDeletion` a per-subject CRYPTO-SHRED: destroying a subject's
 * KEK renders every DEK wrapped under it permanently un-unwrappable.
 */
export interface KmsClient {
  /** Generate a fresh 32-byte DEK and return it alongside its KEK-wrapped form, under scope `keyId`. */
  generateDataKey(
    keyId: string,
  ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }>;
  /** Unwrap a DEK previously wrapped under `keyId`. Throws once `keyId` has been crypto-shredded. */
  decryptDataKey(keyId: string, wrappedKey: Buffer): Promise<Buffer>;
  /**
   * Schedule irreversible deletion of `keyId`'s key material — the crypto-shred primitive. After this
   * the wrapped DEKs under `keyId` can never be unwrapped, so the field ciphertext they protect is
   * unrecoverable WITHOUT mutating any append-only store (ADR-0055). Irreversible by design.
   *
   * Requires an EXPLICIT, non-empty `keyId` (ADR-0197): every driver MUST throw rather than fall back
   * to a shared/default scope, because shredding a shared key would destroy every tenant's material.
   */
  scheduleKeyDeletion(keyId: string): Promise<void>;
}
