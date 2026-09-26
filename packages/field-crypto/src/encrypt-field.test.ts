import { describe, expect, test } from "bun:test";
import { createCipheriv, createHash } from "node:crypto";
import { matchGolden } from "@caisson-sh/testing";
import { type AeadCipher, type AeadParts, aesGcm } from "./cipher.ts";
import { ALG_AES_256_GCM, NONCE_BYTES } from "./envelope.ts";
import { TENANT_KEY_BYTES } from "./derive.ts";
import { buildAad } from "./aad.ts";
import type { FieldCryptoContext } from "./column.ts";
import { decryptField, encryptField } from "./encrypt-field.ts";

// A test FieldCryptoContext whose key is deterministic per tenant (so cross-tenant decrypts hit a
// different key, mirroring the per-tenant HKDF derivation without pulling in the real provider).
function keyForTenant(tenantId: string): Buffer {
  return createHash("sha256").update(`field-key:${tenantId}`).digest();
}
function ctxFor(tenantId: string, version = 1): FieldCryptoContext {
  return {
    tenantId,
    withKey: (_keyVersion, use) => use(keyForTenant(tenantId)),
    currentVersion: () => version,
  };
}

const COL = "patient.ssn";
const ROW = "00000000-0000-4000-8000-000000000001"; // a crypto.randomUUID()-shaped PK
const OTHER_ROW = "00000000-0000-4000-8000-000000000002";
const SSN = "078-05-1120";

