import { describe, expect, test } from "bun:test";
import { DerivedKeyProvider } from "./provider.ts";
import {
  type FieldCryptoContext,
  currentFieldCryptoContext,
  derivedContext,
  kmsContext,
  openField,
  sealField,
  withFieldCryptoContext,
  withKmsFieldCryptoContext,
} from "./column.ts";
import { parseEnvelope } from "./envelope.ts";
import {
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  LocalKmsClient,
} from "./kms.ts";
import type { FieldKeyProvider } from "./provider.ts";

const MASTER = Buffer.alloc(32, 0x11);
const SALT = Buffer.alloc(32, 0x22);

function freshProvider(): DerivedKeyProvider {
  return new DerivedKeyProvider(MASTER, SALT);
}

describe("encrypted column seam (sealField / openField)", () => {
  test("generic operations never mutate a context-owned cached key", () => {
    // A context that lends its own cached buffer directly, with no defensive copy of its own.
    // Under `withKey` the generic operations never wipe what they are lent — the lender decides —
    // so this invariant now holds by construction rather than by each operation copying first.
    const cachedKey = Buffer.alloc(32, 0x6a);
    const ctx: FieldCryptoContext = {
      tenantId: "acct_cached",
      withKey: (_keyVersion, use) => use(cachedKey),
      currentVersion: () => 1,
    };

    const first = sealField(ctx, "patient.ssn", "first");
    const second = sealField(ctx, "patient.ssn", "second");

    expect(cachedKey.equals(Buffer.alloc(32, 0x6a))).toBe(true);
    expect(openField(ctx, "patient.ssn", first)).toBe("first");
    expect(openField(ctx, "patient.ssn", second)).toBe("second");
    expect(cachedKey.equals(Buffer.alloc(32, 0x6a))).toBe(true);
  });

  test("derivedContext fails closed when a provider hands back a cached, already-zeroed key", () => {
    // A caching SyncFieldKeyProvider violates the OWNERSHIP contract, and `derivedContext` wipes
    // what it is given in place. Without a guard the FIRST operation zeroes the provider's cache
    // and every later write encrypts under an all-zero key — which decrypts fine, so the tenant
    // silently stores data under a publicly known key with every check green. It must be loud.
    const sharedCache = Buffer.alloc(32, 0x5b);
    const cachingProvider = {
      deriveKey: () => sharedCache,
      currentVersionSync: () => 1,
      keyFor: async () => Buffer.from(sharedCache),
      currentVersion: async () => 1,
    };
    const ctx = derivedContext(cachingProvider, "acct_caching");

    // First op succeeds and wipes the provider's cache, as the contract permits it to.
    expect(sealField(ctx, "patient.ssn", "first")).toBeTruthy();
    expect(sharedCache.equals(Buffer.alloc(32))).toBe(true);
    // The second must refuse rather than encrypt under all zeroes.
    expect(() => sealField(ctx, "patient.ssn", "second")).toThrow(
      /all-zero key/i,
    );
  });

  test("withKey refuses an async callback and adopts its orphaned rejection", async () => {
    // `use` returns at its first await, so the key is zeroized while the continuation still means
    // to use it. Silently that yields valid-looking ciphertext under an all-zero key — but the
    // guard that makes it loud must not itself be fatal: `use()` has ALREADY produced a live
    // pending promise, and a REJECTING one with no handler is an unhandled rejection, which Node
    // terminates the process over. A resolving promise would not exercise this at all.
    const ctx = derivedContext(freshProvider(), "acct_async");

    // Probe with a hand-rolled thenable rather than a real promise: it records whether the guard
    // attached a rejection handler BEFORE throwing. Asserting on `unhandledRejection` instead
    // would be non-deterministic under `bun test` — that listener does not fire reliably here, so
    // a test written that way passes against the un-fixed code and proves nothing.
    const rejectionHandlers: unknown[] = [];
    const thenable = {
      then(_onFulfilled: unknown, onRejected: unknown) {
        rejectionHandlers.push(onRejected);
      },
    };

    expect(() =>
      ctx.withKey(1, (() => thenable) as unknown as (key: Buffer) => number),
    ).toThrow(/must be synchronous/i);
    expect(rejectionHandlers).toHaveLength(1);
    expect(typeof rejectionHandlers[0]).toBe("function");

    // A real rejecting promise must not take the process down either.
    const orphaned: unknown[] = [];
    const capture = (reason: unknown): void => {
      orphaned.push(reason);
    };
    process.on("unhandledRejection", capture);
    try {
      expect(() =>
        ctx.withKey(1, ((): Promise<number> =>
          Promise.reject(
            new Error("continuation ran against a zeroized key"),
          )) as unknown as (key: Buffer) => number),
      ).toThrow(/must be synchronous/i);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(orphaned).toEqual([]);
    } finally {
      process.off("unhandledRejection", capture);
    }

    // An iterable return is legitimate and must NOT be rejected.
    expect(ctx.withKey(1, (key) => [key.length])).toEqual([32]);
  });

  test("seal → open round-trips under the same context", () => {
    const ctx = derivedContext(freshProvider(), "acct_a");
    const sealed = sealField(ctx, "patient.ssn", "424-12-9999");
    expect(sealed).not.toContain("424-12-9999"); // encrypted at rest
    expect(openField(ctx, "patient.ssn", sealed)).toBe("424-12-9999");
  });

  test("another tenant's context cannot open the value (cross-tenant isolation)", () => {
    const provider = freshProvider();
    const a = derivedContext(provider, "acct_a");
    const b = derivedContext(provider, "acct_b");
    const sealed = sealField(a, "patient.ssn", "secret");
    expect(() => openField(b, "patient.ssn", sealed)).toThrow();
  });

  test("a different columnContext cannot open the value", () => {
    const ctx = derivedContext(freshProvider(), "acct_a");
    const sealed = sealField(ctx, "patient.ssn", "secret");
    expect(() => openField(ctx, "patient.mrn", sealed)).toThrow();
  });

  test("no bound context is fail-closed (refuses to encrypt/decrypt unscoped)", () => {
    expect(() => currentFieldCryptoContext()).toThrow(/fail-closed/);
  });

  test("withFieldCryptoContext binds the ambient tenant for the column", () => {
    const ctx = derivedContext(freshProvider(), "acct_a");
    withFieldCryptoContext(ctx, () => {
      const bound = currentFieldCryptoContext();
      expect(bound.tenantId).toBe("acct_a");
      const sealed = sealField(bound, "c", "x");
      expect(openField(bound, "c", sealed)).toBe("x");
    });
  });

  test("rotation: a v1 value still opens after the tenant rotates to v2; new writes use v2", () => {
    const provider = freshProvider();
    const ctx = derivedContext(provider, "acct_a");
    const v1Sealed = sealField(ctx, "c", "old");
    expect(parseEnvelope(v1Sealed).keyVersion).toBe(1);

    provider.registry.rotate("acct_a"); // → v2
    expect(openField(ctx, "c", v1Sealed)).toBe("old"); // old value still decrypts

    const v2Sealed = sealField(ctx, "c", "new");
    expect(parseEnvelope(v2Sealed).keyVersion).toBe(2); // new write uses the new version
    expect(openField(ctx, "c", v2Sealed)).toBe("new");

    // No-remigration invariant, made explicit: rotation actually changed the key material (not
    // just a version label) — v1 rows keep decrypting under their OWN recorded key, forever, with
    // zero bulk re-encrypt of existing data.
    expect(
      provider.deriveKey("acct_a", 1).equals(provider.deriveKey("acct_a", 2)),
    ).toBe(false);
  });
});

