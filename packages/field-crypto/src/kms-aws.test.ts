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

describe("createAwsKmsClient (ADR-0171)", () => {
  test("fails closed when keyId is missing", () => {
    expect(() => createAwsKmsClient({ keyId: "" })).toThrow(/keyId/);
  });

  test("generateDataKey calls GenerateDataKey and maps Plaintext/CiphertextBlob", async () => {
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: new Uint8Array(32).fill(7),
      CiphertextBlob: new Uint8Array([1, 2, 3]),
    }));
    const client = createAwsKmsClient({
      keyId: "arn:aws:kms:us-east-1:1:key/abc",
      client: kms,
    });

    const { plaintextKey, wrappedKey } = await client.generateDataKey("acct_a");

    expect(seen[0]).toBeInstanceOf(GenerateDataKeyCommand);
    expect((seen[0] as GenerateDataKeyCommand).input).toEqual({
      KeyId: "arn:aws:kms:us-east-1:1:key/abc",
      KeySpec: "AES_256",
    });
    expect(plaintextKey.equals(Buffer.alloc(32, 7))).toBe(true);
    expect(wrappedKey.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  test("decryptDataKey calls Decrypt and maps Plaintext", async () => {
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: new Uint8Array([9, 9]),
    }));
    const client = createAwsKmsClient({ keyId: "key-1", client: kms });

    const plaintext = await client.decryptDataKey(
      "acct_a",
      Buffer.from([1, 2, 3]),
    );

    expect(seen[0]).toBeInstanceOf(DecryptCommand);
    expect((seen[0] as DecryptCommand).input).toEqual({
      KeyId: "key-1",
      CiphertextBlob: Buffer.from([1, 2, 3]),
    });
    expect(plaintext.equals(Buffer.from([9, 9]))).toBe(true);
  });

  test("scheduleKeyDeletion calls ScheduleKeyDeletion with the default 7-day window", async () => {
    const { client: kms, seen } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-1", client: kms });

    await client.scheduleKeyDeletion("acct_a");

    expect(seen[0]).toBeInstanceOf(ScheduleKeyDeletionCommand);
    expect((seen[0] as ScheduleKeyDeletionCommand).input).toEqual({
      KeyId: "key-1",
      PendingWindowInDays: 7,
    });
  });

  test("scheduleKeyDeletion honors a configured pendingWindowInDays", async () => {
    const { client: kms, seen } = fakeKms(() => ({}));
    const client = createAwsKmsClient({
      keyId: "key-1",
      pendingWindowInDays: 30,
      client: kms,
    });

    await client.scheduleKeyDeletion("acct_a");

    expect((seen[0] as ScheduleKeyDeletionCommand).input).toEqual({
      KeyId: "key-1",
      PendingWindowInDays: 30,
    });
  });

  test("generateDataKey fails closed when AWS returns no key material", async () => {
    const { client: kms } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-1", client: kms });

    await expect(client.generateDataKey("acct_a")).rejects.toThrow(
      /no key material/,
    );
  });

  test("decryptDataKey fails closed when AWS returns no plaintext", async () => {
    const { client: kms } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-1", client: kms });

    await expect(
      client.decryptDataKey("acct_a", Buffer.from([1])),
    ).rejects.toThrow(/no plaintext/);
  });
});
