import { ClientSecretCredential } from "@azure/identity";
import {
  CryptographyClient,
  KeyClient,
  KnownDeletionRecoveryLevel,
  type KeyWrapAlgorithm,
} from "@azure/keyvault-keys";
import type {
  AzureKeyVaultCryptographyClient,
  FieldCryptoContext,
  KmsClient,
  KmsOperationOptions,
} from "@caisson/field-crypto";
import {
  KmsKeyProvider,
  PgWrappedKeyStore,
  createAzureKeyVaultKmsClient,
  withKmsFieldCryptoContext,
} from "@caisson/field-crypto";
import { ConfigError, InternalError, strictObject } from "@caisson/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";
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
  getKey(
    keyName: string,
    options?: KmsOperationOptions & { readonly keyVersion?: string },
  ): Promise<SiteAzureKey>;
  createRsaKey(
    keyName: string,
    options: {
      readonly keySize: number;
      readonly keyOps: readonly ["wrapKey", "unwrapKey"];
    },
    operationOptions?: KmsOperationOptions,
  ): Promise<SiteAzureKey>;
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

/**
 * The explicit service-principal credential the deploy contract promises (`apps/site/railway.toml`,
 * `docs/ops/launch-runbook.md`). Deliberately NOT `DefaultAzureCredential`: that is a probing chain,
 * so a missing or misspelled variable falls through to workload identity, then to a managed-identity
 * IMDS probe, then to the `az`/`pwsh`/`azd` CLIs — turning a config typo into a multi-second stall
 * held under the per-account advisory lock, and, worse, authenticating as whatever ambient identity
 * the host happens to offer rather than the principal the operator configured. On a per-tenant KEK
 * that is an authorization boundary decided by the environment. Explicit construction fails closed
 * at client-construction time instead.
 */
export interface SiteAzureKmsServicePrincipal {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface SiteAzureKmsDependencies {
  createCredential(
    servicePrincipal: SiteAzureKmsServicePrincipal,
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
  // Required, not optional: these three are what make the credential explicit. Absent them the
  // runtime would silently fall back to an ambient identity — see SiteAzureKmsDependencies.
  AZURE_TENANT_ID: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[0-9A-Za-z.-]+$/),
  AZURE_CLIENT_ID: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[0-9A-Za-z.-]+$/),
  // Bounded but unpatterned and un-trimmed: a client secret is opaque and may legitimately carry
  // edge whitespace, and its parse errors must never echo it. A whitespace-ONLY value is still
  // rejected here rather than deferred to a vague AAD failure at first token acquisition.
  AZURE_CLIENT_SECRET: z
    .string()
    .min(1)
    .max(512)
    .refine((value) => value.trim().length > 0, {
      message: "must not be blank",
    }),
});

type SiteAzureKmsEnvironment = z.infer<typeof azureKmsEnvironmentSchema>;

