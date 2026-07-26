import type { KeyWrapAlgorithm } from "@azure/keyvault-keys";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  InternalError,
  ValidationError,
  parseStrict,
  strictObject,
} from "@caisson/kernel";
import type { KmsClient, KmsDeletionReceipt } from "./kms-port.ts";

export interface AzureKeyVaultCryptographyClient {
  wrapKey(
    algorithm: KeyWrapAlgorithm,
    key: Uint8Array,
  ): Promise<{ readonly result: Uint8Array }>;
  unwrapKey(
    algorithm: KeyWrapAlgorithm,
    encryptedKey: Uint8Array,
  ): Promise<{ readonly result: Uint8Array }>;
}

export interface AzureKeyVaultClient {
  /**
   * Optional convenience seam for a composed facade. The official Azure `KeyClient` does not
   * expose cryptographic operations, so production callers normally inject `cryptographyClient`.
   */
  getCryptographyClient?(keyName: string): AzureKeyVaultCryptographyClient;
  beginDeleteKey(keyName: string): Promise<{
    pollUntilDone(): Promise<{
      readonly properties: {
        readonly recoveryLevel?: string;
        readonly scheduledPurgeDate?: Date;
      };
    }>;
  }>;
  purgeDeletedKey(keyName: string): Promise<void>;
}

export interface AzureKeyVaultKmsClientConfig {
  readonly keyName: string;
  readonly purgeProtectionEnabled: boolean;
  readonly purgeOnDelete?: boolean;
  readonly wrapAlgorithm?: KeyWrapAlgorithm;
  readonly client: AzureKeyVaultClient;
  /** Map a logical KMS scope to the concrete Azure key name. */
  readonly scopeKeyName?: (keyId: string) => string;
  /** Build the official SDK's separate `CryptographyClient` for one key name. */
  readonly cryptographyClient?: (
    keyName: string,
  ) => AzureKeyVaultCryptographyClient;
}

function isAzureKeyVaultClient(value: unknown): value is AzureKeyVaultClient {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "beginDeleteKey") === "function" &&
    typeof Reflect.get(value, "purgeDeletedKey") === "function"
  );
}

const keyNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(127)
  .regex(
    /^[0-9A-Za-z-]+$/,
    "keyName must use only letters, digits, and hyphens",
  );

const azureKeyVaultKmsClientConfigSchema = strictObject({
  keyName: keyNameSchema,
  purgeProtectionEnabled: z.boolean(),
  purgeOnDelete: z.boolean().optional().default(false),
  wrapAlgorithm: z
    .enum([
      "A128KW",
      "A192KW",
      "A256KW",
      "RSA-OAEP",
      "RSA-OAEP-256",
      "RSA1_5",
      "CKM_AES_KEY_WRAP",
      "CKM_AES_KEY_WRAP_PAD",
    ])
    .optional()
    .default("RSA-OAEP-256"),
  client: z.custom<AzureKeyVaultClient>(isAzureKeyVaultClient, {
    message: "client must implement beginDeleteKey() and purgeDeletedKey()",
  }),
  scopeKeyName: z
    .custom<(keyId: string) => string>((value) => typeof value === "function", {
      message: "scopeKeyName must map a logical scope to an Azure key name",
    })
    .optional(),
  cryptographyClient: z
    .custom<(keyName: string) => AzureKeyVaultCryptographyClient>(
      (value) => typeof value === "function",
      {
        message:
          "cryptographyClient must construct an injected Azure CryptographyClient",
      },
    )
    .optional(),
});

export function createAzureKeyVaultKmsClient(
  config: AzureKeyVaultKmsClientConfig,
): KmsClient {
  const parsed = parseStrict(azureKeyVaultKmsClientConfigSchema, config);
  if (parsed.purgeOnDelete && parsed.purgeProtectionEnabled) {
    throw new ValidationError(
      "createAzureKeyVaultKmsClient cannot purge on delete while purge protection is enabled",
    );
  }
  const facadeCryptographyClient = parsed.client.getCryptographyClient;
  const cryptographyClient =
    parsed.cryptographyClient ??
    (facadeCryptographyClient === undefined
      ? undefined
      : (keyName: string) =>
          facadeCryptographyClient.call(parsed.client, keyName));
  if (cryptographyClient === undefined) {
    throw new ValidationError(
      "createAzureKeyVaultKmsClient requires an injected cryptographyClient when client is an Azure KeyClient",
    );
  }

  const keyFor = (keyId: string): string => {
    if (keyId.length === 0) return parsed.keyName;
    const candidate =
      parsed.scopeKeyName === undefined ? keyId : parsed.scopeKeyName(keyId);
    return parseStrict(keyNameSchema, candidate);
  };

  return {
    async generateDataKey(
      keyId: string,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      const plaintextKey = randomBytes(32);
      const result = await cryptographyClient(keyFor(keyId)).wrapKey(
        parsed.wrapAlgorithm,
        plaintextKey,
      );
      if (
        !(result.result instanceof Uint8Array) ||
        result.result.length === 0
      ) {
        throw new InternalError(
          "field-crypto: Azure Key Vault WrapKey returned no wrapped key",
        );
      }
      return {
        plaintextKey,
        wrappedKey: Buffer.from(result.result),
      };
    },

    async decryptDataKey(keyId: string, wrappedKey: Buffer): Promise<Buffer> {
      const result = await cryptographyClient(keyFor(keyId)).unwrapKey(
        parsed.wrapAlgorithm,
        wrappedKey,
      );
      if (
        !(result.result instanceof Uint8Array) ||
        result.result.length !== 32
      ) {
        throw new InternalError(
          "field-crypto: Azure Key Vault UnwrapKey did not return a 32-byte DEK",
        );
      }
      return Buffer.from(result.result);
    },

    async scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt> {
      if (keyId.length === 0) {
        throw new ValidationError(
          "field-crypto: Azure Key Vault scheduleKeyDeletion requires an explicit keyId — refusing to delete the default key",
        );
      }
      const keyName = keyFor(keyId);
      const poller = await parsed.client.beginDeleteKey(keyName);
      const deleted = await poller.pollUntilDone();
      const recoveryLevel = deleted.properties.recoveryLevel;

      if (parsed.purgeOnDelete) {
        if (
          recoveryLevel === undefined ||
          !recoveryLevel.includes("Purgeable")
        ) {
          throw new InternalError(
            "field-crypto: Azure Key Vault deletion response did not prove the key purgeable",
          );
        }
        await parsed.client.purgeDeletedKey(keyName);
        return { state: "purged", irreversible: true };
      }

      if (recoveryLevel === "Purgeable") {
        return { state: "destroyed", irreversible: true };
      }
      const scheduledFor = deleted.properties.scheduledPurgeDate?.toISOString();
      return scheduledFor === undefined
        ? { state: "soft-deleted", irreversible: false }
        : {
            state: "soft-deleted",
            irreversible: false,
            scheduledFor,
          };
    },
  };
}
