import { describe, expect, test } from "bun:test";
import { createGcpKmsClient, type GcpKmsSendable } from "./kms-gcp.ts";

/**
 * A hand-injected fake `GcpKmsSendable` — records every call it received (so tests can assert the
 * exact GCP request shape) and returns a canned response. Never touches GCP (prefer this over a real
 * `KeyManagementServiceClient` mock to avoid a new test dependency, mirroring `kms-aws.test.ts`'s
 * `fakeKms` helper).
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
  destroyCryptoKeyVersion?: (req: { name?: unknown }) => Record<string, never>;
}): { client: GcpKmsSendable; seen: { method: string; request: unknown }[] } {
  const seen: { method: string; request: unknown }[] = [];
  const client: GcpKmsSendable = {
    encrypt: (async (request: {
      name?: unknown;
      plaintext?: unknown;
      additionalAuthenticatedData?: unknown;
    }) => {
      seen.push({ method: "encrypt", request });
      return [responses.encrypt?.(request) ?? {}, request, {}];
    }) as GcpKmsSendable["encrypt"],
    decrypt: (async (request: {
      name?: unknown;
      ciphertext?: unknown;
      additionalAuthenticatedData?: unknown;
    }) => {
      seen.push({ method: "decrypt", request });
      return [responses.decrypt?.(request) ?? {}, request, {}];
    }) as GcpKmsSendable["decrypt"],
    destroyCryptoKeyVersion: (async (request: { name?: unknown }) => {
      seen.push({ method: "destroyCryptoKeyVersion", request });
      return [responses.destroyCryptoKeyVersion?.(request) ?? {}, request, {}];
    }) as GcpKmsSendable["destroyCryptoKeyVersion"],
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
    const { client: kms, seen } = fakeGcpKms({
      decrypt: () => ({ plaintext: new Uint8Array([9, 9]) }),
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
    expect(plaintext.equals(Buffer.from([9, 9]))).toBe(true);
  });

  test("scheduleKeyDeletion TARGETS the per-call tenant CryptoKey's version, not the shared default", async () => {
    const { client: kms, seen } = fakeGcpKms({});
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await client.scheduleKeyDeletion(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );

    expect(seen[0]?.method).toBe("destroyCryptoKeyVersion");
    const req = seen[0]?.request as { name: string };
    expect(req.name).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a/cryptoKeyVersions/1",
    );
  });

  test("scheduleKeyDeletion REFUSES a keyId-less shred (never destroys the default CryptoKey's version)", async () => {
    const { client: kms, seen } = fakeGcpKms({});
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      client: kms,
    });

    await expect(client.scheduleKeyDeletion("")).rejects.toThrow(
      /cryptoKeyName|keyId/,
    );
    // Fail-closed BEFORE any GCP call — nothing was scheduled for destruction.
    expect(seen).toHaveLength(0);
  });

  test("scheduleKeyDeletion honors a configured cryptoKeyVersion", async () => {
    const { client: kms, seen } = fakeGcpKms({});
    const client = createGcpKmsClient({
      cryptoKeyName: "projects/p/locations/l/keyRings/r/cryptoKeys/DEFAULT",
      cryptoKeyVersion: "3",
      client: kms,
    });

    await client.scheduleKeyDeletion(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a",
    );

    const req = seen[0]?.request as { name: string };
    expect(req.name).toBe(
      "projects/p/locations/l/keyRings/r/cryptoKeys/tenant-a/cryptoKeyVersions/3",
    );
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
});