describe("request-scoped KMS context", () => {
  test("a value sealed under version N stays readable after currentVersion advances", async () => {
    const provider = new KmsKeyProvider(
      new LocalKmsClient(Buffer.alloc(32, 0x77)),
      new InMemoryWrappedKeyStore(),
    );
    await provider.provision("acct_a");

    const v1Sealed = await withKmsFieldCryptoContext(
      provider,
      "acct_a",
      (ctx) => sealField(ctx, "patient.ssn", "old"),
    );
    expect(parseEnvelope(v1Sealed).keyVersion).toBe(1);

    await provider.provision("acct_a");
    await withKmsFieldCryptoContext(provider, "acct_a", (ctx) => {
      expect(openField(ctx, "patient.ssn", v1Sealed)).toBe("old");
      expect(
        parseEnvelope(sealField(ctx, "patient.ssn", "new")).keyVersion,
      ).toBe(2);
    });
  });

  test("an unwrap failure fails closed and zeroizes keys already resolved", async () => {
    const resolvedV1 = Buffer.alloc(32, 0x41);
    const unwrapFailure = new Error("azure unwrap unavailable");
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 2;
      },
      async keyFor(_tenantId, version) {
        if (version === 1) return resolvedV1;
        throw unwrapFailure;
      },
    };

    await expect(kmsContext(provider, "acct_a")).rejects.toBe(unwrapFailure);
    expect(resolvedV1.equals(Buffer.alloc(32))).toBe(true);
  });

  test("even an undefined rejection fails context construction closed", async () => {
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return Promise.reject(undefined);
      },
    };

    await expect(kmsContext(provider, "acct_a")).rejects.toThrow(
      /rejected a DEK unwrap without an error/,
    );
  });

  test("prefetch bounds concurrent unwraps while preserving every historical version", async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 9;
      },
      async keyFor(_tenantId, version) {
        active += 1;
        peak = Math.max(peak, active);
        seen.push(version);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return Buffer.alloc(32, version);
      },
    };

    const ctx = await kmsContext(provider, "acct_a");
    try {
      expect(peak).toBeLessThanOrEqual(4);
      expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(ctx.withKey(1, (key) => Buffer.from(key))).toEqual(
        Buffer.alloc(32, 1),
      );
      expect(ctx.withKey(9, (key) => Buffer.from(key))).toEqual(
        Buffer.alloc(32, 9),
      );
    } finally {
      ctx.dispose();
    }
  });

  test("a malformed provider value wipes every prior byte view before failing closed", async () => {
    const resolvedV1 = Buffer.alloc(32, 0x61);
    const malformed = new Uint8Array(32).fill(0x62);
    const provider = {
      async currentVersion() {
        return 2;
      },
      async keyFor(_tenantId: string, version: number): Promise<unknown> {
        return version === 1 ? resolvedV1 : malformed;
      },
    } as unknown as FieldKeyProvider;

    await expect(kmsContext(provider, "acct_a")).rejects.toThrow(
      /invalid provider DEK|32-byte Buffer/i,
    );
    expect(resolvedV1.equals(Buffer.alloc(32))).toBe(true);
    expect(malformed).toEqual(new Uint8Array(32));
  });

  test("an abort disposes prefetched and escaped keys before the callback settles", async () => {
    const unwrapped = Buffer.alloc(32, 0x71);
    const controller = new AbortController();
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return unwrapped;
      },
    };
    let escaped: Buffer | undefined;

    const pending = withKmsFieldCryptoContext(
      provider,
      "acct_a",
      async (ctx) => {
        escaped = ctx.withKey(1, (key) => key);
        // Already zeroed here: the lend ended when the callback returned, long before dispose.
        expect(escaped.equals(Buffer.alloc(32))).toBe(true);
        controller.abort(new Error("request deadline"));
        expect(() => ctx.withKey(1, (key) => key)).toThrow(/disposed/);
        await Promise.resolve();
      },
      { abortSignal: controller.signal },
    );

    await expect(pending).rejects.toThrow(/request deadline/);
    expect(unwrapped.equals(Buffer.alloc(32))).toBe(true);
    expect(escaped?.equals(Buffer.alloc(32))).toBe(true);
  });

  test("dispose() during an active lend wipes it and refuses the result", async () => {
    // A lend that is mid-callback has not reached its `finally`, so self-wiping completed lends is
    // not enough — dispose has to reach the in-flight one. And once it has, everything the callback
    // computes afterwards ran against an all-zero key, so the result must not be handed back.
    const unwrapped = Buffer.alloc(32, 0x44);
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return unwrapped;
      },
    };
    const ctx = await kmsContext(provider, "acct_dispose");
    let keyDuringDispose: Buffer | undefined;

    expect(() =>
      ctx.withKey(1, (key) => {
        ctx.dispose();
        keyDuringDispose = key;
        return "computed after disposal";
      }),
    ).toThrow(/disposed during the operation/i);

    expect(keyDuringDispose?.equals(Buffer.alloc(32))).toBe(true);
  });

  test("an abort raised inside a lend wipes it and refuses the result", async () => {
    const unwrapped = Buffer.alloc(32, 0x45);
    const controller = new AbortController();
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return unwrapped;
      },
    };
    const ctx = await kmsContext(provider, "acct_abort_lend", {
      abortSignal: controller.signal,
    });
    let keyAfterAbort: Buffer | undefined;

    expect(() =>
      ctx.withKey(1, (key) => {
        // The abort listener disposes synchronously, so this lands mid-lend.
        controller.abort(new Error("request deadline"));
        keyAfterAbort = key;
        return "computed after abort";
      }),
    ).toThrow(/disposed during the operation/i);

    expect(keyAfterAbort?.equals(Buffer.alloc(32))).toBe(true);
  });

  test("no plaintext DEK survives the request scope", async () => {
    const unwrapped = Buffer.alloc(32, 0x52);
    const provider: FieldKeyProvider = {
      async currentVersion() {
        return 1;
      },
      async keyFor() {
        return unwrapped;
      },
    };
    let captured: FieldCryptoContext | undefined;
    let escapedWorkingKey: Buffer | undefined;

    await withKmsFieldCryptoContext(provider, "acct_a", (ctx) => {
      captured = ctx;
      expect(currentFieldCryptoContext()).toBe(ctx);
      escapedWorkingKey = ctx.withKey(1, (key) => key);
      // ADR-0393: a lent copy dies with ITS OPERATION, inside the request — not at dispose. A
      // caller that smuggles the reference out of the callback finds it already zeroed.
      expect(escapedWorkingKey.equals(Buffer.alloc(32))).toBe(true);
      const sealed = sealField(ctx, "patient.ssn", "secret");
      expect(openField(ctx, "patient.ssn", sealed)).toBe("secret");
    });

    expect(unwrapped.equals(Buffer.alloc(32))).toBe(true);
    expect(escapedWorkingKey?.equals(Buffer.alloc(32))).toBe(true);
    expect(() => captured?.withKey(1, (key) => key)).toThrow(/disposed/);
    expect(() => currentFieldCryptoContext()).toThrow(/fail-closed/);
  });
});

