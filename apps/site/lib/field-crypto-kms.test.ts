import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  AzureKeyVaultCryptographyClient,
  KmsClient,
} from "@caisson/field-crypto";
import {
  KmsKeyProvider,
  PgWrappedKeyStore,
  openField,
  sealField,
} from "@caisson/field-crypto";
import {
  createSiteAzureKmsClient,
  siteAzureKeyName,
  withSiteKmsFieldCryptoContext,
  withSiteKmsFieldCryptoTransaction,
  type SiteAzureKeyClient,
  type SiteAzureKmsDependencies,
} from "./field-crypto-kms.ts";
import { getDb, withTenant } from "./db.ts";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";

const ENV = {
  AZURE_KEY_VAULT_URL: "https://caisson-test.vault.azure.net",
  AZURE_KEY_VAULT_KEY_NAME: "caisson-field",
  AZURE_KEY_VAULT_WRAP_ALGORITHM: "RSA-OAEP-256",
  AZURE_KEY_VAULT_PURGE_PROTECTION: "enabled",
  AZURE_TENANT_ID: "tenant-id",
  AZURE_CLIENT_ID: "client-id",
  AZURE_CLIENT_SECRET: "client-secret",
};

const globalDb = globalThis as unknown as {
  caissonTransactor?: unknown;
  caissonPglite?: { close(): Promise<void> };
};
let hadDatabaseUrl: boolean;
let priorDatabaseUrl: string | undefined;
let hadTransactor: boolean;
let priorTransactor: unknown;
let hadPglite: boolean;
let priorPglite: { close(): Promise<void> } | undefined;

beforeAll(() => {
  hadDatabaseUrl = Object.prototype.hasOwnProperty.call(
    process.env,
    "DATABASE_URL",
  );
  priorDatabaseUrl = process.env.DATABASE_URL;
  hadTransactor = Object.prototype.hasOwnProperty.call(
    globalDb,
    "caissonTransactor",
  );
  priorTransactor = globalDb.caissonTransactor;
  hadPglite = Object.prototype.hasOwnProperty.call(globalDb, "caissonPglite");
  priorPglite = globalDb.caissonPglite;

  delete process.env.DATABASE_URL;
  delete globalDb.caissonTransactor;
  delete globalDb.caissonPglite;
});

