// Shared `KmsClient` port-conformance harness (ADR-0043/ADR-0171). Loops every driver and asserts
// each independently satisfies the port contract: `generateDataKey` returns a real envelope (the
// wrapped form is NOT the plaintext DEK), `decryptDataKey` round-trips it, and `scheduleKeyDeletion`
// is fail-closed (every subsequent op on that scope throws). New drivers (GCP/Azure/Vault) register
// here instead of re-deriving these three assertions per driver test file.
import { randomBytes } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import { LocalKmsClient, type KmsClient } from "./kms.ts";
import { createAwsKmsClient, type KmsSendable } from "./kms-aws.ts";
import { createGcpKmsClient, type GcpKmsSendable } from "./kms-gcp.ts";
import {
  createAzureKeyVaultKmsClient,
  type AzureKeyVaultClient,
} from "./kms-azure.ts";
import { aesGcm } from "./cipher.ts";

const WRAP_AAD = Buffer.from("kms-conformance-fake-aws-wrap");

/**
 * A STATEFUL fake AWS KMS backend — genuinely AEAD-wraps/unwraps (not canned responses), so the
 * conformance loop exercises `createAwsKmsClient`'s command mapping against real crypto, the same
 * way `LocalKmsClient` is real crypto. It ignores the per-call `KeyId`/`EncryptionContext` (a test
 * double, not a real per-tenant CMK router — that routing is asserted in `kms-aws.test.ts`) and wraps
 * under one process KEK; `scheduleKeyDeletion` destroys it.
 */
function fakeAwsBackend(): KmsSendable {
  const kek = randomBytes(32);
  let shredded = false;
  return {
    send: (async (command: unknown): Promise<unknown> => {
      if (shredded) {
        throw new Error("kms-conformance: fake CMK was scheduled for deletion");
      }
      if (command instanceof GenerateDataKeyCommand) {
        const plaintext = randomBytes(32);
        const { nonce, ciphertext, tag } = aesGcm.encrypt(
          kek,
          plaintext,
          WRAP_AAD,
        );
        return {
          Plaintext: plaintext,
          CiphertextBlob: Buffer.concat([nonce, ciphertext, tag]),
        };
      }
      if (command instanceof DecryptCommand) {
        const blob = Buffer.from(
          (command as DecryptCommand).input.CiphertextBlob as Uint8Array,
        );
        const nonce = blob.subarray(0, 12);
        const tag = blob.subarray(blob.length - 16);
        const ciphertext = blob.subarray(12, blob.length - 16);
        return {
          Plaintext: aesGcm.decrypt(kek, { nonce, ciphertext, tag }, WRAP_AAD),
        };
      }
      if (command instanceof ScheduleKeyDeletionCommand) {
        shredded = true;
        return {
          KeyState: "PendingDeletion",
          DeletionDate: new Date("2026-08-01T00:00:00.000Z"),
        };
      }
      throw new Error("kms-conformance: unexpected command");
    }) as KmsSendable["send"],
  } as unknown as KmsSendable;
}

/**
 * A STATEFUL fake GCP Cloud KMS backend — genuinely AEAD-wraps/unwraps (same discipline as
 * `fakeAwsBackend`), so the conformance loop exercises `createGcpKmsClient`'s call mapping against
 * real crypto. It ignores the per-call `name`/`additionalAuthenticatedData` (a test double, not a
 * real per-tenant CryptoKey router — that routing is asserted in `kms-gcp.test.ts`) and wraps under
 * one process KEK; `destroyCryptoKeyVersion` destroys it.
 */
function fakeGcpBackend(): GcpKmsSendable {
  const kek = randomBytes(32);
  let destroyed = false;
  return {
    encrypt: (async (request: { plaintext?: unknown }) => {
      if (destroyed) {
        throw new Error("kms-conformance: fake CryptoKeyVersion was destroyed");
      }
      const plaintext = Buffer.from(request.plaintext as Uint8Array);
      const { nonce, ciphertext, tag } = aesGcm.encrypt(
        kek,
        plaintext,
        WRAP_AAD,
      );
      return [
        { ciphertext: Buffer.concat([nonce, ciphertext, tag]) },
        request,
        {},
      ];
    }) as GcpKmsSendable["encrypt"],
    decrypt: (async (request: { ciphertext?: unknown }) => {
      if (destroyed) {
        throw new Error("kms-conformance: fake CryptoKeyVersion was destroyed");
      }
      const blob = Buffer.from(request.ciphertext as Uint8Array);
      const nonce = blob.subarray(0, 12);
      const tag = blob.subarray(blob.length - 16);
      const ciphertext = blob.subarray(12, blob.length - 16);
      return [
        {
          plaintext: aesGcm.decrypt(kek, { nonce, ciphertext, tag }, WRAP_AAD),
        },
        request,
        {},
      ];
    }) as GcpKmsSendable["decrypt"],
    destroyCryptoKeyVersion: (async (request: unknown) => {
      destroyed = true;
      return [
        {
          state: "DESTROY_SCHEDULED",
          destroyTime: { seconds: 1_775_001_600 },
        },
        request,
        {},
      ];
    }) as GcpKmsSendable["destroyCryptoKeyVersion"],
    listCryptoKeyVersions: (async (request: { parent?: unknown }) => {
      // One live version until destroyed — the shape the driver's list-then-destroy shred expects.
      const versions = destroyed
        ? [
            {
              name: `${String(request.parent)}/cryptoKeyVersions/1`,
              state: "DESTROY_SCHEDULED",
            },
          ]
        : [
            {
              name: `${String(request.parent)}/cryptoKeyVersions/1`,
              state: "ENABLED",
            },
          ];
      return [versions, null, {}];
    }) as GcpKmsSendable["listCryptoKeyVersions"],
  };
}

