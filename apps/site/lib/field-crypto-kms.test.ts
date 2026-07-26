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
  type SiteAzureKeyClient,
  type SiteAzureKmsDependencies,
} from "./field-crypto-kms.ts";
import { getDb, withTenant } from "./db.ts";

const ENV = {
  AZURE_KEY_VAULT_URL: "https://caisson-test.vault.azure.net",
  AZURE_KEY_VAULT_KEY_NAME: "caisson-field",
  AZURE_KEY_VAULT_WRAP_ALGORITHM: "RSA-OAEP-256",
  AZURE_KEY_VAULT_PURGE_PROTECTION: "enabled",
  AZURE_TENANT_ID: "tenant-id",
  AZURE_CLIENT_ID: "client-id",
  AZURE_CLIENT_SECRET: "client-secret",
};

beforeAll(() => {
  delete process.env.DATABASE_URL;
  const globalDb = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: unknown;
  };
  globalDb.caissonTransactor = undefined;
  globalDb.caissonPglite = undefined;
});

afterAll(async () => {
  const globalDb = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: { close(): Promise<void> };
  };
  await globalDb.caissonPglite?.close();
  globalDb.caissonTransactor = undefined;
  globalDb.caissonPglite = undefined;
});

function fakeRuntime(recoveryLevel = "Recoverable"): {
  readonly deps: SiteAzureKmsDependencies;
  readonly seen: string[];
} {
  const seen: string[] = [];
  const keys = new Map<string, { id: string; recoveryLevel: string }>();
  const client: SiteAzureKeyClient = {
    async getKey(keyName) {
      seen.push(`get:${keyName}`);
      const key = keys.get(keyName);
      if (key === undefined) throw { statusCode: 404 };
      return { id: key.id, properties: { recoveryLevel: key.recoveryLevel } };
    },
    async createRsaKey(keyName) {
      seen.push(`create:${keyName}`);
      const key = {
        id: `${ENV.AZURE_KEY_VAULT_URL}/keys/${keyName}/version-1`,
        recoveryLevel,
      };
      keys.set(keyName, key);
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
    createCredential(tenantId, clientId, clientSecret) {
      seen.push(`credential:${tenantId}:${clientId}:${clientSecret.length}`);
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
        async wrapKey(_algorithm, key) {
          const value = Buffer.from(key);
          wrapped.set(keyId, value);
          return { result: Buffer.from([0xaa, ...value]) };
        },
        async unwrapKey(_algorithm, encryptedKey) {
          const value = Buffer.from(encryptedKey).subarray(1);
          expect(wrapped.get(keyId)?.equals(value)).toBe(true);
          return { result: value };
        },
      };
    },
  };
  return { deps, seen };
}

describe("site Azure KMS production runtime", () => {
  test("requires HTTPS, the fixed wrap algorithm, purge protection, and service auth", () => {
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
    expect(() =>
      createSiteAzureKmsClient(
        { ...ENV, AZURE_CLIENT_SECRET: undefined },
        deps,
      ),
    ).toThrow(/service authentication/i);
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
    expect(seen).toContain("credential:tenant-id:client-id:13");
  });

  test("rejects a purgeable Azure key before wrapping any DEK", async () => {
    const { deps } = fakeRuntime("Recoverable+Purgeable");
    const kms = createSiteAzureKmsClient(ENV, deps);

    await expect(kms.generateDataKey("acct-a")).rejects.toThrow(
      /purge protection/i,
    );
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
});
