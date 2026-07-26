import { ClientSecretCredential } from "@azure/identity";
import {
  CryptographyClient,
  KeyClient,
  type KeyWrapAlgorithm,
} from "@azure/keyvault-keys";
import type {
  AzureKeyVaultCryptographyClient,
  FieldCryptoContext,
  KmsClient,
} from "@caisson/field-crypto";
import {
  KmsKeyProvider,
  PgWrappedKeyStore,
  createAzureKeyVaultKmsClient,
  withKmsFieldCryptoContext,
} from "@caisson/field-crypto";
import { ConfigError, InternalError, strictObject } from "@caisson/kernel";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { createHash } from "node:crypto";
import { z } from "zod";

interface SiteTokenCredential {
  getToken(scopes: string | string[]): Promise<{
    readonly token: string;
    readonly expiresOnTimestamp: number;
  } | null>;
}

interface SiteAzureKey {
  readonly id?: string;
  readonly properties: {
    readonly recoveryLevel?: string;
  };
}

export interface SiteAzureKeyClient {
  getKey(keyName: string): Promise<SiteAzureKey>;
  createRsaKey(
    keyName: string,
    options: {
      readonly keySize: number;
      readonly keyOps: readonly ["wrapKey", "unwrapKey"];
    },
  ): Promise<SiteAzureKey>;
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

export interface SiteAzureKmsDependencies {
  createCredential(
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): SiteTokenCredential;
  createKeyClient(
    vaultUrl: string,
    credential: SiteTokenCredential,
  ): SiteAzureKeyClient;
  createCryptographyClient(
    keyId: string,
    credential: SiteTokenCredential,
  ): AzureKeyVaultCryptographyClient;
}

const azureKmsEnvironmentSchema = strictObject({
  AZURE_KEY_VAULT_URL: z
    .string()
    .trim()
    .url()
    .refine((value) => new URL(value).protocol === "https:", {
      message: "Azure Key Vault URL must use https",
    }),
  AZURE_KEY_VAULT_KEY_NAME: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[0-9A-Za-z-]+$/),
  AZURE_KEY_VAULT_WRAP_ALGORITHM: z.literal("RSA-OAEP-256"),
  AZURE_KEY_VAULT_PURGE_PROTECTION: z.literal("enabled"),
  AZURE_TENANT_ID: z.string().trim().min(1).max(128),
  AZURE_CLIENT_ID: z.string().trim().min(1).max(128),
  AZURE_CLIENT_SECRET: z.string().min(1).max(4096),
});

type SiteAzureKmsEnvironment = z.infer<typeof azureKmsEnvironmentSchema>;

const defaultDependencies: SiteAzureKmsDependencies = {
  createCredential(tenantId, clientId, clientSecret) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  },
  createKeyClient(vaultUrl, credential) {
    const client = new KeyClient(vaultUrl, credential);
    return {
      getKey: (keyName) => client.getKey(keyName),
      createRsaKey: (keyName, options) =>
        client.createRsaKey(keyName, {
          keySize: options.keySize,
          keyOps: [...options.keyOps],
        }),
      beginDeleteKey: (keyName) => client.beginDeleteKey(keyName),
      purgeDeletedKey: (keyName) => client.purgeDeletedKey(keyName),
    };
  },
  createCryptographyClient(keyId, credential) {
    const client = new CryptographyClient(keyId, credential);
    return {
      wrapKey: (algorithm, key) => client.wrapKey(algorithm, key),
      unwrapKey: (algorithm, encryptedKey) =>
        client.unwrapKey(algorithm, encryptedKey),
    };
  },
};

function parseEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): SiteAzureKmsEnvironment {
  if (source.AZURE_KEY_VAULT_PURGE_PROTECTION !== "enabled") {
    throw new ConfigError(
      "site field-crypto: Azure Key Vault purge protection must be enabled",
    );
  }
  if (
    source.AZURE_TENANT_ID === undefined ||
    source.AZURE_CLIENT_ID === undefined ||
    source.AZURE_CLIENT_SECRET === undefined
  ) {
    throw new ConfigError(
      "site field-crypto: explicit Azure service authentication is required",
    );
  }
  const parsed = azureKmsEnvironmentSchema.safeParse({
    AZURE_KEY_VAULT_URL: source.AZURE_KEY_VAULT_URL,
    AZURE_KEY_VAULT_KEY_NAME: source.AZURE_KEY_VAULT_KEY_NAME,
    AZURE_KEY_VAULT_WRAP_ALGORITHM: source.AZURE_KEY_VAULT_WRAP_ALGORITHM,
    AZURE_KEY_VAULT_PURGE_PROTECTION: source.AZURE_KEY_VAULT_PURGE_PROTECTION,
    AZURE_TENANT_ID: source.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: source.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: source.AZURE_CLIENT_SECRET,
  });
  if (!parsed.success) {
    const keys = [
      ...new Set(
        parsed.error.issues.map((issue) => String(issue.path[0] ?? "unknown")),
      ),
    ].sort();
    const messages = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new ConfigError(
      `site field-crypto: invalid Azure KMS configuration: ${keys.join(", ")} (${messages})`,
    );
  }
  return parsed.data;
}

