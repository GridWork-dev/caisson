import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import {
  createAzureKeyVaultKmsClient,
  type AzureKeyVaultClient,
  type AzureKeyVaultKmsClientConfig,
} from "./index.ts";

const PURGE_DATE = new Date("2026-09-01T00:00:00.000Z");

function fakeAzureKeyVault(options?: { recoveryLevel?: string }): {
  client: AzureKeyVaultClient;
  seen: Array<{ method: string; keyName: string; value?: Uint8Array }>;
} {
  const seen: Array<{
    method: string;
    keyName: string;
    value?: Uint8Array;
  }> = [];
  let deleted = false;
  const client: AzureKeyVaultClient = {
    getCryptographyClient(keyName) {
      return {
        async wrapKey(_algorithm, value) {
          if (deleted) throw new Error("fake Azure key is deleted");
          seen.push({ method: "wrapKey", keyName, value });
          return {
            result: Uint8Array.from([0xaa, ...value]),
          };
        },
        async unwrapKey(_algorithm, value) {
          if (deleted) throw new Error("fake Azure key is deleted");
          seen.push({ method: "unwrapKey", keyName, value });
          return { result: value.subarray(1) };
        },
      };
    },
    async beginDeleteKey(keyName) {
      seen.push({ method: "beginDeleteKey", keyName });
      return {
        async pollUntilDone() {
          deleted = true;
          return {
            properties: {
              recoveryLevel: options?.recoveryLevel ?? "Recoverable+Purgeable",
              scheduledPurgeDate: PURGE_DATE,
            },
          };
        },
      };
    },
    async purgeDeletedKey(keyName) {
      seen.push({ method: "purgeDeletedKey", keyName });
    },
  };
  return { client, seen };
}

describe("createAzureKeyVaultKmsClient", () => {
  test("strictly validates config and requires an injected client", () => {
    const { client } = fakeAzureKeyVault();
    const withoutClient = {
      keyName: "default-key",
      purgeProtectionEnabled: false,
    } as unknown as AzureKeyVaultKmsClientConfig;
    const withUnexpected = {
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client,
      unexpected: true,
    };
    expect(() =>
      createAzureKeyVaultKmsClient({
        keyName: "",
        purgeProtectionEnabled: false,
        client,
      }),
    ).toThrow(ValidationError);
    expect(() => createAzureKeyVaultKmsClient(withoutClient)).toThrow(
      ValidationError,
    );
    expect(() => createAzureKeyVaultKmsClient(withUnexpected)).toThrow(
      ValidationError,
    );
  });

  test("accepts the official KeyClient deletion shape with an injected CryptographyClient factory", async () => {
    const { client: facade, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: {
        beginDeleteKey: facade.beginDeleteKey,
        purgeDeletedKey: facade.purgeDeletedKey,
      },
      cryptographyClient: (keyName) =>
        facade.getCryptographyClient?.(keyName) ??
        (() => {
          throw new Error("fake Azure facade omitted getCryptographyClient");
        })(),
    });

    await client.generateDataKey("tenant-a");

    expect(seen[0]).toMatchObject({
      method: "wrapKey",
      keyName: "tenant-a",
    });
  });

  test("maps a logical tenant scope to a deterministic Azure key name", async () => {
    const { client, seen } = fakeAzureKeyVault();
    const kms = createAzureKeyVaultKmsClient({
      keyName: "caisson-field",
      purgeProtectionEnabled: true,
      client,
      scopeKeyName: (scope) => `caisson-field-${scope}`,
    });

    await kms.generateDataKey("tenant-a");

    expect(seen[0]).toMatchObject({
      method: "wrapKey",
      keyName: "caisson-field-tenant-a",
    });
  });

  test("rejects purge-on-delete when configured purge protection makes immediate purge impossible", () => {
    const { client } = fakeAzureKeyVault();
    expect(() =>
      createAzureKeyVaultKmsClient({
        keyName: "default-key",
        purgeProtectionEnabled: true,
        purgeOnDelete: true,
        client,
      }),
    ).toThrow(/purge protection/i);
  });

  test("wraps a fresh 32-byte DEK under the per-call key with RSA-OAEP-256", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
    });

    const { plaintextKey, wrappedKey } =
      await client.generateDataKey("tenant-a");

    expect(plaintextKey).toHaveLength(32);
    expect(wrappedKey.equals(Buffer.from([0xaa, ...plaintextKey]))).toBe(true);
    expect(seen[0]).toMatchObject({
      method: "wrapKey",
      keyName: "tenant-a",
    });
  });

  test("uses the configured default only for non-destructive empty-scope calls", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
    });

    await client.generateDataKey("");
    expect(seen[0]).toMatchObject({
      method: "wrapKey",
      keyName: "default-key",
    });
  });

  test("unwraps through the same per-call key", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
    });

    const expected = Buffer.alloc(32, 0x11);
    const plaintext = await client.decryptDataKey(
      "tenant-a",
      Buffer.from([0xaa, ...expected]),
    );

    expect(plaintext.equals(expected)).toBe(true);
    expect(seen[0]).toMatchObject({
      method: "unwrapKey",
      keyName: "tenant-a",
    });
  });

  test("soft-delete is reported as recoverable, never irreversible", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: true,
      client: sdk,
    });

    const receipt = await client.scheduleKeyDeletion("tenant-a");

    expect(receipt).toEqual({
      state: "soft-deleted",
      irreversible: false,
      scheduledFor: PURGE_DATE.toISOString(),
    });
    expect(seen.map(({ method }) => method)).toEqual(["beginDeleteKey"]);
  });

  test("a successful explicit purge is the only Azure path reported irreversible", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      purgeOnDelete: true,
      client: sdk,
    });

    const receipt = await client.scheduleKeyDeletion("tenant-a");

    expect(receipt).toEqual({ state: "purged", irreversible: true });
    expect(seen.map(({ method }) => method)).toEqual([
      "beginDeleteKey",
      "purgeDeletedKey",
    ]);
  });

  test("purge fails closed when the provider response does not prove purgeability", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault({
      recoveryLevel: "Recoverable",
    });
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      purgeOnDelete: true,
      client: sdk,
    });

    await expect(client.scheduleKeyDeletion("tenant-a")).rejects.toThrow(
      /purgeable/i,
    );
    expect(seen.map(({ method }) => method)).toEqual(["beginDeleteKey"]);
  });

  test("refuses a keyId-less destructive call before touching Azure", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
    });

    await expect(client.scheduleKeyDeletion("")).rejects.toThrow(/keyId/);
    expect(seen).toHaveLength(0);
  });
});