describe("encryptField (row-bound AAD, ADR-0055 — TM-E)", () => {
  test("generic row-bound operations never mutate a context-owned cached key", () => {
    const cachedKey = keyForTenant("acct_cached");
    const original = Buffer.from(cachedKey);
    // Lends its cached buffer directly, with no defensive copy. The generic row-bound operations
    // must not wipe what they are lent — under `withKey` the lender owns that decision.
    const ctx: FieldCryptoContext = {
      tenantId: "acct_cached",
      withKey: (_keyVersion, use) => use(cachedKey),
      currentVersion: () => 1,
    };

    const first = encryptField(ctx, COL, ROW, "first");
    const second = encryptField(ctx, COL, OTHER_ROW, "second");

    expect(cachedKey.equals(original)).toBe(true);
    expect(decryptField(ctx, COL, ROW, first)).toBe("first");
    expect(decryptField(ctx, COL, OTHER_ROW, second)).toBe("second");
    expect(cachedKey.equals(original)).toBe(true);
  });

  test("round-trips a SEC/HIPAA field for the same tenant/column/row", () => {
    const ctx = ctxFor("acct_a");
    const sealed = encryptField(ctx, COL, ROW, SSN);
    expect(decryptField(ctx, COL, ROW, sealed)).toBe(SSN);
  });

  test("runs the cipher on the lent buffer without copying it out of the lend", () => {
    const cachedKey = keyForTenant("acct_a");
    const workingCopies: Buffer[] = [];
    // NOTE the boundary this test actually covers: the zeroization asserted below is performed by
    // THIS mock's own `finally`, not by `encryptField`. What it pins is that the operation runs the
    // cipher on the buffer it was lent and does not copy it out of scope — rewrite `encryptField`
    // to stash a copy and the assertion fails. Production zeroization is covered against the real
    // contexts in column.test.ts.
    const ctx: FieldCryptoContext = {
      tenantId: "acct_a",
      withKey(_keyVersion, use) {
        const lent = Buffer.from(cachedKey);
        try {
          return use(lent);
        } finally {
          lent.fill(0);
        }
      },
      currentVersion: () => 1,
    };
    const observingCipher: AeadCipher = {
      algId: aesGcm.algId,
      encrypt(key, plaintext, aad) {
        workingCopies.push(key);
        return aesGcm.encrypt(key, plaintext, aad);
      },
      decrypt(key, parts, aad) {
        workingCopies.push(key);
        return aesGcm.decrypt(key, parts, aad);
      },
    };

    const sealed = encryptField(ctx, COL, ROW, SSN, observingCipher);
    expect(workingCopies[0]?.equals(Buffer.alloc(32))).toBe(true);
    expect(decryptField(ctx, COL, ROW, sealed)).toBe(SSN);
    expect(cachedKey.equals(keyForTenant("acct_a"))).toBe(true);
  });

  test("a cross-row relocate fails to authenticate (TM-E, closes TM2)", () => {
    const ctx = ctxFor("acct_a");
    const sealed = encryptField(ctx, COL, ROW, SSN);
    // Same tenant, same column, same key version — only the row id differs. The 4-tuple AAD no
    // longer matches, so the swapped/rolled-back cell fails AEAD authentication.
    expect(() => decryptField(ctx, COL, OTHER_ROW, sealed)).toThrow();
  });

  test("a cross-column relocate fails to authenticate", () => {
    const ctx = ctxFor("acct_a");
    const sealed = encryptField(ctx, COL, ROW, SSN);
    expect(() => decryptField(ctx, "patient.mrn", ROW, sealed)).toThrow();
  });

  test("a cross-tenant decrypt fails (different derived key AND AAD)", () => {
    const sealed = encryptField(ctxFor("acct_a"), COL, ROW, SSN);
    expect(() => decryptField(ctxFor("acct_b"), COL, ROW, sealed)).toThrow();
  });

  test("an old key version still decrypts after rotation (self-describing envelope)", () => {
    // Encrypt under v1, then the tenant rotates to v2 (but deriveKey here is version-independent,
    // so the v1 key is still reachable). The version comes from the envelope, not the context.
    const sealedV1 = encryptField(ctxFor("acct_a", 1), COL, ROW, SSN);
    expect(decryptField(ctxFor("acct_a", 2), COL, ROW, sealedV1)).toBe(SSN);
  });

  test("rejects a missing/blank rowId (fail-closed, no degenerate binding)", () => {
    const ctx = ctxFor("acct_a");
    expect(() => encryptField(ctx, COL, "", SSN)).toThrow(/rowId/);
    expect(() => encryptField(ctx, COL, "   ", SSN)).toThrow(/rowId/);
    const sealed = encryptField(ctx, COL, ROW, SSN);
    expect(() => decryptField(ctx, COL, "", sealed)).toThrow(/rowId/);
  });

  test("a tampered envelope fails to authenticate", () => {
    const ctx = ctxFor("acct_a");
    const sealed = encryptField(ctx, COL, ROW, SSN);
    const buf = Buffer.from(sealed, "base64");
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff; // flip a tag byte
    expect(() => decryptField(ctx, COL, ROW, buf.toString("base64"))).toThrow();
  });

  test("golden: the 4-tuple AAD + a deterministic row-bound envelope are pinned", () => {
    // A fixed-nonce cipher makes the AES-256-GCM output deterministic for the golden (production
    // uses a fresh CSPRNG nonce per encrypt). The key is fixed via the deterministic test context.
    const fixedNonce = Buffer.alloc(NONCE_BYTES, 0xab);
    const fixedNonceCipher: AeadCipher = {
      algId: ALG_AES_256_GCM,
      encrypt(key: Buffer, plaintext: Buffer, aad: Buffer): AeadParts {
        const c = createCipheriv("aes-256-gcm", key, fixedNonce);
        c.setAAD(aad);
        const ciphertext = Buffer.concat([c.update(plaintext), c.final()]);
        return { nonce: fixedNonce, ciphertext, tag: c.getAuthTag() };
      },
      decrypt(key: Buffer, parts: AeadParts, aad: Buffer): Buffer {
        return aesGcm.decrypt(key, parts, aad);
      },
    };
    const ctx = ctxFor("tenant-fixed");
    const wire = encryptField(ctx, COL, ROW, SSN, fixedNonceCipher);
    // Decrypt back through the real cipher (chosen by alg-id) to prove the deterministic envelope is
    // a standard, well-formed AES-256-GCM envelope — not a test-only artifact.
    expect(decryptField(ctx, COL, ROW, wire)).toBe(SSN);

    const rowBoundAad = buildAad("tenant-fixed", 1, COL, ROW);
    const legacyColumnAad = buildAad("tenant-fixed", 1, COL); // 3-tuple, must stay byte-identical

    matchGolden(import.meta.url, "row-aad-envelope", {
      // The core new contract: the 4-tuple AAD wire is byte-stable.
      rowBoundAad: {
        json: rowBoundAad.toString("utf8"),
        base64: rowBoundAad.toString("base64"),
      },
      // Documents that the transparent column's 3-tuple AAD is unchanged by this task.
      legacyColumnAad: {
        json: legacyColumnAad.toString("utf8"),
        base64: legacyColumnAad.toString("base64"),
      },
      envelope: {
        wire,
        structure: {
          formatVersion: 1,
          algId: ALG_AES_256_GCM,
          keyVersion: 1,
          nonceHex: fixedNonce.toString("hex"),
          keyBytes: TENANT_KEY_BYTES,
        },
      },
    });
  });
});
