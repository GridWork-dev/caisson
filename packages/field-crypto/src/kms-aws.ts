// src/kms-aws.ts — the real AWS KMS `KmsClient` driver (ADR-0171 / ADR-0197), wiring `kms.ts`'s
// documented seam over `@aws-sdk/client-kms`. Mirrors `audit-worm/src/store.s3.ts`'s AWS-SDK
// precedent (itself citing this package's `kms.ts` as the seam-real / cloud-behind-the-port pattern)
// and `jobs/src/trigger-driver.ts`'s injected-config / `ConfigError` fail-closed factory shape.
//
// PER-TENANT CMK (ADR-0197). The port's per-call `keyId` IS the KEK scope (the provider passes
// `tenantId`), so every op TARGETS that scope's CMK: `keyId` is used as the AWS `KeyId`, falling back
// to the configured default CMK (`config.keyId`) ONLY when the per-call scope is empty. A per-tenant
// `scheduleKeyDeletion` therefore destroys ONLY that tenant's CMK — never a shared one. And
// `scheduleKeyDeletion` REFUSES an empty scope: silently deleting the default CMK would crypto-shred
// EVERY tenant (the blast-radius bug this driver previously shipped), so it fails closed instead.
//
// TENANT BINDING. Each op sets an `EncryptionContext` binding the scope (mirrors how `aad.ts` binds
// `tenant∥version∥column` as GCM AAD in the envelope layer): a DEK wrapped for tenant A cannot be
// unwrapped in tenant B's context even if they happen to share a CMK — AWS `Decrypt` fails when the
// context does not match the one used at `GenerateDataKey`.
//
// Mapping:
//   generateDataKey(keyId)      -> GenerateDataKey({ KeyId: cmkFor(keyId), KeySpec: "AES_256", EncryptionContext })
//   decryptDataKey(keyId, blob) -> Decrypt({ KeyId: cmkFor(keyId), CiphertextBlob: blob, EncryptionContext })
//   scheduleKeyDeletion(keyId)  -> ScheduleKeyDeletion({ KeyId: keyId, PendingWindowInDays })  // empty keyId throws
//
// `region` + the default `keyId` are injected via `config`, never a module constant; a missing
// default `keyId` fails closed with `ConfigError` at construction, not at the first call. Tests inject
// a fake `client` (a `Pick<KMSClient, "send">`), so `bun test` never reaches AWS.
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import { ConfigError, InternalError, ValidationError } from "@caisson/kernel";
import type { KmsClient, KmsDeletionReceipt } from "./kms-port.ts";

/**
 * The injected KMS transport — only `send` is used, so the whole AWS SDK surface collapses to one
 * method (mirrors `S3Sendable` in `audit-worm/src/store.s3.ts`). Production supplies a real
 * `KMSClient`; tests inject a fake so no call reaches AWS.
 */
export type KmsSendable = Pick<KMSClient, "send">;

export interface AwsKmsClientConfig {
  /** The DEFAULT CMK key id / ARN / alias — used only when a call passes no per-tenant scope `keyId`. */
  keyId: string;
  region?: string;
  /** AWS's retention window before deletion actually executes; must be 7-30. Defaults to the AWS minimum, 7. */
  pendingWindowInDays?: number;
  /** Override the underlying KMS transport. Tests inject a fake here so `send` never reaches AWS. */
  client?: KmsSendable;
}

/**
 * The `EncryptionContext` binding a wrapped DEK to its tenant/subject scope — mirrors the GCM AAD in
 * `aad.ts`. A blob generated under one scope's context fails to `Decrypt` under another's, so a DEK
 * wrapped for tenant A cannot be unwrapped in tenant B's context even on a shared CMK.
 */
function scopeContext(keyId: string): Record<string, string> {
  return { "caisson:field-crypto:scope": keyId };
}

/** The real AWS KMS `KmsClient` (ADR-0171 / ADR-0197) — see the module-level mapping comment for the three ops. */
export function createAwsKmsClient(config: AwsKmsClientConfig): KmsClient {
  if (config.keyId === undefined || config.keyId.length === 0) {
    throw new ConfigError("createAwsKmsClient requires a default `keyId`");
  }
  const defaultKeyId = config.keyId;
  const pendingWindowInDays = config.pendingWindowInDays ?? 7;
  const sdk: KmsSendable =
    config.client ??
    new KMSClient(config.region !== undefined ? { region: config.region } : {});

  // The CMK a call targets: the per-tenant scope `keyId`, or the default CMK when none is passed.
  const cmkFor = (keyId: string): string =>
    keyId.length > 0 ? keyId : defaultKeyId;

  return {
    async generateDataKey(
      keyId: string,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      const { Plaintext, CiphertextBlob } = await sdk.send(
        new GenerateDataKeyCommand({
          KeyId: cmkFor(keyId),
          KeySpec: "AES_256",
          EncryptionContext: scopeContext(keyId),
        }),
      );
      if (Plaintext === undefined || CiphertextBlob === undefined) {
        throw new InternalError(
          "field-crypto: AWS KMS GenerateDataKey returned no key material",
        );
      }
      return {
        plaintextKey: Buffer.from(Plaintext),
        wrappedKey: Buffer.from(CiphertextBlob),
      };
    },

    async decryptDataKey(keyId: string, wrappedKey: Buffer): Promise<Buffer> {
      const { Plaintext } = await sdk.send(
        new DecryptCommand({
          KeyId: cmkFor(keyId),
          CiphertextBlob: wrappedKey,
          EncryptionContext: scopeContext(keyId),
        }),
      );
      if (Plaintext === undefined) {
        throw new InternalError(
          "field-crypto: AWS KMS Decrypt returned no plaintext",
        );
      }
      return Buffer.from(Plaintext);
    },

    async scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt> {
      // Refuse an empty scope: falling back to the default CMK here would crypto-shred EVERY tenant.
      if (keyId.length === 0) {
        throw new ValidationError(
          "field-crypto: AWS KMS scheduleKeyDeletion requires an explicit keyId — refusing to delete the default CMK",
        );
      }
      const { KeyState, DeletionDate } = await sdk.send(
        new ScheduleKeyDeletionCommand({
          KeyId: keyId,
          PendingWindowInDays: pendingWindowInDays,
        }),
      );
      if (KeyState !== "PendingDeletion" || DeletionDate === undefined) {
        throw new InternalError(
          "field-crypto: AWS KMS did not prove PendingDeletion with a deletion date",
        );
      }
      return {
        state: "pending-deletion",
        irreversible: false,
        scheduledFor: DeletionDate.toISOString(),
      };
    },
  };
}