export function siteAzureKeyName(prefix: string, scope: string): string {
  if (scope.length === 0) {
    throw new InternalError(
      "site field-crypto: cannot derive an Azure key name for an empty scope",
    );
  }
  const digest = createHash("sha256").update(scope).digest("hex").slice(0, 32);
  return `${prefix}-${digest}`;
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (
    Reflect.get(error, "statusCode") === 404 ||
    Reflect.get(error, "code") === "KeyNotFound"
  );
}

function assertPurgeProtected(
  key: SiteAzureKey,
): SiteAzureKey & { readonly id: string } {
  const recoveryLevel = key.properties.recoveryLevel;
  if (recoveryLevel === undefined || recoveryLevel.includes("Purgeable")) {
    throw new ConfigError(
      "site field-crypto: Azure Key Vault key does not prove purge protection",
    );
  }
  if (key.id === undefined || key.id.length === 0) {
    throw new InternalError(
      "site field-crypto: Azure Key Vault returned a key without an id",
    );
  }
  return { ...key, id: key.id };
}

export function createSiteAzureKmsClient(
  source: Readonly<Record<string, string | undefined>>,
  dependencies: SiteAzureKmsDependencies = defaultDependencies,
): KmsClient {
  const config = parseEnvironment(source);
  const credential = dependencies.createCredential(
    config.AZURE_TENANT_ID,
    config.AZURE_CLIENT_ID,
    config.AZURE_CLIENT_SECRET,
  );
  const keyClient = dependencies.createKeyClient(
    config.AZURE_KEY_VAULT_URL,
    credential,
  );

  const getProtectedKey = async (
    keyName: string,
  ): Promise<SiteAzureKey & { readonly id: string }> =>
    assertPurgeProtected(await keyClient.getKey(keyName));

  const getOrCreateProtectedKey = async (
    keyName: string,
  ): Promise<SiteAzureKey & { readonly id: string }> => {
    try {
      return await getProtectedKey(keyName);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    return assertPurgeProtected(
      await keyClient.createRsaKey(keyName, {
        keySize: 2048,
        keyOps: ["wrapKey", "unwrapKey"],
      }),
    );
  };

  return createAzureKeyVaultKmsClient({
    keyName: config.AZURE_KEY_VAULT_KEY_NAME,
    purgeProtectionEnabled: true,
    wrapAlgorithm:
      config.AZURE_KEY_VAULT_WRAP_ALGORITHM satisfies KeyWrapAlgorithm,
    scopeKeyName: (scope) =>
      siteAzureKeyName(config.AZURE_KEY_VAULT_KEY_NAME, scope),
    client: {
      beginDeleteKey: async (keyName) => {
        await getProtectedKey(keyName);
        return keyClient.beginDeleteKey(keyName);
      },
      async purgeDeletedKey() {
        throw new ConfigError(
          "site field-crypto: direct Azure key purge is disabled by policy",
        );
      },
    },
    cryptographyClient: (keyName) => ({
      async wrapKey(algorithm, key) {
        const protectedKey = await getOrCreateProtectedKey(keyName);
        return dependencies
          .createCryptographyClient(protectedKey.id, credential)
          .wrapKey(algorithm, key);
      },
      async unwrapKey(algorithm, encryptedKey) {
        const protectedKey = await getProtectedKey(keyName);
        return dependencies
          .createCryptographyClient(protectedKey.id, credential)
          .unwrapKey(algorithm, encryptedKey);
      },
    }),
  });
}

interface SiteAzureKmsGlobal {
  caissonSiteAzureKmsClient?: KmsClient;
}

const globalKms = globalThis as unknown as SiteAzureKmsGlobal;

/** HMR-safe Azure client singleton. It holds SDK clients only; plaintext DEKs remain request-local. */
export function getSiteAzureKmsClient(): KmsClient {
  if (globalKms.caissonSiteAzureKmsClient !== undefined) {
    return globalKms.caissonSiteAzureKmsClient;
  }
  globalKms.caissonSiteAzureKmsClient = createSiteAzureKmsClient(process.env);
  return globalKms.caissonSiteAzureKmsClient;
}

/**
 * Bind a production tenant transaction to its KMS provider.
 *
 * The transaction-scoped advisory lock serializes first provisioning for one tenant, preventing
 * Azure from creating two KEK versions while the append-only wrapped-DEK store elects one winner.
 * Every unwrapped DEK is held only by `withKmsFieldCryptoContext` and zeroized before this returns.
 */
export async function withSiteKmsFieldCryptoContext<T>(
  tx: TenantExecutor,
  accountId: string,
  fn: (ctx: FieldCryptoContext) => Promise<T>,
  kms: KmsClient = getSiteAzureKmsClient(),
): Promise<T> {
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
    "caisson:field-crypto",
    accountId,
  ]);
  const provider = new KmsKeyProvider(kms, new PgWrappedKeyStore(tx));
  await provider.ensureProvisioned(accountId);
  return withKmsFieldCryptoContext(provider, accountId, fn);
}
