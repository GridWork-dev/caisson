import { describe, expect, test } from "bun:test";
import { createGcpKmsClient, type GcpKmsSendable } from "./kms-gcp.ts";

/** A canned CryptoKeyVersion for the fake's list response. */
interface FakeVersion {
  name?: string;
  state?: string | number;
}

/**
 * A hand-injected fake `GcpKmsSendable` — records every call it received (so tests can assert the
 * exact GCP request shape) and returns a canned response. Never touches GCP (prefer this over a real
 * `KeyManagementServiceClient` mock to avoid a new test dependency, mirroring `kms-aws.test.ts`'s
 * `fakeKms` helper). `listCryptoKeyVersions` defaults to one ENABLED version `1` under the parent —
 * the shape a freshly-provisioned CryptoKey reports.
 */
function fakeGcpKms(responses: {
  encrypt?: (req: {
    name?: unknown;
    plaintext?: unknown;
    additionalAuthenticatedData?: unknown;
  }) => { ciphertext?: Uint8Array | null };
  decrypt?: (req: {
    name?: unknown;
    ciphertext?: unknown;
    additionalAuthenticatedData?: unknown;
  }) => { plaintext?: Uint8Array | null };
  destroyCryptoKeyVersion?: (req: { name?: unknown }) => FakeVersion & {
    destroyTime?: { seconds: number };
  };
  listCryptoKeyVersions?: (req: { parent?: unknown }) => FakeVersion[];
}): {
  client: GcpKmsSendable;
  seen: { method: string; request: unknown; options?: unknown }[];
} {
  const seen: { method: string; request: unknown; options?: unknown }[] = [];
  const client: GcpKmsSendable = {
    encrypt: (async (
      request: {
        name?: unknown;
        plaintext?: unknown;
        additionalAuthenticatedData?: unknown;
      },
      options?: unknown,
    ) => {
      seen.push({ method: "encrypt", request, options });
      return [responses.encrypt?.(request) ?? {}, request, {}];
    }) as GcpKmsSendable["encrypt"],
    decrypt: (async (
      request: {
        name?: unknown;
        ciphertext?: unknown;
        additionalAuthenticatedData?: unknown;
      },
      options?: unknown,
    ) => {
      seen.push({ method: "decrypt", request, options });
      return [responses.decrypt?.(request) ?? {}, request, {}];
    }) as GcpKmsSendable["decrypt"],
    destroyCryptoKeyVersion: (async (
      request: { name?: unknown },
      options?: unknown,
    ) => {
      seen.push({ method: "destroyCryptoKeyVersion", request, options });
      return [
        responses.destroyCryptoKeyVersion?.(request) ?? {
          name: request.name as string,
          state: "DESTROY_SCHEDULED",
          destroyTime: { seconds: 1_775_001_600 },
        },
        request,
        {},
      ];
    }) as GcpKmsSendable["destroyCryptoKeyVersion"],
    listCryptoKeyVersions: (async (
      request: { parent?: unknown },
      options?: unknown,
    ) => {
      seen.push({ method: "listCryptoKeyVersions", request, options });
      const versions = responses.listCryptoKeyVersions?.(request) ?? [
        {
          name: `${String(request.parent)}/cryptoKeyVersions/1`,
          state: "ENABLED",
        },
      ];
      return [versions, null, {}];
    }) as GcpKmsSendable["listCryptoKeyVersions"],
  };
  return { client, seen };
}