function fakeAzureBackend(): AzureKeyVaultClient {
  const kek = randomBytes(32);
  let deleted = false;
  return {
    getCryptographyClient() {
      return {
        async wrapKey(_algorithm, plaintext) {
          if (deleted) {
            throw new Error("kms-conformance: fake Azure key was deleted");
          }
          const { nonce, ciphertext, tag } = aesGcm.encrypt(
            kek,
            Buffer.from(plaintext),
            WRAP_AAD,
          );
          return { result: Buffer.concat([nonce, ciphertext, tag]) };
        },
        async unwrapKey(_algorithm, wrapped) {
          if (deleted) {
            throw new Error("kms-conformance: fake Azure key was deleted");
          }
          const blob = Buffer.from(wrapped);
          const nonce = blob.subarray(0, 12);
          const tag = blob.subarray(blob.length - 16);
          const ciphertext = blob.subarray(12, blob.length - 16);
          return {
            result: aesGcm.decrypt(kek, { nonce, ciphertext, tag }, WRAP_AAD),
          };
        },
      };
    },
    async beginDeleteKey() {
      return {
        async pollUntilDone() {
          deleted = true;
          return {
            properties: {
              recoveryLevel: "Recoverable",
              scheduledPurgeDate: new Date("2026-09-01T00:00:00.000Z"),
            },
          };
        },
      };
    },
    async purgeDeletedKey() {},
  };
}

const drivers: ReadonlyArray<{
  name: string;
  state: string;
  irreversible: boolean;
  client(): KmsClient;
}> = [
  {
    name: "LocalKmsClient",
    state: "destroyed",
    irreversible: true,
    client: () => new LocalKmsClient(randomBytes(32)),
  },
  {
    name: "createAwsKmsClient",
    state: "pending-deletion",
    irreversible: false,
    client: () =>
      createAwsKmsClient({
        keyId: "conformance-cmk",
        client: fakeAwsBackend(),
      }),
  },
  {
    name: "createGcpKmsClient",
    state: "destroy-scheduled",
    irreversible: false,
    client: () =>
      createGcpKmsClient({
        cryptoKeyName:
          "projects/p/locations/l/keyRings/r/cryptoKeys/conformance",
        client: fakeGcpBackend(),
      }),
  },
  {
    name: "createAzureKeyVaultKmsClient",
    state: "soft-deleted",
    irreversible: false,
    client: () =>
      createAzureKeyVaultKmsClient({
        keyName: "conformance-key",
        purgeProtectionEnabled: true,
        client: fakeAzureBackend(),
      }),
  },
];

for (const { name, state, irreversible, client } of drivers) {
  describe(`KmsClient port conformance: ${name}`, () => {
    test("generateDataKey wraps (the wrapped form is not the plaintext DEK)", async () => {
      const kms = client();
      const { plaintextKey, wrappedKey } = await kms.generateDataKey("acct-a");
      expect(plaintextKey.length).toBe(32);
      expect(wrappedKey.equals(plaintextKey)).toBe(false);
    });

    test("decryptDataKey round-trips a wrapped DEK back to its plaintext", async () => {
      const kms = client();
      const { plaintextKey, wrappedKey } = await kms.generateDataKey("acct-a");
      const unwrapped = await kms.decryptDataKey("acct-a", wrappedKey);
      expect(unwrapped.equals(plaintextKey)).toBe(true);
    });

    test("scheduleKeyDeletion is fail-closed: the scope is unusable after", async () => {
      const kms = client();
      const { wrappedKey } = await kms.generateDataKey("acct-a");
      const receipt = await kms.scheduleKeyDeletion("acct-a");
      expect(receipt).toMatchObject({ state, irreversible });
      await expect(kms.decryptDataKey("acct-a", wrappedKey)).rejects.toThrow();
      await expect(kms.generateDataKey("acct-a")).rejects.toThrow();
    });

    test("scheduleKeyDeletion refuses an empty keyId (no default-scope crypto-shred, ADR-0197)", async () => {
      const kms = client();
      await expect(kms.scheduleKeyDeletion("")).rejects.toThrow();
    });
  });
}
