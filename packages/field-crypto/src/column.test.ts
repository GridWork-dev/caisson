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
