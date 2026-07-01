// src/kms-aws.ts — the real AWS KMS `KmsClient` driver (ADR-0171), wiring `kms.ts`'s documented
// seam over `@aws-sdk/client-kms`. Mirrors `audit-worm/src/store.s3.ts`'s AWS-SDK precedent (itself
// citing this package's `kms.ts` as the seam-real / cloud-behind-the-port pattern) and
// `jobs/src/trigger-driver.ts`'s injected-config / `ConfigError` fail-closed factory shape.
//
// Mapping (kms.ts:228-239):
//   generateDataKey     -> GenerateDataKey({ KeyId, KeySpec: "AES_256" }) -> { Plaintext, CiphertextBlob }
//   decryptDataKey      -> Decrypt({ KeyId, CiphertextBlob })            -> { Plaintext }
//   scheduleKeyDeletion -> ScheduleKeyDeletion({ KeyId, PendingWindowInDays })
//
// `keyId` + `region` are injected via `config`, never a module constant; missing `keyId` fails
// closed with `ConfigError` at construction, not at the first call. Tests inject a fake `client` (a
// `Pick<KMSClient, "send">`), so `bun test` never reaches AWS.
//
// ponytail: ONE CMK for every scope (config.keyId is a single ARN/alias) — the port's per-call scope
// id (the tenant/subject `keyId` in kms.ts) is accepted for interface conformance but does not
// select the CMK, so `scheduleKeyDeletion` destroys that ONE CMK for every tenant, not a per-tenant
// crypto-shred. Real per-tenant crypto-shred over AWS needs either one CMK per tenant (a keyId
// resolver here) or per-tenant Encryption Context plus a re-wrap-on-shred flow; upgrade when a
// deployment actually needs AWS-backed selective shred (today's tested shred path is
// `LocalKmsClient`, ADR-0055).
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import { ConfigError, InternalError } from "@caisson/kernel";
import type { KmsClient } from "./kms-port.ts";

/**
 * The injected KMS transport — only `send` is used, so the whole AWS SDK surface collapses to one
 * method (mirrors `S3Sendable` in `audit-worm/src/store.s3.ts`). Production supplies a real
 * `KMSClient`; tests inject a fake so no call reaches AWS.
 */
export type KmsSendable = Pick<KMSClient, "send">;

export interface AwsKmsClientConfig {
  /** The CMK key id / ARN / alias used for every operation. */
  keyId: string;
  region?: string;
  /** AWS's retention window before deletion actually executes; must be 7-30. Defaults to the AWS minimum, 7. */
  pendingWindowInDays?: number;
  /** Override the underlying KMS transport. Tests inject a fake here so `send` never reaches AWS. */
  client?: KmsSendable;
}

/** The real AWS KMS `KmsClient` (ADR-0171) — see the module-level mapping comment for the three ops. */
export function createAwsKmsClient(config: AwsKmsClientConfig): KmsClient {
  if (config.keyId === undefined || config.keyId.length === 0) {
    throw new ConfigError("createAwsKmsClient requires `keyId`");
  }
  const keyId = config.keyId;
  const pendingWindowInDays = config.pendingWindowInDays ?? 7;
  const sdk: KmsSendable =
    config.client ??
    new KMSClient(config.region !== undefined ? { region: config.region } : {});

  return {
    async generateDataKey(
      _keyId: string,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      const { Plaintext, CiphertextBlob } = await sdk.send(
        new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" }),
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

    async decryptDataKey(_keyId: string, wrappedKey: Buffer): Promise<Buffer> {
      const { Plaintext } = await sdk.send(
        new DecryptCommand({ KeyId: keyId, CiphertextBlob: wrappedKey }),
      );
      if (Plaintext === undefined) {
        throw new InternalError(
          "field-crypto: AWS KMS Decrypt returned no plaintext",
        );
      }
      return Buffer.from(Plaintext);
    },

    async scheduleKeyDeletion(_keyId: string): Promise<void> {
      await sdk.send(
        new ScheduleKeyDeletionCommand({
          KeyId: keyId,
          PendingWindowInDays: pendingWindowInDays,
        }),
      );
    },
  };
}
