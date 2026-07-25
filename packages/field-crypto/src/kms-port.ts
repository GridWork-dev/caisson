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
export type KmsDeletionReceipt =
  | {
      /** The provider proved that key material no longer exists. */
      readonly state: "destroyed" | "purged";
      readonly irreversible: true;
    }
  | {
      /**
       * The provider accepted deletion, but key material is still cancellable or recoverable until
       * the provider completes its retention window.
       */
      readonly state: "pending-deletion" | "destroy-scheduled" | "soft-deleted";
      readonly irreversible: false;
      /** Provider-reported completion/purge instant, when one was returned. */
      readonly scheduledFor?: string;
    };

export interface KmsClient {
  /** Generate a fresh 32-byte DEK and return it alongside its KEK-wrapped form, under scope `keyId`. */
  generateDataKey(
    keyId: string,
  ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }>;
  /** Unwrap a DEK previously wrapped under `keyId`. Throws once `keyId` has been crypto-shredded. */
  decryptDataKey(keyId: string, wrappedKey: Buffer): Promise<Buffer>;
  /**
   * Request deletion of `keyId`'s key material — the crypto-shred primitive. The receipt reports
   * only the destruction state the provider proved: cloud retention windows remain explicitly
   * pending/recoverable, while only provider-proved destruction or completed purge is irreversible.
   *
   * Requires an EXPLICIT, non-empty `keyId` (ADR-0197): every driver MUST throw rather than fall back
   * to a shared/default scope, because shredding a shared key would destroy every tenant's material.
   */
  scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt>;
}
