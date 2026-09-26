import { describe, expect, test } from "bun:test";
import type { KeyWrapAlgorithm } from "@azure/keyvault-keys";
import { ValidationError } from "@caisson-sh/kernel";
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
        async wrapKey(algorithm, value) {
          if (deleted) throw new Error("fake Azure key is deleted");
          seen.push({ method: "wrapKey", keyName, value });
          return {
            result: Uint8Array.from([0xaa, ...value]),
            keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/version-1`,
            algorithm,
          };
        },
        async unwrapKey(algorithm, value) {
          if (deleted) throw new Error("fake Azure key is deleted");
          seen.push({ method: "unwrapKey", keyName, value });
          return {
            result: Uint8Array.from(value.subarray(1)),
            keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/version-1`,
            algorithm,
          };
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
  test("pins each wrapped DEK to the Azure KEK version that wrapped it", async () => {
    let latestVersion = "version-1";
    const seenUnwrapVersions: string[] = [];
    const { client: sdk } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: true,
      client: sdk,
      cryptographyClient: (keyName, requestedVersion?: string) => {
        const version = requestedVersion ?? latestVersion;
        const marker = version === "version-1" ? 0xa1 : 0xa2;
        return {
          async wrapKey(algorithm, key) {
            return {
              result: Uint8Array.from([marker, ...key]),
              keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/${version}`,
              algorithm,
            };
          },
          async unwrapKey(algorithm, value) {
            seenUnwrapVersions.push(version);
            if (value[0] !== marker) throw new Error("wrong Azure KEK version");
            return {
              result: Uint8Array.from(value.subarray(1)),
              keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/${version}`,
              algorithm,
            };
          },
        };
      },
    });

    const v1 = await client.generateDataKey("tenant-a");
    latestVersion = "version-2";
    const v2 = await client.generateDataKey("tenant-a");

    expect(
      (await client.decryptDataKey("tenant-a", v1.wrappedKey)).equals(
        v1.plaintextKey,
      ),
    ).toBe(true);
    expect(
      (await client.decryptDataKey("tenant-a", v2.wrappedKey)).equals(
        v2.plaintextKey,
      ),
    ).toBe(true);
    expect(seenUnwrapVersions).toEqual(["version-1", "version-2"]);
  });

  test("forwards pinned versions through the composed Azure client facade", async () => {
    let latestVersion = "version-1";
    const seenUnwrapVersions: string[] = [];
    const { client: deletionClient } = fakeAzureKeyVault();
    const facade: AzureKeyVaultClient = {
      getCryptographyClient(keyName, requestedVersion) {
        const version = requestedVersion ?? latestVersion;
        const marker = version === "version-1" ? 0xa1 : 0xa2;
        return {
          async wrapKey(algorithm, key) {
            return {
              result: Uint8Array.from([marker, ...key]),
              keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/${version}`,
              algorithm,
            };
          },
          async unwrapKey(algorithm, value) {
            seenUnwrapVersions.push(version);
            if (value[0] !== marker) throw new Error("wrong Azure KEK version");
            return {
              result: Uint8Array.from(value.subarray(1)),
              keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/${version}`,
              algorithm,
            };
          },
        };
      },
      beginDeleteKey: deletionClient.beginDeleteKey,
      purgeDeletedKey: deletionClient.purgeDeletedKey,
    };
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: true,
      client: facade,
    });

    const v1 = await client.generateDataKey("tenant-a");
    latestVersion = "version-2";
    const v2 = await client.generateDataKey("tenant-a");

    expect(
      (await client.decryptDataKey("tenant-a", v1.wrappedKey)).equals(
        v1.plaintextKey,
      ),
    ).toBe(true);
    expect(
      (await client.decryptDataKey("tenant-a", v2.wrappedKey)).equals(
        v2.plaintextKey,
      ),
    ).toBe(true);
    expect(seenUnwrapVersions).toEqual(["version-1", "version-2"]);
  });

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
    expect(
      (await client.decryptDataKey("tenant-a", wrappedKey)).equals(
        plaintextKey,
      ),
    ).toBe(true);
    expect(seen[0]).toMatchObject({
      method: "wrapKey",
      keyName: "tenant-a",
    });
  });

  test("zeroizes the fresh plaintext DEK when Azure wrapping fails", async () => {
    const { client: sdk } = fakeAzureKeyVault();
    let attempted: Uint8Array | undefined;
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
      cryptographyClient: () => ({
        async wrapKey(_algorithm, key) {
          attempted = key;
          throw new Error("Azure wrap unavailable");
        },
        async unwrapKey() {
          throw new Error("not used");
        },
      }),
    });

    await expect(client.generateDataKey("tenant-a")).rejects.toThrow(
      "Azure wrap unavailable",
    );
    expect(Buffer.from(attempted ?? []).equals(Buffer.alloc(32))).toBe(true);
  });

  test("rejects a wrap result without the exact versioned Azure key identity", async () => {
    const { client: sdk } = fakeAzureKeyVault();
    let attempted: Uint8Array | undefined;
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
      cryptographyClient: () => ({
        async wrapKey(algorithm, key) {
          attempted = key;
          return {
            result: Buffer.alloc(48, 0x71),
            algorithm,
          };
        },
        async unwrapKey() {
          throw new Error("not used");
        },
      }),
    });

    await expect(client.generateDataKey("tenant-a")).rejects.toThrow(
      /versioned key identifier/i,
    );
    expect(Buffer.from(attempted ?? []).equals(Buffer.alloc(32))).toBe(true);
  });

  test("rejects a versioned Azure key identity outside the expected tenant key", async () => {
    const { client: sdk } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
      cryptographyClient: () => ({
        async wrapKey(algorithm) {
          return {
            result: Buffer.alloc(48, 0x71),
            keyID:
              "https://caisson-test.vault.azure.net/keys/other-tenant/version-1",
            algorithm,
          };
        },
        async unwrapKey() {
          throw new Error("not used");
        },
      }),
    });

    await expect(client.generateDataKey("tenant-a")).rejects.toThrow(
      /expected key scope/i,
    );
  });

  test("rejects malformed or algorithm-confused wrapped payloads before Azure unwrap", async () => {
    const { client: sdk, seen } = fakeAzureKeyVault();
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
    });

    await expect(
      client.decryptDataKey("tenant-a", Buffer.from("not-json")),
    ).rejects.toThrow(/malformed/i);
    await expect(
      client.decryptDataKey(
        "tenant-a",
        Buffer.from(
          JSON.stringify({
            formatVersion: 1,
            keyVersion: "version-1",
            wrapAlgorithm: "RSA1_5",
            ciphertext: Buffer.alloc(48, 0x71).toString("base64"),
          }),
        ),
      ),
    ).rejects.toThrow(/algorithm/i);
    expect(seen).toHaveLength(0);
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

    const generated = await client.generateDataKey("tenant-a");
    const plaintext = await client.decryptDataKey(
      "tenant-a",
      generated.wrappedKey,
    );

    expect(plaintext.equals(generated.plaintextKey)).toBe(true);
    expect(seen.at(-1)).toMatchObject({
      method: "unwrapKey",
      keyName: "tenant-a",
    });
  });

  test("copies then zeroizes the Azure SDK unwrap result", async () => {
    const { client: sdk } = fakeAzureKeyVault();
    const sdkPlaintext = Buffer.alloc(32, 0x61);
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
      cryptographyClient: () => ({
        async wrapKey(algorithm) {
          return {
            result: Buffer.alloc(48, 0x71),
            keyID:
              "https://caisson-test.vault.azure.net/keys/tenant-a/version-1",
            algorithm,
          };
        },
        async unwrapKey(algorithm) {
          return {
            result: sdkPlaintext,
            keyID:
              "https://caisson-test.vault.azure.net/keys/tenant-a/version-1",
            algorithm,
          };
        },
      }),
    });

    const generated = await client.generateDataKey("tenant-a");
    const plaintext = await client.decryptDataKey(
      "tenant-a",
      generated.wrappedKey,
    );

    expect(plaintext.equals(Buffer.alloc(32, 0x61))).toBe(true);
    expect(sdkPlaintext.equals(Buffer.alloc(32))).toBe(true);
  });

  test("enforces the deadline when Azure ignores cancellation and zeroizes a late unwrap", async () => {
    const { client: sdk } = fakeAzureKeyVault();
    const sdkPlaintext = Buffer.alloc(32, 0x61);
    let resolveUnwrap!: () => void;
    const lateUnwrap = new Promise<{
      result: Uint8Array;
      keyID: string;
      algorithm: KeyWrapAlgorithm;
    }>((resolve) => {
      resolveUnwrap = () =>
        resolve({
          result: sdkPlaintext,
          keyID: "https://caisson-test.vault.azure.net/keys/tenant-a/version-1",
          algorithm: "RSA-OAEP-256",
        });
    });
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
      cryptographyClient: (keyName) => ({
        async wrapKey(algorithm) {
          return {
            result: Buffer.alloc(48, 0x71),
            keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/version-1`,
            algorithm,
          };
        },
        async unwrapKey() {
          return lateUnwrap;
        },
      }),
    });
    const generated = await client.generateDataKey("tenant-a");

    await expect(
      client.decryptDataKey("tenant-a", generated.wrappedKey, {
        timeoutMs: 5,
      }),
    ).rejects.toThrow(/exceeded 5ms/i);
    resolveUnwrap();
    await lateUnwrap;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sdkPlaintext.equals(Buffer.alloc(32))).toBe(true);
  });

  test("does not attach request-time abort budgets to Azure delete, poll, or purge", async () => {
    const seenOptions: unknown[] = [];
    const { client: sdk } = fakeAzureKeyVault({
      recoveryLevel: "Recoverable+Purgeable",
    });
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      purgeOnDelete: true,
      client: {
        ...sdk,
        async beginDeleteKey(_keyName, options) {
          seenOptions.push(options);
          return {
            async pollUntilDone(pollOptions) {
              seenOptions.push(pollOptions);
              return {
                properties: {
                  recoveryLevel: "Recoverable+Purgeable",
                  scheduledPurgeDate: PURGE_DATE,
                },
              };
            },
          };
        },
        async purgeDeletedKey(_keyName, options) {
          seenOptions.push(options);
        },
      },
    });

    await client.scheduleKeyDeletion("tenant-a");

    expect(seenOptions).toEqual([undefined, undefined, undefined]);
  });

  test("rejects an unwrap identity mismatch and still zeroizes the SDK plaintext", async () => {
    const { client: sdk } = fakeAzureKeyVault();
    const sdkPlaintext = Buffer.alloc(32, 0x61);
    const client = createAzureKeyVaultKmsClient({
      keyName: "default-key",
      purgeProtectionEnabled: false,
      client: sdk,
      cryptographyClient: (keyName) => ({
        async wrapKey(algorithm) {
          return {
            result: Buffer.alloc(48, 0x71),
            keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/version-1`,
            algorithm,
          };
        },
        async unwrapKey(algorithm) {
          return {
            result: sdkPlaintext,
            keyID: `https://caisson-test.vault.azure.net/keys/${keyName}/version-2`,
            algorithm,
          };
        },
      }),
    });

    const generated = await client.generateDataKey("tenant-a");
    await expect(
      client.decryptDataKey("tenant-a", generated.wrappedKey),
    ).rejects.toThrow(/unexpected key version/i);
    expect(sdkPlaintext.equals(Buffer.alloc(32))).toBe(true);
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
