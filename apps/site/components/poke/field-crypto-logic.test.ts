// Parity + behavior tests for the field-crypto poke engine (ADR-0378 lock 2). The engine mirrors the
// REAL @caisson/field-crypto node:crypto primitive via WebCrypto; these tests pin it byte/number-
// identical to (a) the package's own exported functions and (b) its committed __golden__ fixtures, so
// the poke can never drift from shipped behavior. Runs under bun (WebCrypto + node:crypto both live).
import { describe, expect, test } from "bun:test";
import { createCipheriv } from "node:crypto";
import {
  deriveTenantKey as realDeriveTenantKey,
  serializeEnvelope as realSerializeEnvelope,
  buildAad as realBuildAad,
  encryptField as realEncryptField,
  decryptField as realDecryptField,
  DerivedKeyProvider,
  derivedContext,
} from "@caisson/field-crypto";

import * as fc from "./field-crypto-logic.ts";

// The package's committed golden fixtures — the same files its own tests pin against.
import goldenDerive from "../../../../packages/field-crypto/src/__golden__/derive-kat.json";
import goldenEnvelope from "../../../../packages/field-crypto/src/__golden__/envelope.json";
import goldenRowAad from "../../../../packages/field-crypto/src/__golden__/row-aad-envelope.json";

const enc = new TextEncoder();

describe("HKDF-SHA256 key derivation (mirror of derive.ts, ADR-0043)", () => {
  test("reproduces the committed __golden__/derive-kat.json vectors byte-identically", async () => {
    // The demo master/salt ARE the package test's fixed KAT vectors (0x11 x 32 / 0x22 x 32).
    expect(
      fc.bytesToHex(
        await fc.deriveTenantKey(
          fc.DEMO_MASTER_KEY,
          fc.DEMO_SALT,
          1,
          "tenant_a",
        ),
      ),
    ).toBe(goldenDerive["v1/tenant_a"]);
    expect(
      fc.bytesToHex(
        await fc.deriveTenantKey(
          fc.DEMO_MASTER_KEY,
          fc.DEMO_SALT,
          2,
          "tenant_a",
        ),
      ),
    ).toBe(goldenDerive["v2/tenant_a"]);
    expect(
      fc.bytesToHex(
        await fc.deriveTenantKey(
          fc.DEMO_MASTER_KEY,
          fc.DEMO_SALT,
          1,
          "tenant_b",
        ),
      ),
    ).toBe(goldenDerive["v1/tenant_b"]);
  });

  test("equals the real package deriveTenantKey on the demo's tenants + versions", async () => {
    for (const tenant of fc.TENANTS) {
      for (const kv of [1, 2, 7]) {
        const mine = fc.bytesToHex(
          await fc.deriveTenantKey(
            fc.DEMO_MASTER_KEY,
            fc.DEMO_SALT,
            kv,
            tenant,
          ),
        );
        const real = realDeriveTenantKey(
          Buffer.from(fc.DEMO_MASTER_KEY),
          Buffer.from(fc.DEMO_SALT),
          kv,
          tenant,
        ).toString("hex");
        expect(mine).toBe(real);
      }
    }
  });

  test("info string is exactly the ADR-0043 format", () => {
    expect(fc.deriveInfo(1, "tenant-a")).toBe(
      "caisson-field-crypto:v1:tenant-a",
    );
    expect(fc.deriveInfo(7, "acct-xyz")).toBe(
      "caisson-field-crypto:v7:acct-xyz",
    );
  });
});

