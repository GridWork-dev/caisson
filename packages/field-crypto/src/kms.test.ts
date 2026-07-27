import { describe, expect, test } from "bun:test";
import {
  DbWrappedKeyStore,
  InMemoryWrappedKeyStore,
  type KeyValueStore,
  type KmsClient,
  type WrappedKeyStore,
  KmsKeyProvider,
  LocalKmsClient,
  awsKmsClient,
} from "./kms.ts";
import { TenantFieldCrypto } from "./crypto.ts";
import { parseEnvelope } from "./envelope.ts";
import type { FieldKeyProvider } from "./provider.ts";

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
    async putIfAbsent(key: string, value: string): Promise<boolean> {
      if (data.has(key)) return false;
      data.set(key, value);
      return true;
    },
    async compareAndSwap(
      key: string,
      expected: string | undefined,
      next: string,
    ): Promise<boolean> {
      if (data.get(key) !== expected) return false;
      data.set(key, next);
      return true;
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

  test("provision zeroizes the generated plaintext DEK after wrapping is persisted", async () => {
    const plaintextKey = Buffer.alloc(32, 0x91);
    const client: KmsClient = {
      async generateDataKey() {
        return {
          plaintextKey,
          wrappedKey: Buffer.alloc(48, 0x29),
        };
      },
      async decryptDataKey() {
        throw new Error("not used");
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const provider = new KmsKeyProvider(client, new InMemoryWrappedKeyStore());

    await provider.provision("acct_a");

    expect(plaintextKey.equals(Buffer.alloc(32))).toBe(true);
  });

  test("concurrent first seals elect one append-only version-1 winner", async () => {
    const { provider, store } = freshProvider();

    const versions = await Promise.all([
      provider.ensureProvisioned("acct_a"),
      provider.ensureProvisioned("acct_a"),
    ]);

    expect(versions).toEqual([1, 1]);
    expect(await store.currentVersion("acct_a")).toBe(1);
    expect(await store.getWrapped("acct_a", 1)).toBeDefined();
    expect(await store.getWrapped("acct_a", 2)).toBeUndefined();
  });

  test("a first-provision CAS loser re-reads and adopts the durable winner", async () => {
    const store = new InMemoryWrappedKeyStore();
    const winnerKms = new LocalKmsClient(KEK);
    const winner1 = await winnerKms.generateDataKey("acct_a");
    const winner2 = await winnerKms.generateDataKey("acct_a");
    await store.putWrapped("acct_a", 1, winner1.wrappedKey);
    await store.putWrapped("acct_a", 2, winner2.wrappedKey);
    await store.setCurrentVersion("acct_a", 2);

    let currentReads = 0;
    const staleFirstReadStore = {
      ...store,
      getWrapped: store.getWrapped.bind(store),
      putWrappedIfAbsent: store.putWrappedIfAbsent.bind(store),
      putWrapped: store.putWrapped.bind(store),
      async currentVersion(tenantId: string) {
        currentReads += 1;
        return currentReads === 1 ? undefined : store.currentVersion(tenantId);
      },
      setCurrentVersion: store.setCurrentVersion.bind(store),
    };
    const provider = new KmsKeyProvider(
      new LocalKmsClient(KEK),
      staleFirstReadStore,
    );

    expect(await provider.ensureProvisioned("acct_a")).toBe(2);
    expect(currentReads).toBe(2);
    expect(await store.currentVersion("acct_a")).toBe(2);
    winner1.plaintextKey.fill(0);
    winner2.plaintextKey.fill(0);
  });

  test("a CAS-loser marker repair returns a concurrent durable advance, never stale version 1", async () => {
    const store = new InMemoryWrappedKeyStore();
    const local = new LocalKmsClient(KEK);
    const winner1 = await local.generateDataKey("acct_a");
    const winner3 = await local.generateDataKey("acct_a");
    await store.putWrapped("acct_a", 1, winner1.wrappedKey);
    await store.putWrapped("acct_a", 3, winner3.wrappedKey);
    await store.setCurrentVersion("acct_a", 3);

    let currentReads = 0;
    const racingStore: WrappedKeyStore = {
      async getWrapped() {
        return undefined;
      },
      async putWrappedIfAbsent() {
        return false;
      },
      putWrapped: store.putWrapped.bind(store),
      async currentVersion(tenantId) {
        currentReads += 1;
        if (currentReads <= 2) return undefined;
        return store.currentVersion(tenantId);
      },
      async setCurrentVersion(tenantId, keyVersion) {
        await store.setCurrentVersion(tenantId, 3);
        await store.setCurrentVersion(tenantId, keyVersion);
      },
    };
    const provider = new KmsKeyProvider(local, racingStore);

    expect(await provider.ensureProvisioned("acct_a")).toBe(3);
    expect(currentReads).toBe(3);
    expect(await store.currentVersion("acct_a")).toBe(3);
    winner1.plaintextKey.fill(0);
    winner3.plaintextKey.fill(0);
  });

  test("generated plaintext is wiped when the request aborts during durable marker work", async () => {
    const plaintextKey = Buffer.alloc(32, 0x7a);
    const controller = new AbortController();
    let wipedInsideStore = false;
    const store: WrappedKeyStore = {
      async getWrapped() {
        return undefined;
      },
      async putWrappedIfAbsent() {
        controller.abort(new Error("request deadline"));
        wipedInsideStore = plaintextKey.equals(Buffer.alloc(32));
        await Promise.resolve();
        return true;
      },
      async putWrapped() {},
      async currentVersion() {
        return undefined;
      },
      async setCurrentVersion() {},
    };
    const provider = new KmsKeyProvider(
      {
        async generateDataKey() {
          return { plaintextKey, wrappedKey: Buffer.from([1]) };
        },
        async decryptDataKey() {
          throw new Error("not used");
        },
        async scheduleKeyDeletion() {
          return { state: "soft-deleted", irreversible: false };
        },
      },
      store,
      { abortSignal: controller.signal, timeoutMs: 1_000 },
    );
    const pending = provider.ensureProvisioned("acct_a");

    await expect(pending).rejects.toThrow(/request deadline/);
    expect(wipedInsideStore).toBe(true);
    expect(plaintextKey.equals(Buffer.alloc(32))).toBe(true);
  });

  test("recovers an append-only winner after the version marker write fails", async () => {
    const store = new InMemoryWrappedKeyStore();
    const local = new LocalKmsClient(KEK);
    let generations = 0;
    let failMarkerWrite = true;
    const client: KmsClient = {
      async generateDataKey(scope, options) {
        generations += 1;
        void options;
        return local.generateDataKey(scope);
      },
      decryptDataKey: local.decryptDataKey.bind(local),
      scheduleKeyDeletion: local.scheduleKeyDeletion.bind(local),
    };
    const flakyStore = {
      getWrapped: store.getWrapped.bind(store),
      putWrappedIfAbsent: store.putWrappedIfAbsent.bind(store),
      putWrapped: store.putWrapped.bind(store),
      currentVersion: store.currentVersion.bind(store),
      async setCurrentVersion(tenantId: string, keyVersion: number) {
        if (failMarkerWrite) {
          failMarkerWrite = false;
          throw new Error("marker write failed");
        }
        await store.setCurrentVersion(tenantId, keyVersion);
      },
    };
    const provider = new KmsKeyProvider(client, flakyStore);

    await expect(provider.ensureProvisioned("acct_a")).rejects.toThrow(
      "marker write failed",
    );
    expect(await store.getWrapped("acct_a", 1)).toBeDefined();
    expect(await store.currentVersion("acct_a")).toBeUndefined();

    expect(await provider.ensureProvisioned("acct_a")).toBe(1);
    expect(await provider.keyFor("acct_a", 1)).toHaveLength(32);
    expect(generations).toBe(1);
  });

  test("recovers an append-only rotation after the version marker write fails", async () => {
    const store = new InMemoryWrappedKeyStore();
    const local = new LocalKmsClient(KEK);
    let generations = 0;
    let markerWrites = 0;
    const client: KmsClient = {
      async generateDataKey(scope, options) {
        generations += 1;
        void options;
        return local.generateDataKey(scope);
      },
      decryptDataKey: local.decryptDataKey.bind(local),
      scheduleKeyDeletion: local.scheduleKeyDeletion.bind(local),
    };
    const flakyStore = {
      getWrapped: store.getWrapped.bind(store),
      putWrappedIfAbsent: store.putWrappedIfAbsent.bind(store),
      putWrapped: store.putWrapped.bind(store),
      currentVersion: store.currentVersion.bind(store),
      async setCurrentVersion(tenantId: string, keyVersion: number) {
        markerWrites += 1;
        if (markerWrites === 2) throw new Error("rotation marker failed");
        await store.setCurrentVersion(tenantId, keyVersion);
      },
    };
    const provider = new KmsKeyProvider(client, flakyStore);

    expect(await provider.provision("acct_a")).toBe(1);
    await expect(provider.provision("acct_a")).rejects.toThrow(
      "rotation marker failed",
    );
    expect(await store.currentVersion("acct_a")).toBe(1);
    expect(await store.getWrapped("acct_a", 2)).toBeDefined();

    expect(await provider.provision("acct_a")).toBe(2);
    expect(await provider.keyFor("acct_a", 2)).toHaveLength(32);
    expect(generations).toBe(2);
  });

  test("orphan recovery returns a newer durable version instead of its stale candidate", async () => {
    const store = new InMemoryWrappedKeyStore();
    const local = new LocalKmsClient(KEK);
    for (const keyVersion of [1, 2, 3]) {
      const generated = await local.generateDataKey("acct_a");
      await store.putWrapped("acct_a", keyVersion, generated.wrappedKey);
      generated.plaintextKey.fill(0);
    }
    await store.setCurrentVersion("acct_a", 1);

    const racingStore: WrappedKeyStore = {
      getWrapped: store.getWrapped.bind(store),
      putWrappedIfAbsent: store.putWrappedIfAbsent.bind(store),
      putWrapped: store.putWrapped.bind(store),
      currentVersion: store.currentVersion.bind(store),
      async setCurrentVersion(tenantId, keyVersion) {
        if (keyVersion === 2) {
          await store.setCurrentVersion(tenantId, 3);
        }
        await store.setCurrentVersion(tenantId, keyVersion);
      },
    };
    const provider = new KmsKeyProvider(
      {
        async generateDataKey() {
          throw new Error("orphan recovery must not generate");
        },
        decryptDataKey: local.decryptDataKey.bind(local),
        scheduleKeyDeletion: local.scheduleKeyDeletion.bind(local),
      },
      racingStore,
    );

    expect(await provider.provision("acct_a")).toBe(3);
    expect(await store.currentVersion("acct_a")).toBe(3);
  });

  test("concurrent explicit rotations keep one winner and reject the CAS loser", async () => {
    const store = new InMemoryWrappedKeyStore();
    const local = new LocalKmsClient(KEK);
    const first = await local.generateDataKey("acct_a");
    await store.putWrapped("acct_a", 1, first.wrappedKey);
    await store.setCurrentVersion("acct_a", 1);
    first.plaintextKey.fill(0);

    let generated = 0;
    let releaseBoth!: () => void;
    const bothGenerating = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    const plaintextKeys: Buffer[] = [];
    const client: KmsClient = {
      async generateDataKey() {
        generated += 1;
        const marker = generated;
        const plaintextKey = Buffer.alloc(32, marker);
        plaintextKeys.push(plaintextKey);
        if (generated === 2) releaseBoth();
        await bothGenerating;
        return {
          plaintextKey,
          wrappedKey: Buffer.alloc(48, marker),
        };
      },
      decryptDataKey: local.decryptDataKey.bind(local),
      scheduleKeyDeletion: local.scheduleKeyDeletion.bind(local),
    };
    const provider = new KmsKeyProvider(client, store);

    const outcomes = await Promise.allSettled([
      provider.provision("acct_a"),
      provider.provision("acct_a"),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(Error);
    expect((rejected?.reason as Error).message).toMatch(
      /concurrent rotation|append-only/i,
    );
    expect(await store.currentVersion("acct_a")).toBe(2);
    expect(await store.getWrapped("acct_a", 2)).toBeDefined();
    expect(plaintextKeys).toHaveLength(2);
    expect(
      plaintextKeys.every((key) => key.equals(Buffer.alloc(key.length))),
    ).toBe(true);
  });

  test("rejects an empty tenant before any KMS or persistence operation", async () => {
    let kmsCalls = 0;
    let storeCalls = 0;
    const client: KmsClient = {
      async generateDataKey() {
        kmsCalls += 1;
        return {
          plaintextKey: Buffer.alloc(32, 0x11),
          wrappedKey: Buffer.alloc(48, 0x22),
        };
      },
      async decryptDataKey() {
        kmsCalls += 1;
        return Buffer.alloc(32, 0x33);
      },
      async scheduleKeyDeletion() {
        kmsCalls += 1;
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const store: WrappedKeyStore = {
      async getWrapped() {
        storeCalls += 1;
        return undefined;
      },
      async putWrappedIfAbsent() {
        storeCalls += 1;
        return true;
      },
      async putWrapped() {
        storeCalls += 1;
      },
      async currentVersion() {
        storeCalls += 1;
        return undefined;
      },
      async setCurrentVersion() {
        storeCalls += 1;
      },
    };
    const provider = new KmsKeyProvider(client, store);
    const operations = [
      () => provider.provision(""),
      () => provider.ensureProvisioned(""),
      () => provider.keyFor("", 1),
      () => provider.currentVersion(""),
      () => provider.scheduleKeyDeletion(""),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toThrow(/tenantId is required/i);
    }
    expect(kmsCalls).toBe(0);
    expect(storeCalls).toBe(0);
  });

  test("rejects malformed generated KMS material before immutable storage", async () => {
    const cases: Array<{
      readonly plaintextKey: unknown;
      readonly wrappedKey: unknown;
      readonly message: RegExp;
    }> = [
      {
        plaintextKey: Buffer.alloc(31, 0x11),
        wrappedKey: Buffer.from([1]),
        message: /32-byte AES-256 DEK/i,
      },
      {
        plaintextKey: Buffer.alloc(33, 0x22),
        wrappedKey: Buffer.from([1]),
        message: /32-byte AES-256 DEK/i,
      },
      {
        plaintextKey: new Uint8Array(32).fill(0x55),
        wrappedKey: Buffer.from([1]),
        message: /32-byte AES-256 DEK/i,
      },
      {
        plaintextKey: Buffer.alloc(32, 0x33),
        wrappedKey: Buffer.alloc(0),
        message: /non-empty wrapped DEK/i,
      },
    ];

    for (const candidate of cases) {
      const store = new InMemoryWrappedKeyStore();
      const client = {
        async generateDataKey() {
          return candidate;
        },
        async decryptDataKey() {
          throw new Error("not used");
        },
        async scheduleKeyDeletion() {
          return { state: "soft-deleted", irreversible: false } as const;
        },
      } as unknown as KmsClient;
      const provider = new KmsKeyProvider(client, store);

      await expect(provider.provision("acct_a")).rejects.toThrow(
        candidate.message,
      );
      expect(await store.getWrapped("acct_a", 1)).toBeUndefined();
      expect(await store.currentVersion("acct_a")).toBeUndefined();
      if (candidate.plaintextKey instanceof Uint8Array) {
        expect(candidate.plaintextKey.every((byte) => byte === 0)).toBe(true);
      }
    }
  });

  test("rejects and zeroizes malformed unwrapped KMS material", async () => {
    const store = new InMemoryWrappedKeyStore();
    await store.putWrapped("acct_a", 1, Buffer.from([1]));
    await store.setCurrentVersion("acct_a", 1);
    const malformed = Buffer.alloc(31, 0x44);
    const client: KmsClient = {
      async generateDataKey() {
        throw new Error("not used");
      },
      async decryptDataKey() {
        return malformed;
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const provider = new KmsKeyProvider(client, store);

    await expect(provider.keyFor("acct_a", 1)).rejects.toThrow(
      /32-byte AES-256 DEK/i,
    );
    expect(malformed.equals(Buffer.alloc(31))).toBe(true);
  });

  test("rejects and zeroizes non-Buffer unwrapped KMS material", async () => {
    const store = new InMemoryWrappedKeyStore();
    await store.putWrapped("acct_a", 1, Buffer.from([1]));
    await store.setCurrentVersion("acct_a", 1);
    const malformed = new Uint8Array(32).fill(0x66);
    const client = {
      async generateDataKey() {
        throw new Error("not used");
      },
      async decryptDataKey() {
        return malformed;
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false } as const;
      },
    } as unknown as KmsClient;
    const provider = new KmsKeyProvider(client, store);

    await expect(provider.keyFor("acct_a", 1)).rejects.toThrow(
      /32-byte AES-256 DEK/i,
    );
    expect(malformed.every((byte) => byte === 0)).toBe(true);
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

  test("refuses destructive deletion for an unprovisioned scope before calling KMS", async () => {
    let deletionCalls = 0;
    const client: KmsClient = {
      async generateDataKey() {
        throw new Error("not used");
      },
      async decryptDataKey() {
        throw new Error("not used");
      },
      async scheduleKeyDeletion() {
        deletionCalls += 1;
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const provider = new KmsKeyProvider(client, new InMemoryWrappedKeyStore());

    await expect(provider.scheduleKeyDeletion("acct_a")).rejects.toThrow(
      /no provisioned KMS key/i,
    );
    expect(deletionCalls).toBe(0);
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

  test("TenantFieldCrypto zeroizes caller-owned key buffers on success and failure", async () => {
    const encryptionKey = Buffer.alloc(32, 0x4a);
    const encryptionProvider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return encryptionKey;
      },
    };
    const sealed = await new TenantFieldCrypto(encryptionProvider).encryptField(
      "acct_a",
      "phi-secret",
      "patient.note",
    );
    expect(encryptionKey.equals(Buffer.alloc(32))).toBe(true);

    const decryptionKey = Buffer.alloc(32, 0x4a);
    const decryptionProvider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return decryptionKey;
      },
    };
    expect(
      await new TenantFieldCrypto(decryptionProvider).decryptField(
        "acct_a",
        sealed,
        "patient.note",
      ),
    ).toBe("phi-secret");
    expect(decryptionKey.equals(Buffer.alloc(32))).toBe(true);

    const rejectedKey = Buffer.alloc(32, 0x4a);
    const rejectedProvider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return rejectedKey;
      },
    };
    await expect(
      new TenantFieldCrypto(rejectedProvider).decryptField(
        "acct_a",
        sealed,
        "patient.other",
      ),
    ).rejects.toThrow();
    expect(rejectedKey.equals(Buffer.alloc(32))).toBe(true);
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

  test("LocalKmsClient deletion receipt stays truthful across reinstantiation", async () => {
    const first = new LocalKmsClient(KEK);
    const generated = await first.generateDataKey("acct_a");
    const deletion = await first.scheduleKeyDeletion("acct_a");

    expect(deletion).toEqual({
      state: "soft-deleted",
      irreversible: false,
    });
    await expect(
      first.decryptDataKey("acct_a", generated.wrappedKey),
    ).rejects.toThrow(/soft-deleted for this client instance/);

    // The local tombstone is process-memory only. Recreating the client with the same master
    // recovers the derived KEK, so this backend must never claim irreversible destruction.
    const restarted = new LocalKmsClient(KEK);
    expect(
      (await restarted.decryptDataKey("acct_a", generated.wrappedKey)).equals(
        generated.plaintextKey,
      ),
    ).toBe(true);
  });
});

describe("DbWrappedKeyStore (P2 DB-backed WrappedKeyStore)", () => {
  test("atomically preserves the first append-only winner under concurrent puts", async () => {
    const data = new Map<string, string>();
    const kv: KeyValueStore = {
      async get(key) {
        return data.get(key);
      },
      async put(key, value) {
        data.set(key, value);
      },
      async putIfAbsent(key, value) {
        if (data.has(key)) return false;
        data.set(key, value);
        return true;
      },
      async compareAndSwap(key, expected, next) {
        if (data.get(key) !== expected) return false;
        data.set(key, next);
        return true;
      },
    };
    const store = new DbWrappedKeyStore(kv);
    const first = Buffer.alloc(48, 0x11);
    const second = Buffer.alloc(48, 0x22);

    const outcomes = await Promise.allSettled([
      store.putWrapped("acct_a", 1, first),
      store.putWrapped("acct_a", 1, second),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    const winner = await store.getWrapped("acct_a", 1);
    expect(winner?.equals(first) || winner?.equals(second)).toBe(true);
  });

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

  test("current-version writes are monotonic and malformed durable markers fail closed", async () => {
    const store = new DbWrappedKeyStore(fakeKv());
    await store.setCurrentVersion("acct_a", 3);
    await store.setCurrentVersion("acct_a", 2);
    expect(await store.currentVersion("acct_a")).toBe(3);

    const malformed = fakeKv();
    await malformed.put("field-crypto:current:acct_a", "NaN");
    await expect(
      new DbWrappedKeyStore(malformed).currentVersion("acct_a"),
    ).rejects.toThrow(/invalid stored key version/i);
  });

  test("generic stores reject empty tenants and in-memory reads cannot mutate stored bytes", async () => {
    for (const store of [
      new InMemoryWrappedKeyStore(),
      new DbWrappedKeyStore(fakeKv()),
    ]) {
      await expect(store.getWrapped("", 1)).rejects.toThrow(
        /tenantId is required/i,
      );
      await expect(
        store.putWrapped("", 1, Buffer.from("wrapped")),
      ).rejects.toThrow(/tenantId is required/i);
      await expect(
        store.putWrappedIfAbsent("", 1, Buffer.from("wrapped")),
      ).rejects.toThrow(/tenantId is required/i);
      await expect(store.currentVersion("")).rejects.toThrow(
        /tenantId is required/i,
      );
      await expect(store.setCurrentVersion("", 1)).rejects.toThrow(
        /tenantId is required/i,
      );
    }

    const memory = new InMemoryWrappedKeyStore();
    const original = Buffer.from("append-only-wrapped-dek");
    await memory.putWrapped("acct_a", 1, original);
    const exposed = await memory.getWrapped("acct_a", 1);
    exposed?.fill(0);
    expect(await memory.getWrapped("acct_a", 1)).toEqual(original);
  });

  test("a stale orphan-recovery marker cannot move current backward", async () => {
    const memory = new InMemoryWrappedKeyStore();
    await memory.setCurrentVersion("acct_a", 3);
    await memory.setCurrentVersion("acct_a", 2);
    expect(await memory.currentVersion("acct_a")).toBe(3);

    const db = new DbWrappedKeyStore(fakeKv());
    await db.setCurrentVersion("acct_a", 3);
    await db.setCurrentVersion("acct_a", 2);
    expect(await db.currentVersion("acct_a")).toBe(3);
  });

  test("a failed marker CAS re-reads a concurrently advanced durable version", async () => {
    const data = new Map<string, string>([
      ["field-crypto:current:acct_a", "1"],
    ]);
    let firstCas = true;
    const kv: KeyValueStore = {
      async get(key) {
        return data.get(key);
      },
      async put(key, value) {
        data.set(key, value);
      },
      async putIfAbsent(key, value) {
        if (data.has(key)) return false;
        data.set(key, value);
        return true;
      },
      async compareAndSwap(key, expected, next) {
        if (firstCas) {
          firstCas = false;
          data.set(key, "3");
        }
        if (data.get(key) !== expected) return false;
        data.set(key, next);
        return true;
      },
    };
    const store = new DbWrappedKeyStore(kv);

    await store.setCurrentVersion("acct_a", 2);

    expect(await store.currentVersion("acct_a")).toBe(3);
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