describe("createGcpKmsClient (ADR-0171 GCP driver, per-tenant CryptoKey)", () => {
  test("fails closed when the default cryptoKeyName is missing", () => {
    expect(() => createGcpKmsClient({ cryptoKeyName: "" })).toThrow(
      /cryptoKeyName/,
    );
  });

  test("generateDataKey TARGETS the per-call tenant CryptoKey and binds the scope AAD", async () => {
    const { client: kms, seen } = fakeGcpKms({
      encrypt: () => ({ ciphertext: new Uint8Array([1, 2, 3]) }),
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    const { plaintextKey, wrappedKey } = await client.generateDataKey(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );

    expect(seen[0]?.method).toBe("encrypt");
    const req = seen[0]?.request as {
      name: string;
      plaintext: Buffer;
      additionalAuthenticatedData: Buffer;
    };
    expect(req.name).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );
    expect(req.plaintext.equals(plaintextKey)).toBe(true);
    expect(req.additionalAuthenticatedData.toString("utf8")).toBe(
      "caisson:field-crypto:scope=projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );
    expect(plaintextKey.length).toBe(32);
    expect(wrappedKey.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  test("generateDataKey falls back to the default CryptoKey only when no per-call scope is passed", async () => {
    const { client: kms, seen } = fakeGcpKms({
      encrypt: () => ({ ciphertext: new Uint8Array([1, 2, 3]) }),
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await client.generateDataKey("");

    const req = seen[0]?.request as { name: string };
    expect(req.name).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
    );
  });

  test("decryptDataKey targets the per-call tenant CryptoKey and matches the scope AAD", async () => {
    const sdkPlaintext = new Uint8Array(32).fill(9);
    const { client: kms, seen } = fakeGcpKms({
      decrypt: () => ({ plaintext: sdkPlaintext }),
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    const plaintext = await client.decryptDataKey(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
      Buffer.from([1, 2, 3]),
    );

    expect(seen[0]?.method).toBe("decrypt");
    const req = seen[0]?.request as {
      name: string;
      ciphertext: Buffer;
      additionalAuthenticatedData: Buffer;
    };
    expect(req.name).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );
    expect(req.ciphertext.equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(req.additionalAuthenticatedData.toString("utf8")).toBe(
      "caisson:field-crypto:scope=projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );
    expect(plaintext.equals(Buffer.alloc(32, 9))).toBe(true);
    expect(sdkPlaintext).toEqual(new Uint8Array(32));
  });

  test("scheduleKeyDeletion lists the tenant CryptoKey's versions and destroys the live one", async () => {
    const { client: kms, seen } = fakeGcpKms({});
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    const receipt = await client.scheduleKeyDeletion(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );

    expect(seen[0]?.method).toBe("listCryptoKeyVersions");
    expect((seen[0]?.request as { parent: string }).parent).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );
    expect(seen[1]?.method).toBe("destroyCryptoKeyVersion");
    expect((seen[1]?.request as { name: string }).name).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a/cryptoKeyVersions/1",
    );
    expect(receipt).toEqual({
      state: "destroy-scheduled",
      irreversible: false,
      scheduledFor: "2026-04-01T00:00:00.000Z",
    });
  });

  test("rejects an out-of-parent version before issuing any destructive call", async () => {
    const parent = "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a";
    const { client: kms, seen } = fakeGcpKms({
      listCryptoKeyVersions: () => [
        {
          name: "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-b/cryptoKeyVersions/1",
          state: "ENABLED",
        },
      ],
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.scheduleKeyDeletion(parent)).rejects.toThrow(
      /outside the requested CryptoKey/i,
    );
    expect(
      seen.filter((call) => call.method === "destroyCryptoKeyVersion"),
    ).toHaveLength(0);
  });

  test("rejects duplicate listed versions before issuing any destructive call", async () => {
    const parent = "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a";
    const duplicate = `${parent}/cryptoKeyVersions/1`;
    const { client: kms, seen } = fakeGcpKms({
      listCryptoKeyVersions: () => [
        { name: duplicate, state: "ENABLED" },
        { name: duplicate, state: "DISABLED" },
      ],
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.scheduleKeyDeletion(parent)).rejects.toThrow(
      /duplicate CryptoKeyVersion/i,
    );
    expect(
      seen.filter((call) => call.method === "destroyCryptoKeyVersion"),
    ).toHaveLength(0);
  });

  test("rejects a destroy response for a different CryptoKeyVersion", async () => {
    const parent = "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a";
    const { client: kms } = fakeGcpKms({
      destroyCryptoKeyVersion: () => ({
        name: `${parent}/cryptoKeyVersions/2`,
        state: "DESTROY_SCHEDULED",
      }),
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.scheduleKeyDeletion(parent)).rejects.toThrow(
      /unexpected CryptoKeyVersion/i,
    );
  });

  test("scheduleKeyDeletion destroys EVERY live version of a rotated key, skipping already-destroyed ones", async () => {
    const parent = "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a";
    const { client: kms, seen } = fakeGcpKms({
      listCryptoKeyVersions: () => [
        { name: `${parent}/cryptoKeyVersions/1`, state: "DISABLED" },
        { name: `${parent}/cryptoKeyVersions/2`, state: "DESTROY_SCHEDULED" },
        { name: `${parent}/cryptoKeyVersions/3`, state: "ENABLED" },
      ],
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    const receipt = await client.scheduleKeyDeletion(parent);

    const destroyed = seen
      .filter((s) => s.method === "destroyCryptoKeyVersion")
      .map((s) => (s.request as { name: string }).name);
    // v1 (DISABLED, re-enablable) and v3 (ENABLED) destroyed; v2 already on its way out — skipped.
    expect(destroyed).toEqual([
      `${parent}/cryptoKeyVersions/1`,
      `${parent}/cryptoKeyVersions/3`,
    ]);
    expect(receipt).toMatchObject({
      state: "destroy-scheduled",
      irreversible: false,
    });
  });

  test("every GCP operation receives the remaining caller budget", async () => {
    const { client: kms, seen } = fakeGcpKms({
      encrypt: () => ({ ciphertext: new Uint8Array([1, 2, 3]) }),
      decrypt: () => ({ plaintext: new Uint8Array(32).fill(9) }),
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });
    const options = { timeoutMs: 1_234 };

    await client.generateDataKey("tenant-a", options);
    await client.decryptDataKey("tenant-a", Buffer.from([1, 2, 3]), options);
    await client.scheduleKeyDeletion("tenant-a", options);

    expect(seen).toHaveLength(4);
    for (const call of seen) {
      const timeout = (call.options as { timeout?: number }).timeout;
      expect(timeout).toBeGreaterThan(0);
      expect(timeout).toBeLessThanOrEqual(1_234);
    }
  });

  test("multi-RPC GCP deletion passes a diminishing timeout to later calls", async () => {
    const base = fakeGcpKms({});
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: {
        ...base.client,
        listCryptoKeyVersions: (async (
          request: { parent?: unknown },
          options?: unknown,
        ) => {
          base.seen.push({
            method: "listCryptoKeyVersions",
            request,
            options,
          });
          await new Promise((resolve) => setTimeout(resolve, 20));
          return [
            [
              {
                name: `${String(request.parent)}/cryptoKeyVersions/1`,
                state: "ENABLED",
              },
            ],
            null,
            {},
          ];
        }) as unknown as GcpKmsSendable["listCryptoKeyVersions"],
      },
    });

    await client.scheduleKeyDeletion("tenant-a", { timeoutMs: 1_000 });

    const listTimeout = (
      base.seen.find((call) => call.method === "listCryptoKeyVersions")
        ?.options as { timeout: number }
    ).timeout;
    const destroyTimeout = (
      base.seen.find((call) => call.method === "destroyCryptoKeyVersion")
        ?.options as { timeout: number }
    ).timeout;
    expect(destroyTimeout).toBeLessThan(listTimeout);
  });

  test("manual GCP pagination consumes one diminishing budget across every page and destroy", async () => {
    const seen: { method: string; timeout: number }[] = [];
    const parent = "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a";
    const base = fakeGcpKms({}).client;
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: {
        ...base,
        listCryptoKeyVersions: (async (
          request: { parent?: string; pageToken?: string },
          options?: { timeout?: number; autoPaginate?: boolean },
        ) => {
          seen.push({
            method: `list:${request.pageToken ?? "first"}`,
            timeout: options?.timeout ?? 0,
          });
          expect(options?.autoPaginate).toBe(false);
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (request.pageToken === undefined) {
            return [
              [{ name: `${parent}/cryptoKeyVersions/1`, state: "ENABLED" }],
              { parent, pageToken: "next" },
              {},
            ];
          }
          return [
            [{ name: `${parent}/cryptoKeyVersions/2`, state: "DESTROYED" }],
            null,
            {},
          ];
        }) as unknown as GcpKmsSendable["listCryptoKeyVersions"],
        destroyCryptoKeyVersion: (async (
          _request: { name?: string },
          options?: { timeout?: number },
        ) => {
          seen.push({
            method: "destroy",
            timeout: options?.timeout ?? 0,
          });
          return [
            {
              name: _request.name,
              state: "DESTROY_SCHEDULED",
            },
            {},
            {},
          ];
        }) as unknown as GcpKmsSendable["destroyCryptoKeyVersion"],
      },
    });

    await client.scheduleKeyDeletion(parent, { timeoutMs: 1_000 });

    expect(seen.map(({ method }) => method)).toEqual([
      "list:first",
      "list:next",
      "destroy",
    ]);
    expect(seen[1]?.timeout).toBeLessThan(seen[0]?.timeout ?? 0);
    expect(seen[2]?.timeout).toBeLessThan(seen[1]?.timeout ?? 0);
  });

  test("GCP deletion starts no later page or destroy after the shared budget expires", async () => {
    const seen: string[] = [];
    const base = fakeGcpKms({}).client;
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: {
        ...base,
        listCryptoKeyVersions: (async () => {
          seen.push("list:first");
          await new Promise((resolve) => setTimeout(resolve, 20));
          return [
            [{ name: "tenant-a/cryptoKeyVersions/1", state: "ENABLED" }],
            { parent: "tenant-a", pageToken: "next" },
            {},
          ];
        }) as unknown as GcpKmsSendable["listCryptoKeyVersions"],
        destroyCryptoKeyVersion: (async (request: { name?: string }) => {
          seen.push("destroy");
          return [{ name: request.name, state: "DESTROY_SCHEDULED" }, {}, {}];
        }) as unknown as GcpKmsSendable["destroyCryptoKeyVersion"],
      },
    });

    await expect(
      client.scheduleKeyDeletion("tenant-a", { timeoutMs: 5 }),
    ).rejects.toThrow(/exceeded 5ms/);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(seen).toEqual(["list:first"]);
  });

  test("GCP generate aborts promptly and zeroizes its transient plaintext DEK", async () => {
    let generatedPlaintext: Buffer | undefined;
    const base = fakeGcpKms({}).client;
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: {
        ...base,
        encrypt: (async (request: { plaintext?: unknown }) => {
          generatedPlaintext = request.plaintext as Buffer;
          return new Promise(() => undefined);
        }) as GcpKmsSendable["encrypt"],
      },
    });
    const controller = new AbortController();
    const pending = client.generateDataKey("tenant-a", {
      abortSignal: controller.signal,
      timeoutMs: 1_000,
    });

    controller.abort(new Error("request cancelled"));

    await expect(pending).rejects.toThrow(/request cancelled/);
    expect(generatedPlaintext?.equals(Buffer.alloc(32))).toBe(true);
  });

  test("a late GCP decrypt response is zeroized after caller cancellation", async () => {
    const sdkPlaintext = new Uint8Array([9, 8, 7]);
    type DecryptResponse = [
      { plaintext: Uint8Array },
      undefined,
      Record<string, never>,
    ];
    let resolveDecrypt!: (value: DecryptResponse) => void;
    const lateResponse = new Promise<DecryptResponse>((resolve) => {
      resolveDecrypt = resolve;
    });
    const base = fakeGcpKms({}).client;
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: {
        ...base,
        decrypt: (() => lateResponse) as unknown as GcpKmsSendable["decrypt"],
      },
    });
    const controller = new AbortController();
    const pending = client.decryptDataKey("acct_a", Buffer.from([1, 2, 3]), {
      abortSignal: controller.signal,
      timeoutMs: 1_000,
    });

    controller.abort(new Error("request cancelled"));
    await expect(pending).rejects.toThrow(/request cancelled/);
    resolveDecrypt([{ plaintext: sdkPlaintext }, undefined, {}]);
    await Promise.resolve();
    await Promise.resolve();

    expect(sdkPlaintext).toEqual(new Uint8Array(3));
  });

  test("scheduleKeyDeletion fails loud when the list returns no versions at all", async () => {
    const { client: kms, seen } = fakeGcpKms({
      listCryptoKeyVersions: () => [],
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(
      client.scheduleKeyDeletion(
        "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
      ),
    ).rejects.toThrow(/no CryptoKeyVersions/);
    // Nothing was destroyed.
    expect(
      seen.filter((s) => s.method === "destroyCryptoKeyVersion"),
    ).toHaveLength(0);
  });

  test("scheduleKeyDeletion REFUSES a keyId-less shred (never destroys the default CryptoKey's versions)", async () => {
    const { client: kms, seen } = fakeGcpKms({});
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.scheduleKeyDeletion("")).rejects.toThrow(
      /cryptoKeyName|keyId/,
    );
    // Fail-closed BEFORE any GCP call — nothing was listed or scheduled for destruction.
    expect(seen).toHaveLength(0);
  });

  test("generateDataKey fails closed when GCP returns no ciphertext", async () => {
    const { client: kms } = fakeGcpKms({ encrypt: () => ({}) });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.generateDataKey("acct_a")).rejects.toThrow(
      /no ciphertext/,
    );
  });

  test("decryptDataKey fails closed when GCP returns no plaintext", async () => {
    const { client: kms } = fakeGcpKms({ decrypt: () => ({}) });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(
      client.decryptDataKey("acct_a", Buffer.from([1])),
    ).rejects.toThrow(/no plaintext/);
  });

  for (const length of [0, 31, 33]) {
    test(`decryptDataKey rejects and zeroizes a ${String(length)}-byte GCP DEK`, async () => {
      const sdkPlaintext = new Uint8Array(length).fill(7);
      const { client: kms } = fakeGcpKms({
        decrypt: () => ({ plaintext: sdkPlaintext }),
      });
      const client = createGcpKmsClient({
        cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
        client: kms,
      });

      await expect(
        client.decryptDataKey("acct_a", Buffer.from([1])),
      ).rejects.toThrow(/32-byte/);
      expect(sdkPlaintext).toEqual(new Uint8Array(length));
    });
  }

  test("generateDataKey rejects empty GCP ciphertext and zeroizes the local DEK", async () => {
    let localPlaintext: Buffer | undefined;
    const { client: kms } = fakeGcpKms({
      encrypt: (request) => {
        localPlaintext = request.plaintext as Buffer;
        return { ciphertext: new Uint8Array() };
      },
    });
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.generateDataKey("acct_a")).rejects.toThrow(
      /wrapped ciphertext/,
    );
    expect(localPlaintext?.equals(Buffer.alloc(32))).toBe(true);
  });
});