const defaultDependencies: SiteAzureKmsDependencies = {
  createCredential(servicePrincipal) {
    return new ClientSecretCredential(
      servicePrincipal.tenantId,
      servicePrincipal.clientId,
      servicePrincipal.clientSecret,
    );
  },
  createKeyClient(vaultUrl, credential) {
    const client = new KeyClient(vaultUrl, credential);
    const sdkOptions = (
      options?: KmsOperationOptions,
    ): {
      readonly abortSignal?: AbortSignal;
      readonly requestOptions?: { readonly timeout: number };
    } => ({
      ...(options?.abortSignal === undefined
        ? {}
        : { abortSignal: options.abortSignal }),
      ...(options?.timeoutMs === undefined
        ? {}
        : { requestOptions: { timeout: options.timeoutMs } }),
    });
    return {
      getKey: (keyName, options) =>
        client.getKey(keyName, {
          ...sdkOptions(options),
          ...(options?.keyVersion === undefined
            ? {}
            : { version: options.keyVersion }),
        }),
      createRsaKey: (keyName, options, operationOptions) =>
        client.createRsaKey(keyName, {
          keySize: options.keySize,
          keyOps: [...options.keyOps],
          ...sdkOptions(operationOptions),
        }),
      beginDeleteKey: (keyName, options) =>
        client.beginDeleteKey(keyName, sdkOptions(options)),
      purgeDeletedKey: (keyName, options) =>
        client.purgeDeletedKey(keyName, sdkOptions(options)),
    };
  },
  createCryptographyClient(keyId, credential) {
    const client = new CryptographyClient(keyId, credential);
    return {
      wrapKey: (algorithm, key, options) =>
        client.wrapKey(algorithm, key, {
          ...(options?.abortSignal === undefined
            ? {}
            : { abortSignal: options.abortSignal }),
          ...(options?.timeoutMs === undefined
            ? {}
            : { requestOptions: { timeout: options.timeoutMs } }),
        }),
      unwrapKey: (algorithm, encryptedKey, options) =>
        client.unwrapKey(algorithm, encryptedKey, {
          ...(options?.abortSignal === undefined
            ? {}
            : { abortSignal: options.abortSignal }),
          ...(options?.timeoutMs === undefined
            ? {}
            : { requestOptions: { timeout: options.timeoutMs } }),
        }),
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

const PURGE_PROTECTED_RECOVERY_LEVELS = new Set<string>([
  KnownDeletionRecoveryLevel.Recoverable,
  KnownDeletionRecoveryLevel.CustomizedRecoverable,
  KnownDeletionRecoveryLevel.RecoverableProtectedSubscription,
  KnownDeletionRecoveryLevel.CustomizedRecoverableProtectedSubscription,
]);

function assertExpectedKeyId(
  keyId: string,
  vaultUrl: string,
  expectedKeyName: string,
  expectedKeyVersion?: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(keyId);
  } catch {
    throw new ConfigError(
      "site field-crypto: Azure Key Vault returned an invalid key id",
    );
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== new URL(vaultUrl).origin ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    segments.length !== 3 ||
    segments[0] !== "keys" ||
    segments[1] !== expectedKeyName ||
    !/^[0-9A-Za-z-]{1,127}$/.test(segments[2] ?? "") ||
    (expectedKeyVersion !== undefined && segments[2] !== expectedKeyVersion)
  ) {
    throw new ConfigError(
      "site field-crypto: Azure Key Vault returned a key id outside the expected vault and key scope",
    );
  }
}

function assertPurgeProtected(
  key: SiteAzureKey,
  vaultUrl: string,
  expectedKeyName: string,
  expectedKeyVersion?: string,
): SiteAzureKey & { readonly id: string } {
  const recoveryLevel = key.properties.recoveryLevel;
  if (
    recoveryLevel === undefined ||
    !PURGE_PROTECTED_RECOVERY_LEVELS.has(recoveryLevel)
  ) {
    throw new ConfigError(
      "site field-crypto: Azure Key Vault key does not prove purge protection",
    );
  }
  if (key.id === undefined || key.id.length === 0) {
    throw new InternalError(
      "site field-crypto: Azure Key Vault returned a key without an id",
    );
  }
  assertExpectedKeyId(key.id, vaultUrl, expectedKeyName, expectedKeyVersion);
  return { ...key, id: key.id };
}

export function createSiteAzureKmsClient(
  source: Readonly<Record<string, string | undefined>>,
  dependencies: SiteAzureKmsDependencies = defaultDependencies,
): KmsClient {
  const config = parseEnvironment(source);
  const credential = dependencies.createCredential({
    tenantId: config.AZURE_TENANT_ID,
    clientId: config.AZURE_CLIENT_ID,
    clientSecret: config.AZURE_CLIENT_SECRET,
  });
  const keyClient = dependencies.createKeyClient(
    config.AZURE_KEY_VAULT_URL,
    credential,
  );

  const getProtectedKey = async (
    keyName: string,
    keyVersion?: string,
    operationOptions?: KmsOperationOptions,
  ): Promise<SiteAzureKey & { readonly id: string }> =>
    assertPurgeProtected(
      await keyClient.getKey(keyName, {
        ...(keyVersion === undefined ? {} : { keyVersion }),
        ...(operationOptions?.abortSignal === undefined
          ? {}
          : { abortSignal: operationOptions.abortSignal }),
        ...(operationOptions?.timeoutMs === undefined
          ? {}
          : { timeoutMs: operationOptions.timeoutMs }),
      }),
      config.AZURE_KEY_VAULT_URL,
      keyName,
      keyVersion,
    );

  const getOrCreateProtectedKey = async (
    keyName: string,
    operationOptions?: KmsOperationOptions,
  ): Promise<SiteAzureKey & { readonly id: string }> => {
    try {
      return await getProtectedKey(keyName, undefined, operationOptions);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    return assertPurgeProtected(
      await keyClient.createRsaKey(
        keyName,
        {
          keySize: 2048,
          keyOps: ["wrapKey", "unwrapKey"],
        },
        operationOptions,
      ),
      config.AZURE_KEY_VAULT_URL,
      keyName,
    );
  };

  return createAzureKeyVaultKmsClient({
    keyName: config.AZURE_KEY_VAULT_KEY_NAME,
    expectedVaultUrl: config.AZURE_KEY_VAULT_URL,
    purgeProtectionEnabled: true,
    wrapAlgorithm:
      config.AZURE_KEY_VAULT_WRAP_ALGORITHM satisfies KeyWrapAlgorithm,
    scopeKeyName: (scope) =>
      siteAzureKeyName(config.AZURE_KEY_VAULT_KEY_NAME, scope),
    client: {
      beginDeleteKey: async (keyName, options) => {
        await getProtectedKey(keyName, undefined, options);
        return keyClient.beginDeleteKey(keyName, options);
      },
      async purgeDeletedKey() {
        throw new ConfigError(
          "site field-crypto: direct Azure key purge is disabled by policy",
        );
      },
    },
    cryptographyClient: (keyName, keyVersion) => ({
      async wrapKey(algorithm, key, options) {
        const protectedKey = await getOrCreateProtectedKey(keyName, options);
        return dependencies
          .createCryptographyClient(protectedKey.id, credential)
          .wrapKey(algorithm, key, options);
      },
      async unwrapKey(algorithm, encryptedKey, options) {
        const protectedKey = await getProtectedKey(
          keyName,
          keyVersion,
          options,
        );
        return dependencies
          .createCryptographyClient(protectedKey.id, credential)
          .unwrapKey(algorithm, encryptedKey, options);
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

/** One overall Azure KMS deadline per tenant request, including SDK retries and credential work. */
export const SITE_KMS_REQUEST_TIMEOUT_MS = 15_000;

function siteKmsDeadlineError(timeoutMs: number): InternalError {
  return new InternalError(
    `site field-crypto: Azure KMS request exceeded ${String(timeoutMs)}ms`,
  );
}

function throwIfSiteKmsAborted(signal: AbortSignal, timeoutMs: number): void {
  if (!signal.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : siteKmsDeadlineError(timeoutMs);
}

async function waitForSiteKmsLockRetry(
  signal: AbortSignal,
  waitMs: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, waitMs);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
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
  fn: (ctx: FieldCryptoContext, tx: TenantExecutor) => Promise<T>,
  kms: KmsClient = getSiteAzureKmsClient(),
  timeoutMs: number = SITE_KMS_REQUEST_TIMEOUT_MS,
  // ADR-0392 decision 2 tells the operator to raise this "with evidence the request budget still
  // holds". Without a pass-through that instruction is unfollowable: a tenant over the default cap
  // is refused on reads AND writes, and the only remedy would be a code change plus a redeploy.
  maxPrefetchVersions?: number,
): Promise<T> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new ConfigError(
      "site field-crypto: KMS request timeout must be a positive integer",
    );
  }
  const deadlineAt = performance.now() + timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(siteKmsDeadlineError(timeoutMs));
  }, timeoutMs);
  const remainingMs = (): number => {
    throwIfSiteKmsAborted(controller.signal, timeoutMs);
    const remaining = Math.floor(deadlineAt - performance.now());
    if (remaining < 1) {
      controller.abort(siteKmsDeadlineError(timeoutMs));
      throw siteKmsDeadlineError(timeoutMs);
    }
    return remaining;
  };
  const configureDatabaseBudget = async (): Promise<void> => {
    const timeout = `${String(remainingMs())}ms`;
    await tx.query(
      `SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $1, true)`,
      [timeout],
    );
    throwIfSiteKmsAborted(controller.signal, timeoutMs);
  };
  const budgetedTx: TenantExecutor = {
    async query<R = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<{ rows: R[] }> {
      await configureDatabaseBudget();
      const result = await tx.query<R>(sql, params);
      throwIfSiteKmsAborted(controller.signal, timeoutMs);
      return result;
    },
    async exec(sql: string): Promise<unknown> {
      await configureDatabaseBudget();
      const result = await tx.exec(sql);
      throwIfSiteKmsAborted(controller.signal, timeoutMs);
      return result;
    },
  };
  try {
    for (;;) {
      await configureDatabaseBudget();
      const lock = await tx.query<{ acquired: boolean }>(
        `SELECT pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) AS acquired`,
        ["caisson:field-crypto", accountId],
      );
      throwIfSiteKmsAborted(controller.signal, timeoutMs);
      if (lock.rows[0]?.acquired === true) break;
      await waitForSiteKmsLockRetry(
        controller.signal,
        Math.min(5, remainingMs()),
      );
    }
    const provider = new KmsKeyProvider(
      kms,
      new PgWrappedKeyStore(budgetedTx),
      {
        abortSignal: controller.signal,
      },
    );
    await provider.ensureProvisioned(accountId);
    return await withKmsFieldCryptoContext(
      provider,
      accountId,
      (ctx) => fn(ctx, budgetedTx),
      {
        abortSignal: controller.signal,
        ...(maxPrefetchVersions === undefined ? {} : { maxPrefetchVersions }),
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open the tenant transaction and bind its KMS context as one atomic unit. Runners persisting both
 * wrapped keys and encrypted application state should use this seam so no nested tenant transaction
 * can commit one side without the other.
 */
export function withSiteKmsFieldCryptoTransaction<T>(
  db: Transactor,
  accountId: string,
  fn: (tx: TenantExecutor, ctx: FieldCryptoContext) => Promise<T>,
  kms: KmsClient = getSiteAzureKmsClient(),
  timeoutMs: number = SITE_KMS_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return withTenant(db, accountId, (tx) =>
    withSiteKmsFieldCryptoContext(
      tx,
      accountId,
      (ctx, budgetedTx) => fn(budgetedTx, ctx),
      kms,
      timeoutMs,
    ),
  );
}
