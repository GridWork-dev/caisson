import { describe, expect, test } from "bun:test";
import type {
  AzureKeyVaultCryptographyClient,
  KmsClient,
} from "@caisson/field-crypto";
import {
  createSiteAzureKmsClient,
  siteAzureKeyName,
  type SiteAzureKeyClient,
  type SiteAzureKmsDependencies,
} from "./field-crypto-kms.ts";

const ENV = {
  AZURE_KEY_VAULT_URL: "https://caisson-test.vault.azure.net",
  AZURE_KEY_VAULT_KEY_NAME: "caisson-field",
  AZURE_KEY_VAULT_WRAP_ALGORITHM: "RSA-OAEP-256",
  AZURE_KEY_VAULT_PURGE_PROTECTION: "enabled",
  AZURE_TENANT_ID: "tenant-id",
  AZURE_CLIENT_ID: "client-id",
  AZURE_CLIENT_SECRET: "client-secret",
};

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