describe("kmsContext prefetch depth cap", () => {
  // Prefetch-all makes every bind pay for the tenant's whole rotation history, so rotation depth
  // and request latency are coupled. Past the cap the failure names the depth, rather than
  // surfacing later as an anonymous request-deadline timeout that diagnoses nothing.
  function providerAtVersion(version: number): FieldKeyProvider {
    return {
      async currentVersion() {
        return version;
      },
      async keyFor() {
        return Buffer.alloc(32, 0x5a);
      },
    };
  }

  test("refuses a tenant rotated past the cap, naming the depth and the limit", async () => {
    await expect(
      kmsContext(providerAtVersion(9), "acct_deep", { maxPrefetchVersions: 8 }),
    ).rejects.toThrow(
      /rotated to key version 9[\s\S]*8-version prefetch limit/,
    );
  });

  test("still binds a tenant sitting exactly at the cap", async () => {
    const ctx = await kmsContext(providerAtVersion(8), "acct_edge", {
      maxPrefetchVersions: 8,
    });
    try {
      expect(ctx.currentVersion()).toBe(8);
      expect(ctx.withKey(1, (key) => key.length)).toBe(32);
    } finally {
      ctx.dispose();
    }
  });

  test("rejects a nonsensical cap instead of silently defaulting", async () => {
    await expect(
      kmsContext(providerAtVersion(1), "acct_bad", { maxPrefetchVersions: 0 }),
    ).rejects.toThrow(/maxPrefetchVersions/);
  });
});
