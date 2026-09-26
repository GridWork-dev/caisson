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
import {
  ConfigError,
  InternalError,
  ValidationError,
} from "@caisson-sh/kernel";
import { withKmsOperationBudget } from "./kms-budget.ts";
import type {
  KmsClient,
  KmsDeletionReceipt,
  KmsOperationOptions,
} from "./kms-port.ts";

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

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new Error("field-crypto: AWS KMS operation aborted");
  }
}

// An AWS key identifier is EITHER a canonical UUID or a multi-Region `mrk-` id. Accepting only the
// former rejected valid multi-Region CMKs outright, so a tenant holding one could never be shredded.
const AWS_KMS_KEY_ID_BODY =
  "(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|mrk-[0-9a-f]{32})";
const AWS_KMS_KEY_ID = new RegExp(`^${AWS_KMS_KEY_ID_BODY}$`, "i");
const AWS_KMS_KEY_ARN = new RegExp(
  `^arn:[a-z0-9-]+:kms:[a-z0-9-]+:\\d{12}:key\\/(${AWS_KMS_KEY_ID_BODY})$`,
  "i",
);

function deletionKeyIdentity(keyId: string): {
  readonly requestedArn?: string;
  readonly keyUuid: string;
} {
  if (AWS_KMS_KEY_ID.test(keyId)) return { keyUuid: keyId.toLowerCase() };
  const match = AWS_KMS_KEY_ARN.exec(keyId);
  const keyUuid = match?.[1];
  if (keyUuid === undefined) {
    throw new ValidationError(
      "field-crypto: AWS KMS deletion requires a canonical key ID or key ARN; aliases are not accepted",
    );
  }
  return { requestedArn: keyId, keyUuid: keyUuid.toLowerCase() };
}

