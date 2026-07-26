// LIVE Azure Key Vault envelope proof. It is excluded from the default `src` suite and requires
// an explicit opt-in, vault URL, short-lived access token, and a dedicated purge-permitted vault.
// The adapter itself receives an injected KeyClient and never reads credentials or environment.
import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys";
import {
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  TenantFieldCrypto,
  createAzureKeyVaultKmsClient,
  cryptoShred,
} from "../src/index.ts";

const OPT_IN = process.env.CAISSON_KMS_AZURE_LIVE ?? "";
const VAULT_URL = process.env.CAISSON_KMS_AZURE_VAULT_URL ?? "";
const ACCESS_TOKEN = process.env.CAISSON_KMS_AZURE_ACCESS_TOKEN ?? "";
const PURGE_PROTECTION = process.env.CAISSON_KMS_AZURE_PURGE_PROTECTION ?? "";
const HAVE_CREDS =
  OPT_IN.length > 0 &&
  VAULT_URL.length > 0 &&
  ACCESS_TOKEN.length > 0 &&
  PURGE_PROTECTION === "disabled";
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 60_000;
const keyName = `caisson-field-crypto-live-${randomUUID()}`;
const credential = {
  async getToken() {
    return {
      token: ACCESS_TOKEN,
      expiresOnTimestamp: Date.now() + TIMEOUT,
    };
  },
};
const raw = new KeyClient(
  VAULT_URL.length > 0
    ? VAULT_URL
    : "https://caisson-live-disabled.vault.azure.net",
  credential,
);

afterAll(async () => {
  if (!HAVE_CREDS) return;
  try {
    const poller = await raw.beginDeleteKey(keyName);
    await poller.pollUntilDone();
    await raw.purgeDeletedKey(keyName);
  } catch {
    // The proof path normally purges first. A denied/already-purged cleanup is safe to ignore.
  }
});

describe("field-crypto Azure Key Vault — LIVE injected-client proof", () => {
  liveTest(
    "wraps, unwraps, then proves irreversible purge through cryptoShred",
    async () => {
      const created = await raw.createRsaKey(keyName, {
        keySize: 2048,
        keyOps: ["wrapKey", "unwrapKey"],
      });
      const cryptography = new CryptographyClient(created.id, credential);
      const provider = new KmsKeyProvider(
        createAzureKeyVaultKmsClient({
          keyName,
          purgeProtectionEnabled: false,
          purgeOnDelete: true,
          client: raw,
          cryptographyClient: () => cryptography,
        }),
        new InMemoryWrappedKeyStore(),
      );
      await provider.provision(keyName);
      const crypto = new TenantFieldCrypto(provider);
      const ciphertext = await crypto.encryptField(
        keyName,
        "azure-live-proof",
        "patient.note",
      );
      expect(
        await crypto.decryptField(keyName, ciphertext, "patient.note"),
      ).toBe("azure-live-proof");

      const receipt = await cryptoShred(provider, {
        keyScopeId: keyName,
        tenantId: keyName,
        subjectId: "live-proof",
        reason: "provider-contract-proof",
        occurredAt: new Date().toISOString(),
      });
      expect(receipt.deletion).toEqual({
        state: "purged",
        irreversible: true,
      });
      await expect(
        crypto.decryptField(keyName, ciphertext, "patient.note"),
      ).rejects.toThrow();
    },
    TIMEOUT,
  );
});