afterAll(async () => {
  const testPglite = globalDb.caissonPglite;
  if (testPglite !== undefined && testPglite !== priorPglite) {
    await testPglite.close();
  }

  if (hadDatabaseUrl && priorDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = priorDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
  if (hadTransactor) {
    globalDb.caissonTransactor = priorTransactor;
  } else {
    delete globalDb.caissonTransactor;
  }
  if (hadPglite) {
    globalDb.caissonPglite = priorPglite;
  } else {
    delete globalDb.caissonPglite;
  }
});

function fakeRuntime(recoveryLevel = "Recoverable"): {
  readonly deps: SiteAzureKmsDependencies;
  readonly seen: string[];
} {
  const seen: string[] = [];
  const keys = new Map<string, { id: string; recoveryLevel: string }>();
  const client: SiteAzureKeyClient = {
    async getKey(keyName, options) {
      const lookup = `${keyName}:${options?.keyVersion ?? "latest"}`;
      seen.push(`get:${lookup}`);
      const key = keys.get(lookup) ?? keys.get(`${keyName}:latest`);
      if (key === undefined) throw { statusCode: 404 };
      return { id: key.id, properties: { recoveryLevel: key.recoveryLevel } };
    },
    async createRsaKey(keyName) {
      seen.push(`create:${keyName}`);
      const key = {
        id: `${ENV.AZURE_KEY_VAULT_URL}/keys/${keyName}/version-1`,
        recoveryLevel,
      };
      keys.set(`${keyName}:version-1`, key);
      keys.set(`${keyName}:latest`, key);
      return { id: key.id, properties: { recoveryLevel } };
    },
    async beginDeleteKey(keyName) {
      seen.push(`delete:${keyName}`);
      return {
        async pollUntilDone() {
          return {
            properties: {
              recoveryLevel,
              scheduledPurgeDate: new Date("2026-09-01T00:00:00.000Z"),
            },
          };
        },
      };
    },
    async purgeDeletedKey(keyName) {
      seen.push(`purge:${keyName}`);
    },
  };
  const wrapped = new Map<string, Buffer>();
  const deps: SiteAzureKmsDependencies = {
    createCredential(servicePrincipal) {
      seen.push(
        `credential:explicit:${servicePrincipal.tenantId}:${servicePrincipal.clientId}`,
      );
      return {
        async getToken() {
          return {
            token: "test-token",
            expiresOnTimestamp: Date.now() + 60_000,
          };
        },
      };
    },
    createKeyClient(vaultUrl) {
      seen.push(`key-client:${vaultUrl}`);
      return client;
    },
    createCryptographyClient(keyId): AzureKeyVaultCryptographyClient {
      return {
        async wrapKey(algorithm, key) {
          const value = Buffer.from(key);
          wrapped.set(keyId, value);
          return {
            result: Buffer.from([0xaa, ...value]),
            keyID: keyId,
            algorithm,
          };
        },
        async unwrapKey(algorithm, encryptedKey) {
          const value = Buffer.from(encryptedKey).subarray(1);
          expect(wrapped.get(keyId)?.equals(value)).toBe(true);
          return { result: value, keyID: keyId, algorithm };
        },
      };
    },
  };
  return { deps, seen };
}

describe("site Azure KMS production runtime", () => {
  test("requires HTTPS, the fixed wrap algorithm, purge protection, and an explicit service principal", () => {
    const { deps } = fakeRuntime();
    expect(() =>
      createSiteAzureKmsClient(
        { ...ENV, AZURE_KEY_VAULT_URL: "http://vault.invalid" },
        deps,
      ),
    ).toThrow(/https/i);
    expect(() =>
      createSiteAzureKmsClient(
        { ...ENV, AZURE_KEY_VAULT_WRAP_ALGORITHM: "RSA1_5" },
        deps,
      ),
    ).toThrow();
    expect(() =>
      createSiteAzureKmsClient(
        { ...ENV, AZURE_KEY_VAULT_PURGE_PROTECTION: "disabled" },
        deps,
      ),
    ).toThrow(/purge protection/i);
    // Each service-principal variable is REQUIRED. These previously parsed clean and the runtime
    // fell through DefaultAzureCredential's probing chain to an ambient identity; a missing or
    // misspelled variable must now fail closed at client construction.
    for (const missing of [
      "AZURE_TENANT_ID",
      "AZURE_CLIENT_ID",
      "AZURE_CLIENT_SECRET",
    ] as const) {
      expect(() =>
        createSiteAzureKmsClient({ ...ENV, [missing]: undefined }, deps),
      ).toThrow(new RegExp(missing));
    }
  });

  test("builds the credential from the configured service principal, never an ambient identity", () => {
    const { deps, seen } = fakeRuntime();
    createSiteAzureKmsClient(ENV, deps);
    expect(seen).toContain("credential:explicit:tenant-id:client-id");

    // A parse failure must name the variable but never echo the secret value itself.
    let message = "";
    try {
      createSiteAzureKmsClient({ ...ENV, AZURE_CLIENT_ID: "" }, deps);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("AZURE_CLIENT_ID");
    expect(message).not.toContain("client-secret");
  });

  test("uses a deterministic per-tenant key and round-trips a wrapped DEK", async () => {
    const { deps, seen } = fakeRuntime();
    const kms: KmsClient = createSiteAzureKmsClient(ENV, deps);
    const expectedKeyName = siteAzureKeyName("caisson-field", "acct-a");

    const generated = await kms.generateDataKey("acct-a");
    expect(
      (await kms.decryptDataKey("acct-a", generated.wrappedKey)).equals(
        generated.plaintextKey,
      ),
    ).toBe(true);
    expect(seen).toContain(`create:${expectedKeyName}`);
    expect(seen).toContain("credential:explicit:tenant-id:client-id");
    expect(seen).toContain(`get:${expectedKeyName}:version-1`);
  });

  test("rejects a purgeable Azure key before wrapping any DEK", async () => {
    const { deps } = fakeRuntime("Recoverable+Purgeable");
    const kms = createSiteAzureKmsClient(ENV, deps);

    await expect(kms.generateDataKey("acct-a")).rejects.toThrow(
      /purge protection/i,
    );
  });

  for (const recoveryLevel of [
    "Recoverable+ProtectedSubscription",
    "CustomizedRecoverable+ProtectedSubscription",
  ]) {
    test(`accepts Azure's purge-protected ${recoveryLevel} recovery level`, async () => {
      const { deps } = fakeRuntime(recoveryLevel);
      const kms = createSiteAzureKmsClient(ENV, deps);

      const generated = await kms.generateDataKey("acct-a");
      expect(generated.plaintextKey).toHaveLength(32);
      generated.plaintextKey.fill(0);
    });
  }

  test("rejects an unknown Azure recovery level instead of inferring purge protection", async () => {
    const { deps } = fakeRuntime("Unknown");
    const kms = createSiteAzureKmsClient(ENV, deps);

    await expect(kms.generateDataKey("acct-a")).rejects.toThrow(
      /purge protection/i,
    );
  });

  test("rejects an unexpected Azure vault authority before creating a credentialed crypto client", async () => {
    let cryptographyClients = 0;
    const deps: SiteAzureKmsDependencies = {
      createCredential() {
        return {
          async getToken() {
            return {
              token: "test-token",
              expiresOnTimestamp: Date.now() + 60_000,
            };
          },
        };
      },
      createKeyClient() {
        return {
          async getKey(keyName) {
            return {
              id: `https://unexpected.example/keys/${keyName}/version-1`,
              properties: { recoveryLevel: "Recoverable" },
            };
          },
          async createRsaKey() {
            throw new Error("not used");
          },
          async beginDeleteKey() {
            throw new Error("not used");
          },
          async purgeDeletedKey() {
            throw new Error("not used");
          },
        };
      },
      createCryptographyClient() {
        cryptographyClients += 1;
        throw new Error("credentialed crypto client must not be created");
      },
    };
    const kms = createSiteAzureKmsClient(ENV, deps);

    await expect(kms.generateDataKey("acct-a")).rejects.toThrow(
      /expected vault/i,
    );
    expect(cryptographyClients).toBe(0);
  });
});

function requestKms(): {
  readonly client: KmsClient;
  readonly unwrapped: Buffer[];
  readonly calls: string[];
} {
  let version = 0;
  const unwrapped: Buffer[] = [];
  const calls: string[] = [];
  return {
    unwrapped,
    calls,
    client: {
      async generateDataKey(scope) {
        version += 1;
        calls.push(`generate:${scope}:${String(version)}`);
        return {
          plaintextKey: Buffer.alloc(32, version),
          wrappedKey: Buffer.from([version]),
        };
      },
      async decryptDataKey(scope, wrappedKey) {
        calls.push(`unwrap:${scope}:${String(wrappedKey[0])}`);
        const key = Buffer.alloc(32, wrappedKey[0]);
        unwrapped.push(key);
        return key;
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    },
  };
}

describe("site KMS request context", () => {
  test("validates and starts the database lock budget before advisory-lock acquisition", async () => {
    const invalidQueries: string[] = [];
    const invalidTx: TenantExecutor = {
      async query<T>(sql: string): Promise<{ rows: T[] }> {
        invalidQueries.push(sql);
        return { rows: [] };
      },
      async exec() {},
    };
    await expect(
      withSiteKmsFieldCryptoContext(
        invalidTx,
        "acct-invalid-timeout",
        async () => undefined,
        requestKms().client,
        0,
      ),
    ).rejects.toThrow(/positive integer/i);
    expect(invalidQueries).toEqual([]);

    const lockQueries: Array<{
      readonly sql: string;
      readonly params?: unknown[];
    }> = [];
    const lockedTx: TenantExecutor = {
      async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
        lockQueries.push({ sql, params });
        if (sql.includes("pg_try_advisory_xact_lock")) {
          throw new Error("stop after first lock attempt");
        }
        return { rows: [] };
      },
      async exec() {},
    };
    await expect(
      withSiteKmsFieldCryptoContext(
        lockedTx,
        "acct-lock-timeout",
        async () => undefined,
        requestKms().client,
        25,
      ),
    ).rejects.toThrow(/first lock attempt/i);
    expect(lockQueries).toHaveLength(2);
    expect(lockQueries[0]?.sql).toContain("set_config");
    expect(lockQueries[0]?.sql).toContain("statement_timeout");
    expect(lockQueries[0]?.sql).toContain("lock_timeout");
    expect(String(lockQueries[0]?.params?.[0])).toMatch(/^\d+ms$/);
    expect(lockQueries[1]?.sql).toContain("pg_try_advisory_xact_lock");
  });

  test("does not issue an advisory-lock query after deadline setup consumes the budget", async () => {
    const queries: string[] = [];
    const tx: TenantExecutor = {
      async query<T>(sql: string): Promise<{ rows: T[] }> {
        queries.push(sql);
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { rows: [] };
      },
      async exec() {},
    };

    await expect(
      withSiteKmsFieldCryptoContext(
        tx,
        "acct-expired-before-lock",
        async () => undefined,
        requestKms().client,
        5,
      ),
    ).rejects.toThrow(/exceeded 5ms/i);
    expect(queries.some((sql) => sql.includes("pg_advisory_xact_lock"))).toBe(
      false,
    );
  });

  test("uses non-blocking advisory-lock attempts under the remaining statement budget", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const tx: TenantExecutor = {
      async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
        queries.push({ sql, params });
        if (sql.includes("set_config")) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { rows: [] };
        }
        if (sql.includes("pg_try_advisory_xact_lock")) {
          throw new Error("stop after proving query shape");
        }
        return { rows: [] };
      },
      async exec() {},
    };

    await expect(
      withSiteKmsFieldCryptoContext(
        tx,
        "acct-remaining-lock-budget",
        async () => undefined,
        requestKms().client,
        100,
      ),
    ).rejects.toThrow(/proving query shape/);
    const config = queries.findLast(({ sql }) => sql.includes("set_config"));
    const configured = Number.parseInt(
      String(config?.params?.[0]).replace("ms", ""),
      10,
    );
    expect(config?.sql).toContain("statement_timeout");
    expect(config?.sql).toContain("lock_timeout");
    expect(configured).toBeGreaterThan(0);
    expect(configured).toBeLessThan(100);
    expect(
      queries.some(({ sql }) => sql.includes("pg_try_advisory_xact_lock")),
    ).toBe(true);
    expect(
      queries.some(
        ({ sql }) =>
          sql.includes("pg_advisory_xact_lock") &&
          !sql.includes("pg_try_advisory_xact_lock"),
      ),
    ).toBe(false);
  });

  test("provisions on first seal and zeroizes every unwrapped DEK at scope exit", async () => {
    const runtime = requestKms();
    const accountId = "acct-site-kms-first-seal";
    const db = await getDb();
    let envelope = "";

    await withTenant(db, accountId, (tx) =>
      withSiteKmsFieldCryptoContext(
        tx,
        accountId,
        async (ctx) => {
          envelope = sealField(ctx, "byok.api_key", "secret-value");
        },
        runtime.client,
      ),
    );

    expect(runtime.calls).toEqual([
      `generate:${accountId}:1`,
      `unwrap:${accountId}:1`,
    ]);
    expect(envelope.length).toBeGreaterThan(0);
    expect(runtime.unwrapped).toHaveLength(1);
    expect(runtime.unwrapped[0]?.every((byte) => byte === 0)).toBe(true);
  });

  test("binds tenant state and wrapped-key persistence inside one site transaction", async () => {
    const runtime = requestKms();
    const accountId = "acct-site-kms-atomic";
    const platformDb = await getDb();
    let transactionCalls = 0;
    const db: Transactor = {
      transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
        transactionCalls += 1;
        return platformDb.transaction(fn);
      },
    };

    const result = await withSiteKmsFieldCryptoTransaction(
      db,
      accountId,
      async (tx, ctx) => {
        const scoped = await tx.query<{ accountId: string }>(
          `SELECT current_setting('app.current_account') AS "accountId"`,
        );
        return {
          accountId: scoped.rows[0]?.accountId,
          envelope: sealField(ctx, "run.state", "atomic-secret"),
        };
      },
      runtime.client,
    );

    expect(transactionCalls).toBe(1);
    expect(result.accountId).toBe(accountId);
    expect(result.envelope.length).toBeGreaterThan(0);
    expect(runtime.calls).toEqual([
      `generate:${accountId}:1`,
      `unwrap:${accountId}:1`,
    ]);
    expect(runtime.unwrapped[0]?.every((byte) => byte === 0)).toBe(true);
  });

  test("reads a version-1 envelope after the current version advances to 2", async () => {
    const runtime = requestKms();
    const accountId = "acct-site-kms-history";
    const db = await getDb();
    let original = "";

    await withTenant(db, accountId, (tx) =>
      withSiteKmsFieldCryptoContext(
        tx,
        accountId,
        async (ctx) => {
          original = sealField(ctx, "byok.api_key", "historical-secret");
        },
        runtime.client,
      ),
    );
    await withTenant(db, accountId, async (tx) => {
      const provider = new KmsKeyProvider(
        runtime.client,
        new PgWrappedKeyStore(tx),
      );
      expect(await provider.provision(accountId)).toBe(2);
    });

    const opened = await withTenant(db, accountId, (tx) =>
      withSiteKmsFieldCryptoContext(
        tx,
        accountId,
        async (ctx) => openField(ctx, "byok.api_key", original),
        runtime.client,
      ),
    );
    expect(opened).toBe("historical-secret");
    expect(runtime.calls).toContain(`unwrap:${accountId}:1`);
    expect(runtime.calls).toContain(`unwrap:${accountId}:2`);
  });

  test("an unwrap failure rejects before the request callback and never falls back", async () => {
    let callbackCalled = false;
    const client: KmsClient = {
      async generateDataKey() {
        return {
          plaintextKey: Buffer.alloc(32, 0x55),
          wrappedKey: Buffer.from([0x55]),
        };
      },
      async decryptDataKey() {
        throw new Error("vault unavailable");
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const db = await getDb();
    await expect(
      withTenant(db, "acct-site-kms-failure", (tx) =>
        withSiteKmsFieldCryptoContext(
          tx,
          "acct-site-kms-failure",
          async () => {
            callbackCalled = true;
          },
          client,
        ),
      ),
    ).rejects.toThrow("vault unavailable");
    expect(callbackCalled).toBe(false);
  });

  test("a stalled unwrap is aborted by the request deadline and releases the transaction", async () => {
    let callbackCalled = false;
    let observedAbortSignal = false;
    const client: KmsClient = {
      async generateDataKey() {
        return {
          plaintextKey: Buffer.alloc(32, 0x44),
          wrappedKey: Buffer.from([0x44]),
        };
      },
      async decryptDataKey(_scope, _wrappedKey, options) {
        return new Promise<Buffer>((_resolve, reject) => {
          const signal = options?.abortSignal;
          if (signal === undefined) {
            reject(new Error("missing abort signal"));
            return;
          }
          observedAbortSignal = true;
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const db = await getDb();
    const accountId = "acct-site-kms-timeout";

    await expect(
      withTenant(db, accountId, (tx) =>
        withSiteKmsFieldCryptoContext(
          tx,
          accountId,
          async () => {
            callbackCalled = true;
          },
          client,
          10,
        ),
      ),
    ).rejects.toThrow(/exceeded 10ms/);

    expect(callbackCalled).toBe(false);
    expect(observedAbortSignal).toBe(true);
    await expect(
      withTenant(db, accountId, (tx) => tx.query("SELECT 1")),
    ).resolves.toBeDefined();
  });

  test("a late Azure plaintext cannot run the request callback and is zeroized", async () => {
    // Long enough that the driver reliably reaches unwrapKey before the budget trips on this box;
    // the unwrap itself never resolves until the test says so, so the abort still happens first.
    const BUDGET_MS = 250;
    const runtime = fakeRuntime();
    const sdkPlaintext = Buffer.alloc(32, 0x7a);
    let resolveUnwrap!: () => void;
    const lateUnwrap = new Promise<{
      readonly result: Uint8Array;
      readonly keyID: string;
      readonly algorithm: "RSA-OAEP-256";
    }>((resolve) => {
      resolveUnwrap = () =>
        resolve({
          result: sdkPlaintext,
          keyID: `${ENV.AZURE_KEY_VAULT_URL}/keys/${siteAzureKeyName("caisson-field", "acct-site-kms-late")}/version-1`,
          algorithm: "RSA-OAEP-256",
        });
    });
    // The driver must actually ENTER unwrapKey for this test to mean anything: if the budget
    // expires first, `sdkPlaintext` never reaches the driver, and asserting it was zeroized would
    // pass for the wrong reason. Signal entry so the assertion below can require it.
    let enteredUnwrap = false;
    let signalEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve;
    });
    const deps: SiteAzureKmsDependencies = {
      ...runtime.deps,
      createCryptographyClient(keyId) {
        const base = runtime.deps.createCryptographyClient(keyId);
        return {
          wrapKey: base.wrapKey.bind(base),
          async unwrapKey() {
            enteredUnwrap = true;
            signalEntered();
            return lateUnwrap;
          },
        };
      },
    };
    const kms = createSiteAzureKmsClient(ENV, deps);
    const db = await getDb();
    const accountId = "acct-site-kms-late";
    let callbackCalled = false;

    await expect(
      withTenant(db, accountId, (tx) =>
        withSiteKmsFieldCryptoContext(
          tx,
          accountId,
          async () => {
            callbackCalled = true;
          },
          kms,
          BUDGET_MS,
        ),
      ),
    ).rejects.toThrow(new RegExp(`exceeded ${String(BUDGET_MS)}ms`, "i"));
    expect(callbackCalled).toBe(false);
    // Bounded rather than a bare await: on a loaded worker the budget can elapse before the driver
    // reaches unwrapKey, and that must fail on the assertion below rather than hang until the
    // global runner timeout.
    await Promise.race([
      entered,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    expect(enteredUnwrap).toBe(true);

    resolveUnwrap();
    await lateUnwrap;
    // The driver's `finally { result.result.fill(0) }` sits behind the site wrapper's own async
    // unwrapKey, so it lands an indeterminate number of continuation hops later. Poll to a bounded
    // deadline rather than betting the assertion on a single macrotask.
    const deadline = Date.now() + 2_000;
    while (!sdkPlaintext.equals(Buffer.alloc(32)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(callbackCalled).toBe(false);
    expect(sdkPlaintext.equals(Buffer.alloc(32))).toBe(true);
  });
});
