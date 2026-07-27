// The KMS port interface, extracted to a leaf module so `kms-aws.ts` can import the type without
// creating a `kms.ts` ↔ `kms-aws.ts` cycle: `kms.ts` value-imports `createAwsKmsClient` from
// `kms-aws.ts`, and `kms-aws.ts` needs only this type. With `tsPreCompilationDeps: true` the
// dependency-cruiser `no-circular` rule counts the type-only edge, so the type lives here (a leaf with
// no intra-package imports) and both `kms.ts` (re-exports for back-compat) and `kms-aws.ts` import it.

/**
 * The KMS port. A production impl calls the cloud KMS; the test double wraps locally. Every operation
 * is scoped by `keyId` — a per-(tenant|subject) key identifier. Provisioning per SUBJECT (rather than
 * per tenant) is what makes `scheduleKeyDeletion` a per-subject CRYPTO-SHRED: destroying a subject's
 * KEK renders every DEK wrapped under it un-unwrappable once the provider proves destruction is
 * irreversible.
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
      readonly state:
        | "pending-deletion"
        | "destroy-scheduled"
        | "soft-deleted"
        /**
         * Deliberately NOT folded into `pending-deletion`. For an AWS multi-Region PRIMARY with
         * live replicas the request is accepted but the waiting period has NOT started, and per the
         * ScheduleKeyDeletion reference "this status can continue indefinitely" — the clock begins
         * only once the last replica is deleted, not merely scheduled. These receipts are written
         * verbatim into the append-only WORM chain, so a reader must be able to distinguish
         * "retention running, completes at T" from "key material still resident in every replica
         * Region, with no completion date in prospect".
         */
        | "replica-pending-deletion";
      readonly irreversible: false;
      /** Provider-reported completion/purge instant, when one was returned. */
      readonly scheduledFor?: string;
    };

/** One bounded cloud-KMS operation budget, supplied by the request boundary. */
export interface KmsOperationOptions {
  readonly abortSignal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface KmsClient {
  /** Generate a fresh 32-byte DEK and return it alongside its KEK-wrapped form, under scope `keyId`. */
  generateDataKey(
    keyId: string,
    options?: KmsOperationOptions,
  ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }>;
  /** Unwrap a DEK previously wrapped under `keyId`. Throws once `keyId` has been crypto-shredded. */
  decryptDataKey(
    keyId: string,
    wrappedKey: Buffer,
    options?: KmsOperationOptions,
  ): Promise<Buffer>;
  /**
   * Request deletion of `keyId`'s key material — the crypto-shred primitive. The receipt reports
   * only the destruction state the provider proved: cloud retention windows remain explicitly
   * pending/recoverable, while only provider-proved destruction or completed purge is irreversible.
   *
   * Requires an EXPLICIT, non-empty `keyId` (ADR-0197): every driver MUST throw rather than fall back
   * to a shared/default scope, because shredding a shared key would destroy every tenant's material.
   */
  /**
   * Destructive calls deliberately do not accept a request-time abort budget. A provider may accept
   * deletion immediately before a local timeout fires, leaving the caller without a receipt. Hosts
   * must run this primitive in a durable, authorized workflow and persist/reconcile its receipt.
   */
  scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt>;
}
