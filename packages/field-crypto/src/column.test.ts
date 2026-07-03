import { describe, expect, test } from "bun:test";
import { DerivedKeyProvider } from "./provider.ts";
import {
  currentFieldCryptoContext,
  derivedContext,
  openField,
  sealField,
  withFieldCryptoContext,
} from "./column.ts";
import { parseEnvelope } from "./envelope.ts";

const MASTER = Buffer.alloc(32, 0x11);
const SALT = Buffer.alloc(32, 0x22);

function freshProvider(): DerivedKeyProvider {
  return new DerivedKeyProvider(MASTER, SALT);
}

describe("encrypted column seam (sealField / openField)", () => {
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
