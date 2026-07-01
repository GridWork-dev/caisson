import { describe, expect, test } from "bun:test";
import {
  DbWrappedKeyStore,
  InMemoryWrappedKeyStore,
  type KeyValueStore,
  KmsKeyProvider,
  LocalKmsClient,
  awsKmsClient,
} from "./kms.ts";
import { TenantFieldCrypto } from "./crypto.ts";
import { parseEnvelope } from "./envelope.ts";

/** An in-memory `KeyValueStore` fake — asserts `DbWrappedKeyStore` round-trips over ANY conforming KV, never a real DB. */
function fakeKv(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    async get(key: string): Promise<string | undefined> {
      return data.get(key);
    },
    async put(key: string, value: string): Promise<void> {
      data.set(key, value);
    },
  };
}

const KEK = Buffer.alloc(32, 0x55);

function freshProvider(): {
  provider: KmsKeyProvider;
  store: InMemoryWrappedKeyStore;
} {
  const store = new InMemoryWrappedKeyStore();
  return {
    provider: new KmsKeyProvider(new LocalKmsClient(KEK), store),
    store,
  };
}

describe("KmsKeyProvider (envelope encryption, ADR-0043)", () => {
  test("provision wraps a DEK; the stored form is wrapped, not the raw key", async () => {
    const { provider, store } = freshProvider();
    expect(await provider.provision("acct_a")).toBe(1);
    const wrapped = await store.getWrapped("acct_a", 1);
    // nonce(12) + wrapped-DEK(32) + tag(16) = 60 bytes — a real AEAD wrap, not the bare 32B DEK.
    expect(wrapped?.length).toBe(60);
  });

  test("keyFor before provision throws (no silent empty key)", async () => {
    const { provider } = freshProvider();
    await expect(provider.keyFor("acct_a", 1)).rejects.toThrow(
      /no wrapped DEK/,
    );
    await expect(provider.currentVersion("acct_a")).rejects.toThrow(
      /no provisioned/,
    );
  });

  test("round-trips a field through TenantFieldCrypto over KMS", async () => {
    const { provider } = freshProvider();
    await provider.provision("acct_a");
    const crypto = new TenantFieldCrypto(provider);
    const sealed = await crypto.encryptField(
      "acct_a",
      "phi-secret",
      "patient.note",
    );
    expect(await crypto.decryptField("acct_a", sealed, "patient.note")).toBe(
      "phi-secret",
    );
  });

  test("a different tenant's DEK cannot decrypt (cross-tenant isolation)", async () => {
    const { provider } = freshProvider();
    await provider.provision("acct_a");
    await provider.provision("acct_b");
    const crypto = new TenantFieldCrypto(provider);
    const sealedForA = await crypto.encryptField(
      "acct_a",
      "secret",
      "patient.note",
    );
    await expect(
      crypto.decryptField("acct_b", sealedForA, "patient.note"),
    ).rejects.toThrow();
  });

  test("rotation: a v1 value still decrypts after provisioning v2; new writes use v2", async () => {
    const { provider } = freshProvider();
    await provider.provision("acct_a"); // v1
    const crypto = new TenantFieldCrypto(provider);
    const v1 = await crypto.encryptField("acct_a", "old", "c");
    expect(parseEnvelope(v1).keyVersion).toBe(1);

    expect(await provider.provision("acct_a")).toBe(2); // rotate
    expect(await crypto.decryptField("acct_a", v1, "c")).toBe("old"); // old still decrypts

    const v2 = await crypto.encryptField("acct_a", "new", "c");
    expect(parseEnvelope(v2).keyVersion).toBe(2);
  });

  test("awsKmsClient fails closed on a missing keyId (ADR-0171)", () => {
    expect(() => awsKmsClient({ keyId: "" })).toThrow(/keyId/);
  });
});

describe("DbWrappedKeyStore (P2 DB-backed WrappedKeyStore)", () => {
  test("round-trips a wrapped DEK + current version through an injected KeyValueStore", async () => {
    const store = new DbWrappedKeyStore(fakeKv());
    expect(await store.getWrapped("acct_a", 1)).toBeUndefined();
    expect(await store.currentVersion("acct_a")).toBeUndefined();

    const wrapped = Buffer.from("wrapped-dek-bytes");
    await store.putWrapped("acct_a", 1, wrapped);
    await store.setCurrentVersion("acct_a", 1);

    expect((await store.getWrapped("acct_a", 1))?.equals(wrapped)).toBe(true);
    expect(await store.currentVersion("acct_a")).toBe(1);
    // A different tenant/version is unaffected — namespacing isolates keys.
    expect(await store.getWrapped("acct_b", 1)).toBeUndefined();
    expect(await store.getWrapped("acct_a", 2)).toBeUndefined();
  });

  test("drives KmsKeyProvider end-to-end (provision + rotate) over a DB-backed store", async () => {
    const provider = new KmsKeyProvider(
      new LocalKmsClient(Buffer.alloc(32, 0x66)),
      new DbWrappedKeyStore(fakeKv()),
    );
    expect(await provider.provision("acct_a")).toBe(1);
    expect(await provider.provision("acct_a")).toBe(2);
    expect(await provider.currentVersion("acct_a")).toBe(2);
  });
});