describe("envelope serialize/parse (mirror of envelope.ts, ADR-0046)", () => {
  const PARTS = {
    algId: fc.ALG_AES_256_GCM,
    keyVersion: 1,
    nonce: new Uint8Array(fc.NONCE_BYTES).fill(0xab),
    ciphertext: enc.encode("hello-ciphertext"),
    tag: new Uint8Array(fc.TAG_BYTES).fill(0xcd),
  };

  test("serializes byte-identically to __golden__/envelope.json and to the real package", () => {
    const wire = fc.serializeEnvelope(PARTS);
    expect(wire).toBe(goldenEnvelope.wire);
    expect(wire).toBe(
      realSerializeEnvelope({
        algId: PARTS.algId,
        keyVersion: PARTS.keyVersion,
        nonce: Buffer.from(PARTS.nonce),
        ciphertext: Buffer.from(PARTS.ciphertext),
        tag: Buffer.from(PARTS.tag),
      }),
    );
  });

  test("parse round-trips every field", () => {
    const parsed = fc.parseEnvelope(goldenEnvelope.wire);
    expect(parsed.formatVersion).toBe(fc.FORMAT_VERSION);
    expect(parsed.algId).toBe(fc.ALG_AES_256_GCM);
    expect(parsed.keyVersion).toBe(1);
    expect(fc.bytesToHex(parsed.nonce)).toBe("ab".repeat(fc.NONCE_BYTES));
    expect(fc.bytesToHex(parsed.tag)).toBe("cd".repeat(fc.TAG_BYTES));
  });

  test("rejects a malformed length and unknown version/alg (flag, never guess)", () => {
    expect(() => fc.parseEnvelope(fc.bytesToHex(new Uint8Array(8)))).toThrow();
    const buf = new Uint8Array(fc.HEADER_BYTES + fc.NONCE_BYTES + fc.TAG_BYTES);
    buf[0] = 0x02; // bad format-version
    let b64 = "";
    for (const x of buf) b64 += String.fromCharCode(x);
    expect(() => fc.parseEnvelope(btoa(b64))).toThrow(/format-version/);
  });
});

describe("row-bound AAD 4-tuple (mirror of aad.ts, ADR-0055)", () => {
  test("equals the real package buildAad + the committed __golden__ fixture", () => {
    const mine = fc.buildAad("tenant-a", 1, "patient.ssn", fc.DEMO_ROW_ID);
    const real = realBuildAad("tenant-a", 1, "patient.ssn", fc.DEMO_ROW_ID);
    expect(Buffer.from(mine).toString("hex")).toBe(real.toString("hex"));

    // The shipped fixture used tenant "tenant-fixed" with the same column + row id.
    const fixtureAad = fc.buildAad(
      "tenant-fixed",
      1,
      "patient.ssn",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(new TextDecoder().decode(fixtureAad)).toBe(
      goldenRowAad.rowBoundAad.json,
    );
  });
});

describe("AES-256-GCM seal (mirror of cipher.ts) — byte-identical to node crypto on fixed inputs", () => {
  test("golden-replay seal ciphertext + tag match node createCipheriv exactly", async () => {
    const plaintext = "123-45-6789";
    const key = await fc.deriveTenantKey(
      fc.DEMO_MASTER_KEY,
      fc.DEMO_SALT,
      1,
      "tenant-a",
    );
    const aad = fc.buildAad(
      "tenant-a",
      1,
      fc.DEMO_COLUMN_CONTEXT,
      fc.DEMO_ROW_ID,
    );

    // Reference: the exact node primitive the real package uses (cipher.ts createCipheriv).
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(key),
      Buffer.from(fc.GOLDEN_NONCE),
    );
    cipher.setAAD(Buffer.from(aad));
    const refCt = Buffer.concat([
      cipher.update(Buffer.from(plaintext, "utf8")),
      cipher.final(),
    ]);
    const refTag = cipher.getAuthTag();

    const sealed = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext,
      goldenReplay: true,
    });
    const parsed = fc.parseEnvelope(sealed.wire);
    expect(fc.bytesToHex(parsed.nonce)).toBe("ab".repeat(fc.NONCE_BYTES));
    expect(fc.bytesToHex(parsed.ciphertext)).toBe(refCt.toString("hex"));
    expect(fc.bytesToHex(parsed.tag)).toBe(refTag.toString("hex"));
  });

  test("golden-replay is deterministic; fresh mode draws a new nonce per seal", async () => {
    const a = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "same",
      goldenReplay: true,
    });
    const b = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "same",
      goldenReplay: true,
    });
    expect(a.wire).toBe(b.wire);

    const f1 = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "same",
      goldenReplay: false,
    });
    const f2 = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "same",
      goldenReplay: false,
    });
    expect(f1.wire).not.toBe(f2.wire); // fresh CSPRNG nonce per encrypt (cipher.ts)
  });
});

