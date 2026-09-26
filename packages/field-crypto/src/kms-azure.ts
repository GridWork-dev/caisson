import type { KeyWrapAlgorithm } from "@azure/keyvault-keys";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  ConfigError,
  InternalError,
  ValidationError,
  parseStrict,
  strictObject,
} from "@caisson-sh/kernel";
import type {
  KmsClient,
  KmsDeletionReceipt,
  KmsOperationOptions,
} from "./kms-port.ts";
import { withKmsOperationBudget } from "./kms-budget.ts";

export interface AzureKeyVaultCryptographyClient {
  wrapKey(
    algorithm: KeyWrapAlgorithm,
    key: Uint8Array,
    options?: KmsOperationOptions,
  ): Promise<{
    readonly result: Uint8Array;
    readonly keyID?: string;
    readonly algorithm?: KeyWrapAlgorithm;
  }>;
  unwrapKey(
    algorithm: KeyWrapAlgorithm,
    encryptedKey: Uint8Array,
    options?: KmsOperationOptions,
  ): Promise<{
    readonly result: Uint8Array;
    readonly keyID?: string;
    readonly algorithm?: KeyWrapAlgorithm;
  }>;
}

export interface AzureKeyVaultClient {
  /**
   * Optional convenience seam for a composed facade. The official Azure `KeyClient` does not
   * expose cryptographic operations, so production callers normally inject `cryptographyClient`.
   */
  getCryptographyClient?(
    keyName: string,
    keyVersion?: string,
  ): AzureKeyVaultCryptographyClient;
  beginDeleteKey(
    keyName: string,
    options?: KmsOperationOptions,
  ): Promise<{
    pollUntilDone(options?: KmsOperationOptions): Promise<{
      readonly properties: {
        readonly recoveryLevel?: string;
        readonly scheduledPurgeDate?: Date;
      };
    }>;
  }>;
  purgeDeletedKey(
    keyName: string,
    options?: KmsOperationOptions,
  ): Promise<void>;
}

export interface AzureKeyVaultKmsClientConfig {
  readonly keyName: string;
  /** Expected Azure Key Vault URL; production callers pin returned key identities to this origin. */
  readonly expectedVaultUrl?: string;
  readonly purgeProtectionEnabled: boolean;
  readonly purgeOnDelete?: boolean;
  readonly wrapAlgorithm?: KeyWrapAlgorithm;
  readonly client: AzureKeyVaultClient;
  /** Map a logical KMS scope to the concrete Azure key name. */
  readonly scopeKeyName?: (keyId: string) => string;
  /** Build the official SDK's separate `CryptographyClient` for one key name. */
  readonly cryptographyClient?: (
    keyName: string,
    keyVersion?: string,
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
  expectedVaultUrl: z
    .string()
    .trim()
    .url()
    .refine((value) => new URL(value).protocol === "https:")
    .optional(),
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
    .custom<
      (keyName: string, keyVersion?: string) => AzureKeyVaultCryptographyClient
    >((value) => typeof value === "function", {
      message:
        "cryptographyClient must construct an injected Azure CryptographyClient",
    })
    .optional(),
});

const azureKeyVersionSchema = z
  .string()
  .min(1)
  .max(127)
  .regex(/^[0-9A-Za-z-]+$/);

const azureWrappedDekSchema = strictObject({
  formatVersion: z.literal(1),
  keyVersion: azureKeyVersionSchema,
  wrapAlgorithm: z.enum([
    "A128KW",
    "A192KW",
    "A256KW",
    "RSA-OAEP",
    "RSA-OAEP-256",
    "RSA1_5",
    "CKM_AES_KEY_WRAP",
    "CKM_AES_KEY_WRAP_PAD",
  ]),
  ciphertext: z
    .string()
    .min(4)
    .max(32_768)
    .regex(/^[0-9A-Za-z+/]+={0,2}$/),
});

function versionFromKeyId(
  keyId: string,
  expectedKeyName: string,
  expectedVaultUrl?: string,
): string {
  let parsed: URL;
  try {
    parsed = new URL(keyId);
  } catch {
    throw new ConfigError(
      "field-crypto: Azure Key Vault WrapKey returned an invalid key identifier",
    );
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (expectedVaultUrl !== undefined &&
      parsed.origin !== new URL(expectedVaultUrl).origin) ||
    segments.length !== 3 ||
    segments[0] !== "keys" ||
    segments[1] !== expectedKeyName
  ) {
    throw new ConfigError(
      "field-crypto: Azure Key Vault WrapKey returned a key identifier outside the expected key scope",
    );
  }
  return parseStrict(azureKeyVersionSchema, segments[2]);
}

