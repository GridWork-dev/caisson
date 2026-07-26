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
  seenOptions: unknown[];
} {
  const seen: unknown[] = [];
  const seenOptions: unknown[] = [];
  const client = {
    send: async (command: unknown, options?: unknown): Promise<unknown> => {
      seen.push(command);
      seenOptions.push(options);
      return respond(command);
    },
  } as unknown as KmsSendable;
  return { client, seen, seenOptions };
}

describe("createAwsKmsClient (ADR-0171 / ADR-0197 per-tenant CMK)", () => {
  test("fails closed when the default keyId is missing", () => {
    expect(() => createAwsKmsClient({ keyId: "" })).toThrow(/keyId/);
  });

  test("generateDataKey TARGETS the per-call tenant CMK and binds the scope EncryptionContext", async () => {
    const sdkPlaintext = new Uint8Array(32).fill(7);
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: sdkPlaintext,
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
    expect(sdkPlaintext).toEqual(new Uint8Array(32));
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
    const sdkPlaintext = new Uint8Array(32).fill(9);
    const { client: kms, seen } = fakeKms(() => ({
      Plaintext: sdkPlaintext,
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
    expect(plaintext.equals(Buffer.alloc(32, 9))).toBe(true);
    expect(sdkPlaintext).toEqual(new Uint8Array(32));
  });

  test("scheduleKeyDeletion TARGETS the per-call tenant CMK — not the shared default (blast-radius fix)", async () => {
    const deletionDate = new Date("2026-08-01T00:00:00.000Z");
    const { client: kms, seen } = fakeKms(() => ({
      KeyState: "PendingDeletion",
      DeletionDate: deletionDate,
    }));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    const receipt = await client.scheduleKeyDeletion("alias/tenant-a");

    expect(seen[0]).toBeInstanceOf(ScheduleKeyDeletionCommand);
    expect((seen[0] as ScheduleKeyDeletionCommand).input).toEqual({
      KeyId: "alias/tenant-a",
      PendingWindowInDays: 7,
    });
    expect(receipt).toEqual({
      state: "pending-deletion",
      irreversible: false,
      scheduledFor: deletionDate.toISOString(),
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
    const { client: kms, seen } = fakeKms(() => ({
      KeyState: "PendingDeletion",
      DeletionDate: new Date("2026-08-24T00:00:00.000Z"),
    }));
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

  test("every AWS operation receives the caller's bounded abort budget", async () => {
    const { client: kms, seenOptions } = fakeKms((command) => {
      if (command instanceof GenerateDataKeyCommand) {
        return {
          Plaintext: new Uint8Array(32).fill(7),
          CiphertextBlob: new Uint8Array([1, 2, 3]),
        };
      }
      if (command instanceof DecryptCommand) {
        return { Plaintext: new Uint8Array(32).fill(9) };
      }
      return {
        KeyState: "PendingDeletion",
        DeletionDate: new Date("2026-08-01T00:00:00.000Z"),
      };
    });
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });
    const controller = new AbortController();
    const options = { abortSignal: controller.signal, timeoutMs: 1_234 };

    await client.generateDataKey("alias/tenant-a", options);
    await client.decryptDataKey(
      "alias/tenant-a",
      Buffer.from([1, 2, 3]),
      options,
    );
    await client.scheduleKeyDeletion("alias/tenant-a", options);

    expect(seenOptions).toHaveLength(3);
    for (const seen of seenOptions) {
      expect((seen as { abortSignal?: AbortSignal }).abortSignal).toBeDefined();
    }
  });

  test("AWS operations fail when their local deadline expires", async () => {
    const client = createAwsKmsClient({
      keyId: "key-DEFAULT",
      client: {
        send: ((_: unknown, options?: { abortSignal?: AbortSignal }) =>
          new Promise((_, reject) => {
            options?.abortSignal?.addEventListener(
              "abort",
              () => reject(options.abortSignal?.reason),
              { once: true },
            );
          })) as KmsSendable["send"],
      },
    });

    await expect(
      client.generateDataKey("alias/tenant-a", { timeoutMs: 5 }),
    ).rejects.toThrow(/exceeded 5ms/);
  });

  test("a late AWS decrypt response is zeroized after caller cancellation", async () => {
    const sdkPlaintext = new Uint8Array([9, 8, 7]);
    let resolveSend!: (value: { Plaintext: Uint8Array }) => void;
    const lateResponse = new Promise<{ Plaintext: Uint8Array }>((resolve) => {
      resolveSend = resolve;
    });
    const client = createAwsKmsClient({
      keyId: "key-DEFAULT",
      client: {
        send: (() => lateResponse) as unknown as KmsSendable["send"],
      },
    });
    const controller = new AbortController();
    const pending = client.decryptDataKey("acct_a", Buffer.from([1, 2, 3]), {
      abortSignal: controller.signal,
      timeoutMs: 1_000,
    });

    controller.abort(new Error("request cancelled"));
    await expect(pending).rejects.toThrow(/request cancelled/);
    resolveSend({ Plaintext: sdkPlaintext });
    await Promise.resolve();
    await Promise.resolve();

    expect(sdkPlaintext).toEqual(new Uint8Array(3));
  });

  test("generateDataKey fails closed when AWS returns no key material", async () => {
    const sdkPlaintext = new Uint8Array(32).fill(7);
    const { client: kms } = fakeKms(() => ({ Plaintext: sdkPlaintext }));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await expect(client.generateDataKey("acct_a")).rejects.toThrow(
      /no key material/,
    );
    expect(sdkPlaintext).toEqual(new Uint8Array(32));
  });

  test("decryptDataKey fails closed when AWS returns no plaintext", async () => {
    const { client: kms } = fakeKms(() => ({}));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await expect(
      client.decryptDataKey("acct_a", Buffer.from([1])),
    ).rejects.toThrow(/no plaintext/);
  });

  for (const length of [0, 31, 33]) {
    test(`decryptDataKey rejects and zeroizes a ${String(length)}-byte AWS DEK`, async () => {
      const sdkPlaintext = new Uint8Array(length).fill(7);
      const { client: kms } = fakeKms(() => ({ Plaintext: sdkPlaintext }));
      const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

      await expect(
        client.decryptDataKey("acct_a", Buffer.from([1])),
      ).rejects.toThrow(/32-byte/);
      expect(sdkPlaintext).toEqual(new Uint8Array(length));
    });
  }

  test("generateDataKey rejects and zeroizes malformed AWS key material", async () => {
    const sdkPlaintext = new Uint8Array(31).fill(7);
    const { client: kms } = fakeKms(() => ({
      Plaintext: sdkPlaintext,
      CiphertextBlob: new Uint8Array(),
    }));
    const client = createAwsKmsClient({ keyId: "key-DEFAULT", client: kms });

    await expect(client.generateDataKey("acct_a")).rejects.toThrow(
      /32-byte|wrapped ciphertext/,
    );
    expect(sdkPlaintext).toEqual(new Uint8Array(31));
  });
});
