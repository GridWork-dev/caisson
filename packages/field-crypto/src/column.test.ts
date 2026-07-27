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
    const cachedKey = Buffer.alloc(32, 0x6a);
    const ctx: FieldCryptoContext = {
      tenantId: "acct_cached",
      deriveKey: () => cachedKey,
      currentVersion: () => 1,
    };

    const first = sealField(ctx, "patient.ssn", "first");
    const second = sealField(ctx, "patient.ssn", "second");

    expect(cachedKey.equals(Buffer.alloc(32, 0x6a))).toBe(true);
    expect(openField(ctx, "patient.ssn", first)).toBe("first");
    expect(openField(ctx, "patient.ssn", second)).toBe("second");
    expect(cachedKey.equals(Buffer.alloc(32, 0x6a))).toBe(true);
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
      expect(ctx.deriveKey(1)).toEqual(Buffer.alloc(32, 1));
      expect(ctx.deriveKey(9)).toEqual(Buffer.alloc(32, 9));
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
        escaped = ctx.deriveKey(1);
        controller.abort(new Error("request deadline"));
        expect(() => ctx.deriveKey(1)).toThrow(/disposed/);
        await Promise.resolve();
      },
      { abortSignal: controller.signal },
    );

    await expect(pending).rejects.toThrow(/request deadline/);
    expect(unwrapped.equals(Buffer.alloc(32))).toBe(true);
    expect(escaped?.equals(Buffer.alloc(32))).toBe(true);
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
      escapedWorkingKey = ctx.deriveKey(1);
      const sealed = sealField(ctx, "patient.ssn", "secret");
      expect(openField(ctx, "patient.ssn", sealed)).toBe("secret");
    });

    expect(unwrapped.equals(Buffer.alloc(32))).toBe(true);
    expect(escapedWorkingKey?.equals(Buffer.alloc(32))).toBe(true);
    expect(() => captured?.deriveKey(1)).toThrow(/disposed/);
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
    ).rejects.toThrow(/rotated to key version 9[\s\S]*8-version prefetch limit/);
  });

  test("still binds a tenant sitting exactly at the cap", async () => {
    const ctx = await kmsContext(providerAtVersion(8), "acct_edge", {
      maxPrefetchVersions: 8,
    });
    try {
      expect(ctx.currentVersion()).toBe(8);
      expect(ctx.deriveKey(1)).toHaveLength(32);
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