function encodeWrappedDek(
  keyVersion: string,
  wrapAlgorithm: KeyWrapAlgorithm,
  ciphertext: Uint8Array,
): Buffer {
  return Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      keyVersion,
      wrapAlgorithm,
      ciphertext: Buffer.from(ciphertext).toString("base64"),
    }),
    "utf8",
  );
}

function decodeWrappedDek(
  wrappedKey: Buffer,
  expectedAlgorithm: KeyWrapAlgorithm,
): {
  readonly keyVersion: string;
  readonly ciphertext: Buffer;
} {
  let raw: unknown;
  try {
    raw = JSON.parse(wrappedKey.toString("utf8"));
  } catch {
    throw new ValidationError(
      "field-crypto: Azure wrapped DEK payload is malformed",
    );
  }
  const parsed = parseStrict(azureWrappedDekSchema, raw);
  if (parsed.wrapAlgorithm !== expectedAlgorithm) {
    throw new ValidationError(
      "field-crypto: Azure wrapped DEK algorithm does not match the configured algorithm",
    );
  }
  return {
    keyVersion: parsed.keyVersion,
    ciphertext: Buffer.from(parsed.ciphertext, "base64"),
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw (
      signal.reason ?? new Error("field-crypto: Azure KMS operation aborted")
    );
  }
}

function remainingOptions(
  abortSignal: AbortSignal,
  remainingTimeoutMs: () => number,
): KmsOperationOptions {
  return {
    abortSignal,
    timeoutMs: remainingTimeoutMs(),
  };
}

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
      : (keyName: string, keyVersion?: string) =>
          facadeCryptographyClient.call(parsed.client, keyName, keyVersion));
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
      options?: KmsOperationOptions,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      const plaintextKey = randomBytes(32);
      try {
        return await withKmsOperationBudget(
          options,
          async (abortSignal, remainingTimeoutMs) => {
            const keyName = keyFor(keyId);
            const result = await cryptographyClient(keyName).wrapKey(
              parsed.wrapAlgorithm,
              plaintextKey,
              remainingOptions(abortSignal, remainingTimeoutMs),
            );
            throwIfAborted(abortSignal);
            if (
              !(result.result instanceof Uint8Array) ||
              result.result.length === 0
            ) {
              throw new InternalError(
                "field-crypto: Azure Key Vault WrapKey returned no wrapped key",
              );
            }
            if (result.keyID === undefined) {
              throw new InternalError(
                "field-crypto: Azure Key Vault WrapKey returned no versioned key identifier",
              );
            }
            if (
              result.algorithm !== undefined &&
              result.algorithm !== parsed.wrapAlgorithm
            ) {
              throw new InternalError(
                "field-crypto: Azure Key Vault WrapKey returned an unexpected algorithm",
              );
            }
            const keyVersion = versionFromKeyId(
              result.keyID,
              keyName,
              parsed.expectedVaultUrl,
            );
            return {
              plaintextKey,
              wrappedKey: encodeWrappedDek(
                keyVersion,
                parsed.wrapAlgorithm,
                result.result,
              ),
            };
          },
        );
      } catch (error) {
        plaintextKey.fill(0);
        throw error;
      }
    },

    async decryptDataKey(
      keyId: string,
      wrappedKey: Buffer,
      options?: KmsOperationOptions,
    ): Promise<Buffer> {
      const keyName = keyFor(keyId);
      const encoded = decodeWrappedDek(wrappedKey, parsed.wrapAlgorithm);
      return withKmsOperationBudget(
        options,
        async (abortSignal, remainingTimeoutMs) => {
          const result = await cryptographyClient(
            keyName,
            encoded.keyVersion,
          ).unwrapKey(
            parsed.wrapAlgorithm,
            encoded.ciphertext,
            remainingOptions(abortSignal, remainingTimeoutMs),
          );
          if (!(result.result instanceof Uint8Array)) {
            throw new InternalError(
              "field-crypto: Azure Key Vault UnwrapKey did not return a 32-byte DEK",
            );
          }
          try {
            throwIfAborted(abortSignal);
            if (result.result.length !== 32) {
              throw new InternalError(
                "field-crypto: Azure Key Vault UnwrapKey did not return a 32-byte DEK",
              );
            }
            if (
              result.algorithm !== undefined &&
              result.algorithm !== parsed.wrapAlgorithm
            ) {
              throw new InternalError(
                "field-crypto: Azure Key Vault UnwrapKey returned an unexpected algorithm",
              );
            }
            if (
              result.keyID !== undefined &&
              versionFromKeyId(
                result.keyID,
                keyName,
                parsed.expectedVaultUrl,
              ) !== encoded.keyVersion
            ) {
              throw new InternalError(
                "field-crypto: Azure Key Vault UnwrapKey returned an unexpected key version",
              );
            }
            return Buffer.from(result.result);
          } finally {
            result.result.fill(0);
          }
        },
      );
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