describe("cross-package interop with the REAL encrypt-field.ts (encryptField/decryptField)", () => {
  const provider = new DerivedKeyProvider(
    Buffer.from(fc.DEMO_MASTER_KEY),
    Buffer.from(fc.DEMO_SALT),
  );
  const ctxA = derivedContext(provider, "tenant-a");
  const ctxB = derivedContext(provider, "tenant-b");

  test("my sealed envelope opens under the real package decryptField (tenant-a); tenant-b throws", async () => {
    const sealed = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "123-45-6789",
      goldenReplay: true,
    });
    expect(
      realDecryptField(
        ctxA,
        fc.DEMO_COLUMN_CONTEXT,
        fc.DEMO_ROW_ID,
        sealed.wire,
      ),
    ).toBe("123-45-6789");
    expect(() =>
      realDecryptField(
        ctxB,
        fc.DEMO_COLUMN_CONTEXT,
        fc.DEMO_ROW_ID,
        sealed.wire,
      ),
    ).toThrow();
  });

  test("the real package's encryptField output opens under my engine (tenant-a); tenant-b fails closed", async () => {
    const realWire = realEncryptField(
      ctxA,
      fc.DEMO_COLUMN_CONTEXT,
      fc.DEMO_ROW_ID,
      "on-device secret",
    );
    const opened = await fc.openEnvelope({
      wire: realWire,
      asTenant: "tenant-a",
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.plaintext).toBe("on-device secret");

    const crossed = await fc.openEnvelope({
      wire: realWire,
      asTenant: "tenant-b",
    });
    expect(crossed.ok).toBe(false);
  });
});

describe("the bench engine (seal/open/rotate)", () => {
  test("seal as tenant-a → open as tenant-a succeeds; open as tenant-b fails the GCM tag", async () => {
    const sealed = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "hi",
      goldenReplay: true,
    });
    const same = await fc.openEnvelope({
      wire: sealed.wire,
      asTenant: "tenant-a",
    });
    expect(same.ok).toBe(true);
    if (same.ok) expect(same.plaintext).toBe("hi");

    const cross = await fc.openEnvelope({
      wire: sealed.wire,
      asTenant: "tenant-b",
    });
    expect(cross).toEqual({ ok: false, reason: "auth" });
  });

  test("an old-key-version envelope still opens after rotation (self-describing key_version)", async () => {
    const v1 = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "old",
      goldenReplay: true,
    });
    const nextVersion = fc.rotateKeyVersion(1);
    expect(nextVersion).toBe(2);
    const v2 = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: nextVersion,
      plaintext: "new",
      goldenReplay: true,
    });
    expect(fc.parseEnvelope(v2.wire).keyVersion).toBe(2);

    // The v1 envelope opens forever — the envelope carries its own key_version (ADR-0046).
    const openedOld = await fc.openEnvelope({
      wire: v1.wire,
      asTenant: "tenant-a",
    });
    expect(openedOld.ok).toBe(true);
    if (openedOld.ok) {
      expect(openedOld.plaintext).toBe("old");
      expect(openedOld.keyVersion).toBe(1);
    }
  });

  test("rotate is bounded by the envelope's u16 key-version field (registry.ts)", () => {
    expect(() => fc.rotateKeyVersion(fc.MAX_KEY_VERSION)).toThrow();
  });

  test("a malformed wire fails closed as { ok: false, reason: 'malformed' }", async () => {
    const result = await fc.openEnvelope({
      wire: "not-a-real-envelope",
      asTenant: "tenant-a",
    });
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  test("envelopeSegments renders the real on-disk layout with the package's field names", async () => {
    const sealed = await fc.sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "seg",
      goldenReplay: true,
    });
    const segments = fc.envelopeSegments(sealed.wire);
    expect(segments.map((s) => s.label)).toEqual([
      "ver",
      "alg",
      "key_version",
      "nonce",
      "ciphertext",
      "tag",
    ]);
    expect(segments.find((s) => s.label === "nonce")?.byteLength).toBe(
      fc.NONCE_BYTES,
    );
    expect(segments.find((s) => s.label === "tag")?.byteLength).toBe(
      fc.TAG_BYTES,
    );
  });
});
