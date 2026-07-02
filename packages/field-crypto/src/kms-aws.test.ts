import { describe, expect, test } from "bun:test";
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import { createAwsKmsClient, type KmsSendable } from "./kms-aws.ts";

/**
 * A hand-injected fake `KmsSendable` — records every command it received (so tests can assert the
 * exact AWS call shape) and returns a canned response. Never touches AWS (prefer this over
 * `aws-sdk-client-mock` to avoid a new test dependency).
 */
function fakeKms(respond: (command: unknown) => unknown): {
  client: KmsSendable;
  seen: unknown[];
} {
  const seen: unknown[] = [];
  const client = {
    send: async (command: unknown): Promise<unknown> => {
      seen.push(command);
      return respond(command);
    },
  } as unknown as KmsSendable;
  return { client, seen };
}

describe("createAwsKmsClient (ADR-0171 / ADR-0197 per-tenant CMK)", () => {
  test("fails closed when the default keyId is missing", () => {
    expect(() => createAwsKmsClient({ keyId: "" })).toThrow(/keyId/);
  });

  test("generateDataKey TARGETS the per-call tenant CMK and binds the scope EncryptionContext", async () => {
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: new Uint8Array(32).fill(7),
      CiphertextBlob: new Uint8Array([1, 2, 3]),
    }));
    const client = createAwsKmsClient({
      keyId: "arn:aws:kms:us-east-1:1:key/DEFAULT",
      client: kms,
    });

    // The per-call keyId is the tenant scope — the driver must use IT, not the default CMK.
    const { plaintextKey, wrappedKey } =
      await client.generateDataKey("alias/tenant-a");

    expect(seen[0]).toBeInstanceOf(GenerateDataKeyCommand);
    expect((seen[0] as GenerateDataKeyCommand).input).toEqual({
      KeyId: "alias/tenant-a",
      KeySpec: "AES_256",
      EncryptionContext: { "caisson:field-crypto:scope": "alias/tenant-a" },
    });
    expect(plaintextKey.equals(Buffer.alloc(32, 7))).toBe(true);
    expect(wrappedKey.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  test("generateDataKey falls back to the default CMK only when no per-call scope is passed", async () => {
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: new Uint8Array(32).fill(7),
      CiphertextBlob: new Uint8Array([1, 2, 3]),
    }));
    const client = createAwsKmsClient({
      keyId: "arn:aws:kms:us-east-1:1:key/DEFAULT",
      client: kms,
    });

    await client.generateDataKey("");

    expect((seen[0] as GenerateDataKeyCommand).input).toEqual({
      KeyId: "arn:aws:kms:us-east-1:1:key/DEFAULT",
      KeySpec: "AES_256",
      EncryptionContext: { "caisson:field-crypto:scope": "" },
    });
  });

  test("decryptDataKey targets the per-call tenant CMK and matches the scope EncryptionContext", async () => {
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: new Uint8Array([9, 9]),
    }));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    const plaintext = await client.decryptDataKey(
      "alias/tenant-a",
      Buffer.from([1, 2, 3]),
    );

    expect(seen[0]).toBeInstanceOf(DecryptCommand);
    expect((seen[0] as DecryptCommand).input).toEqual({
      KeyId: "alias/tenant-a",
      CiphertextBlob: Buffer.from([1, 2, 3]),
      EncryptionContext: { "caisson:field-crypto:scope": "alias/tenant-a" },
    });
    expect(plaintext.equals(Buffer.from([9, 9]))).toBe(true);
  });

  test("scheduleKeyDeletion TARGETS the per-call tenant CMK — not the shared default (blast-radius fix)", async () => {
    const { client: kms, seen } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await client.scheduleKeyDeletion("alias/tenant-a");

    expect(seen[0]).toBeInstanceOf(ScheduleKeyDeletionCommand);
    expect((seen[0] as ScheduleKeyDeletionCommand).input).toEqual({
      KeyId: "alias/tenant-a",
      PendingWindowInDays: 7,
    });
  });

  test("scheduleKeyDeletion REFUSES a keyId-less shred (never crypto-shreds the default CMK)", async () => {
    const { client: kms, seen } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await expect(client.scheduleKeyDeletion("")).rejects.toThrow(/keyId/);
    // Fail-closed BEFORE any AWS call — nothing was scheduled for deletion.
    expect(seen).toHaveLength(0);
  });

  test("scheduleKeyDeletion honors a configured pendingWindowInDays", async () => {
    const { client: kms, seen } = fakeKms(() => ({}));
    const client = createAwsKmsClient({
      keyId: "key-DEFAULT",
      pendingWindowInDays: 30,
      client: kms,
    });

    await client.scheduleKeyDeletion("alias/tenant-a");

    expect((seen[0] as ScheduleKeyDeletionCommand).input).toEqual({
      KeyId: "alias/tenant-a",
      PendingWindowInDays: 30,
    });
  });

  test("generateDataKey fails closed when AWS returns no key material", async () => {
    const { client: kms } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await expect(client.generateDataKey("acct_a")).rejects.toThrow(
      /no key material/,
    );
  });

  test("decryptDataKey fails closed when AWS returns no plaintext", async () => {
    const { client: kms } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await expect(
      client.decryptDataKey("acct_a", Buffer.from([1])),
    ).rejects.toThrow(/no plaintext/);
  });
});