/** The real AWS KMS `KmsClient` (ADR-0171 / ADR-0197) — see the module-level mapping comment for the three ops. */
export function createAwsKmsClient(config: AwsKmsClientConfig): KmsClient {
  if (config.keyId === undefined || config.keyId.length === 0) {
    throw new ConfigError("createAwsKmsClient requires a default `keyId`");
  }
  const defaultKeyId = config.keyId;
  const pendingWindowInDays =
    config.pendingWindowInDays === undefined ? 7 : config.pendingWindowInDays;
  if (
    !Number.isInteger(pendingWindowInDays) ||
    pendingWindowInDays < 7 ||
    pendingWindowInDays > 30
  ) {
    throw new ConfigError(
      "createAwsKmsClient pendingWindowInDays must be an integer from 7 through 30",
    );
  }
  const sdk: KmsSendable =
    config.client ??
    new KMSClient(config.region !== undefined ? { region: config.region } : {});

  // The CMK a call targets: the per-tenant scope `keyId`, or the default CMK when none is passed.
  const cmkFor = (keyId: string): string =>
    keyId.length > 0 ? keyId : defaultKeyId;

  return {
    async generateDataKey(
      keyId: string,
      options?: KmsOperationOptions,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      return withKmsOperationBudget(options, (abortSignal) =>
        sdk
          .send(
            new GenerateDataKeyCommand({
              KeyId: cmkFor(keyId),
              KeySpec: "AES_256",
              EncryptionContext: scopeContext(keyId),
            }),
            { abortSignal },
          )
          .then(({ Plaintext, CiphertextBlob }) => {
            let plaintextKey: Buffer | undefined;
            try {
              if (!(Plaintext instanceof Uint8Array)) {
                throw new InternalError(
                  "field-crypto: AWS KMS GenerateDataKey returned no key material",
                );
              }
              if (Plaintext.byteLength !== 32) {
                throw new InternalError(
                  "field-crypto: AWS KMS GenerateDataKey returned a DEK that is not 32-byte AES-256 material",
                );
              }
              if (
                !(CiphertextBlob instanceof Uint8Array) ||
                CiphertextBlob.byteLength === 0
              ) {
                throw new InternalError(
                  "field-crypto: AWS KMS GenerateDataKey returned no key material: wrapped ciphertext is missing or empty",
                );
              }
              throwIfAborted(abortSignal);
              plaintextKey = Buffer.from(Plaintext);
              return {
                plaintextKey,
                wrappedKey: Buffer.from(CiphertextBlob),
              };
            } catch (error) {
              plaintextKey?.fill(0);
              throw error;
            } finally {
              if (Plaintext instanceof Uint8Array) Plaintext.fill(0);
            }
          }),
      );
    },

    async decryptDataKey(
      keyId: string,
      wrappedKey: Buffer,
      options?: KmsOperationOptions,
    ): Promise<Buffer> {
      return withKmsOperationBudget(options, (abortSignal) =>
        sdk
          .send(
            new DecryptCommand({
              KeyId: cmkFor(keyId),
              CiphertextBlob: wrappedKey,
              EncryptionContext: scopeContext(keyId),
            }),
            { abortSignal },
          )
          .then(({ Plaintext }) => {
            if (!(Plaintext instanceof Uint8Array)) {
              throw new InternalError(
                "field-crypto: AWS KMS Decrypt returned no plaintext",
              );
            }
            try {
              if (Plaintext.byteLength !== 32) {
                throw new InternalError(
                  "field-crypto: AWS KMS Decrypt returned a DEK that is not 32-byte AES-256 material",
                );
              }
              throwIfAborted(abortSignal);
              return Buffer.from(Plaintext);
            } finally {
              Plaintext.fill(0);
            }
          }),
      );
    },

    async scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt> {
      // Refuse an empty scope: falling back to the default CMK here would crypto-shred EVERY tenant.
      if (keyId.length === 0) {
        throw new ValidationError(
          "field-crypto: AWS KMS scheduleKeyDeletion requires an explicit keyId — refusing to delete the default CMK",
        );
      }
      const expected = deletionKeyIdentity(keyId);
      const {
        KeyId,
        KeyState,
        DeletionDate,
        PendingWindowInDays: acceptedWindow,
      } = await sdk.send(
        new ScheduleKeyDeletionCommand({
          KeyId: keyId,
          PendingWindowInDays: pendingWindowInDays,
        }),
      );
      const returned =
        typeof KeyId === "string" ? AWS_KMS_KEY_ARN.exec(KeyId) : null;
      if (
        returned?.[1]?.toLowerCase() !== expected.keyUuid ||
        (expected.requestedArn !== undefined && KeyId !== expected.requestedArn)
      ) {
        throw new InternalError(
          "field-crypto: AWS KMS returned an unexpected key identity for deletion",
        );
      }
      // A multi-Region PRIMARY that still has live replicas. AWS accepts the request, but per the
      // ScheduleKeyDeletion reference the key "cannot be replicated or used in cryptographic
      // operations. This status can continue indefinitely. When the last of its replicas keys is
      // deleted (not just scheduled), the key state ... changes to PendingDeletion and its waiting
      // period (PendingWindowInDays) begins."
      //
      // So the retention clock has NOT started and may never start. Only `DeletionDate` is absent
      // from this response — the accepted window is still reported — so keep proving the window
      // AWS accepted, and report a DISTINCT state rather than reusing `pending-deletion`. These
      // receipts land verbatim in the append-only WORM chain; calling this a scheduled deletion
      // would mint a permanent record that a waiting period is running when none is.
      if (KeyState === "PendingReplicaDeletion") {
        // Absent window is a HARD failure, exactly as on the ordinary PendingDeletion path below.
        // The comment above states AWS always reports the accepted window here, so tolerating
        // `undefined` could never be defensive — it could only wave through the very protocol
        // violation this assertion exists to catch, on the one path whose receipt is permanent.
        if (acceptedWindow !== pendingWindowInDays) {
          throw new InternalError(
            "field-crypto: AWS KMS did not prove PendingReplicaDeletion with the requested retention window",
          );
        }
        // No scheduledFor: AWS cannot know one until the last replica is deleted.
        return { state: "replica-pending-deletion", irreversible: false };
      }
      if (
        KeyState !== "PendingDeletion" ||
        !(DeletionDate instanceof Date) ||
        !Number.isFinite(DeletionDate.getTime()) ||
        acceptedWindow !== pendingWindowInDays
      ) {
        throw new InternalError(
          "field-crypto: AWS KMS did not prove PendingDeletion with the requested retention window and deletion date",
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
