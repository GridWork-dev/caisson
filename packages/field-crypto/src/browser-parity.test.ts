// Cross-runtime parity for the `./browser` twins (ADR-0396). The browser entry ships a SECOND
// implementation of two primitives — HKDF derivation and AES-256-GCM — because WebCrypto is
// async-only. Two implementations of one format are a drift liability unless their equality is
// pinned, so every twin below is checked against BOTH the node function it mirrors and the committed
// __golden__ fixture the node function is itself pinned to. A twin is not a second opinion about the
// wire format; it is the same format through a different runtime API.
//
// The strongest assertions here are the two INTEROP directions: a value sealed in a browser opens
// under the real `decryptField`, and a value written by `encryptField` opens in a browser — which is
// the actual product claim, and which no field-by-field comparison could establish.
import { describe, expect, test } from "bun:test";
import { createCipheriv } from "node:crypto";
import { buildAad } from "./aad.ts";
import { aesGcm } from "./cipher.ts";
import { derivedContext } from "./column.ts";
import { deriveTenantKey } from "./derive.ts";
import { decryptField, encryptField } from "./encrypt-field.ts";
import { parseEnvelope, serializeEnvelope } from "./envelope.ts";
import { DerivedKeyProvider } from "./provider.ts";
import {
  ALG_AES_256_GCM,
  NONCE_BYTES,
  TAG_BYTES,
  TENANT_KEY_BYTES,
  aesGcmOpenAsync,
  aesGcmSealAsync,
  buildAadBytes,
  deriveTenantKeyAsync,
  parseEnvelopeBytes,
  serializeEnvelopeBytes,
} from "./portable.ts";
import goldenDerive from "./__golden__/derive-kat.json";
import goldenEnvelope from "./__golden__/envelope.json";
import goldenRowAad from "./__golden__/row-aad-envelope.json";

// The fixed non-secret KAT vectors the package's own derive.test.ts uses. Never real key material.
const MASTER_KEY = new Uint8Array(TENANT_KEY_BYTES).fill(0x11);
const SALT = new Uint8Array(TENANT_KEY_BYTES).fill(0x22);
const FIXED_NONCE = new Uint8Array(NONCE_BYTES).fill(0xab);
const COLUMN = "patient.ssn";
const ROW_ID = "00000000-0000-4000-8000-000000000001";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

describe("deriveTenantKeyAsync — the WebCrypto HKDF twin", () => {
  test("reproduces the committed __golden__/derive-kat.json vectors byte-identically", async () => {
    expect(
      hex(await deriveTenantKeyAsync(MASTER_KEY, SALT, 1, "tenant_a")),
    ).toBe(goldenDerive["v1/tenant_a"]);
    expect(
      hex(await deriveTenantKeyAsync(MASTER_KEY, SALT, 2, "tenant_a")),
    ).toBe(goldenDerive["v2/tenant_a"]);
    expect(
      hex(await deriveTenantKeyAsync(MASTER_KEY, SALT, 1, "tenant_b")),
    ).toBe(goldenDerive["v1/tenant_b"]);
  });

  test("equals the node hkdfSync path across tenants and key versions", async () => {
    for (const tenant of ["tenant-a", "tenant-b", "acct-xyz"]) {
      for (const keyVersion of [1, 2, 7, 65535]) {
        expect(
          hex(await deriveTenantKeyAsync(MASTER_KEY, SALT, keyVersion, tenant)),
        ).toBe(
          deriveTenantKey(
            Buffer.from(MASTER_KEY),
            Buffer.from(SALT),
            keyVersion,
            tenant,
          ).toString("hex"),
        );
      }
    }
  });

  test("fails closed on a wrong-length master key or salt, like the node path", async () => {
    await expect(
      deriveTenantKeyAsync(new Uint8Array(31), SALT, 1, "tenant-a"),
    ).rejects.toThrow(/MASTER_FIELD_KEY/);
    await expect(
      deriveTenantKeyAsync(MASTER_KEY, new Uint8Array(16), 1, "tenant-a"),
    ).rejects.toThrow(/FIELD_CRYPTO_SALT/);
    await expect(
      deriveTenantKeyAsync(MASTER_KEY, SALT, 0, "tenant-a"),
    ).rejects.toThrow(/keyVersion/);
  });
});

describe("buildAadBytes / the envelope codec — one implementation, two faces", () => {
  test("buildAadBytes equals buildAad and the committed row-bound AAD fixture", () => {
    for (const rowId of [undefined, ROW_ID]) {
      expect(hex(buildAadBytes("tenant-a", 1, COLUMN, rowId))).toBe(
        buildAad("tenant-a", 1, COLUMN, rowId).toString("hex"),
      );
    }
    expect(
      new TextDecoder().decode(
        buildAadBytes("tenant-fixed", 1, COLUMN, ROW_ID),
      ),
    ).toBe(goldenRowAad.rowBoundAad.json);
    expect(
      new TextDecoder().decode(buildAadBytes("tenant-fixed", 1, COLUMN)),
    ).toBe(goldenRowAad.legacyColumnAad.json);
  });

  test("serializeEnvelopeBytes equals serializeEnvelope and the committed wire golden", () => {
    const parts = {
      algId: ALG_AES_256_GCM,
      keyVersion: 1,
      nonce: FIXED_NONCE,
      ciphertext: new TextEncoder().encode("hello-ciphertext"),
      tag: new Uint8Array(TAG_BYTES).fill(0xcd),
    };
    const wire = serializeEnvelopeBytes(parts);
    expect(wire).toBe(goldenEnvelope.wire);
    expect(wire).toBe(
      serializeEnvelope({
        algId: parts.algId,
        keyVersion: parts.keyVersion,
        nonce: Buffer.from(parts.nonce),
        ciphertext: Buffer.from(parts.ciphertext),
        tag: Buffer.from(parts.tag),
      }),
    );
  });

  test("parseEnvelopeBytes returns the same fields as parseEnvelope", () => {
    const bytes = parseEnvelopeBytes(goldenEnvelope.wire);
    const buffers = parseEnvelope(goldenEnvelope.wire);
    expect(bytes.formatVersion).toBe(buffers.formatVersion);
    expect(bytes.algId).toBe(buffers.algId);
    expect(bytes.keyVersion).toBe(buffers.keyVersion);
    expect(hex(bytes.nonce)).toBe(buffers.nonce.toString("hex"));
    expect(hex(bytes.ciphertext)).toBe(buffers.ciphertext.toString("hex"));
    expect(hex(bytes.tag)).toBe(buffers.tag.toString("hex"));
  });

  test("both faces reject the same malformed inputs (fail-closed, either runtime)", () => {
    for (const bad of [
      Buffer.alloc(8).toString("base64"), // too short
      "AgEAAaurq6urq6urq6urq2hlbGxvLWNpcGhlcnRleHTNzc3Nzc3Nzc3Nzc3Nzc3N", // format-version 0x02
    ]) {
      expect(() => parseEnvelopeBytes(bad)).toThrow();
      expect(() => parseEnvelope(bad)).toThrow();
    }
    // Whitespace is the one lenient case a stored column value realistically hits, so it survives.
    expect(
      parseEnvelopeBytes(
        `${goldenEnvelope.wire.slice(0, 20)}\n${goldenEnvelope.wire.slice(20)}`,
      ).keyVersion,
    ).toBe(1);
  });
});

describe("AES-256-GCM — the crypto.subtle twin of AesGcmCipher", () => {
  test("a fixed-nonce seal is byte-identical to node createCipheriv", async () => {
    const key = await deriveTenantKeyAsync(MASTER_KEY, SALT, 1, "tenant-a");
    const aad = buildAadBytes("tenant-a", 1, COLUMN, ROW_ID);
    const plaintext = "123-45-6789";

    const reference = createCipheriv(
      "aes-256-gcm",
      Buffer.from(key),
      Buffer.from(FIXED_NONCE),
    );
    reference.setAAD(Buffer.from(aad));
    const referenceCiphertext = Buffer.concat([
      reference.update(Buffer.from(plaintext, "utf8")),
      reference.final(),
    ]);

    const sealed = await aesGcmSealAsync(
      key,
      new TextEncoder().encode(plaintext),
      aad,
      { nonce: FIXED_NONCE },
    );
    expect(hex(sealed.ciphertext)).toBe(referenceCiphertext.toString("hex"));
    expect(hex(sealed.tag)).toBe(reference.getAuthTag().toString("hex"));
    expect(hex(sealed.nonce)).toBe(hex(FIXED_NONCE));
  });

  test("the default draws a fresh CSPRNG nonce per seal, exactly like the node cipher", async () => {
    const key = await deriveTenantKeyAsync(MASTER_KEY, SALT, 1, "tenant-a");
    const aad = buildAadBytes("tenant-a", 1, COLUMN, ROW_ID);
    const body = new TextEncoder().encode("same");
    const first = await aesGcmSealAsync(key, body, aad);
    const second = await aesGcmSealAsync(key, body, aad);
    expect(first.nonce).toHaveLength(NONCE_BYTES);
    expect(hex(first.nonce)).not.toBe(hex(second.nonce));
    expect(hex(first.ciphertext)).not.toBe(hex(second.ciphertext));
  });

  test("each cipher opens the other's output, and neither opens a tampered one", async () => {
    const key = await deriveTenantKeyAsync(MASTER_KEY, SALT, 1, "tenant-a");
    const aad = buildAadBytes("tenant-a", 1, COLUMN, ROW_ID);

    const fromNode = aesGcm.encrypt(
      Buffer.from(key),
      Buffer.from("on-device secret", "utf8"),
      Buffer.from(aad),
    );
    expect(
      new TextDecoder().decode(await aesGcmOpenAsync(key, fromNode, aad)),
    ).toBe("on-device secret");

    const fromBrowser = await aesGcmSealAsync(
      key,
      new TextEncoder().encode("on-device secret"),
      aad,
    );
    expect(
      aesGcm
        .decrypt(
          Buffer.from(key),
          {
            nonce: Buffer.from(fromBrowser.nonce),
            ciphertext: Buffer.from(fromBrowser.ciphertext),
            tag: Buffer.from(fromBrowser.tag),
          },
          Buffer.from(aad),
        )
        .toString("utf8"),
    ).toBe("on-device secret");

    // A different AAD (another row) must not authenticate — the row-binding claim, in both runtimes.
    const otherRowAad = buildAadBytes("tenant-a", 1, COLUMN, "other-row");
    await expect(
      aesGcmOpenAsync(key, fromNode, otherRowAad),
    ).rejects.toBeDefined();
    expect(() =>
      aesGcm.decrypt(
        Buffer.from(key),
        {
          nonce: Buffer.from(fromBrowser.nonce),
          ciphertext: Buffer.from(fromBrowser.ciphertext),
          tag: Buffer.from(fromBrowser.tag),
        },
        Buffer.from(otherRowAad),
      ),
    ).toThrow();
  });
});

describe("interop with the shipped row-bound path (encryptField / decryptField)", () => {
  const provider = new DerivedKeyProvider(
    Buffer.from(MASTER_KEY),
    Buffer.from(SALT),
  );
  const tenantA = derivedContext(provider, "tenant-a");
  const tenantB = derivedContext(provider, "tenant-b");

  /** Seal exactly as a browser consumer would: derive → AAD → GCM → envelope. */
  async function sealInBrowser(
    tenantId: string,
    keyVersion: number,
    plaintext: string,
  ): Promise<string> {
    const key = await deriveTenantKeyAsync(
      MASTER_KEY,
      SALT,
      keyVersion,
      tenantId,
    );
    const aad = buildAadBytes(tenantId, keyVersion, COLUMN, ROW_ID);
    const sealed = await aesGcmSealAsync(
      key,
      new TextEncoder().encode(plaintext),
      aad,
    );
    return serializeEnvelopeBytes({
      algId: ALG_AES_256_GCM,
      keyVersion,
      ...sealed,
    });
  }

  test("a browser-sealed envelope opens under the real decryptField; another tenant cannot", async () => {
    const wire = await sealInBrowser("tenant-a", 1, "123-45-6789");
    expect(decryptField(tenantA, COLUMN, ROW_ID, wire)).toBe("123-45-6789");
    expect(() => decryptField(tenantB, COLUMN, ROW_ID, wire)).toThrow();
  });

  test("an encryptField envelope opens with the browser twins; another tenant's key does not", async () => {
    const wire = encryptField(tenantA, COLUMN, ROW_ID, "on-device secret");
    const env = parseEnvelopeBytes(wire);
    const open = async (tenantId: string): Promise<string> =>
      new TextDecoder().decode(
        await aesGcmOpenAsync(
          await deriveTenantKeyAsync(
            MASTER_KEY,
            SALT,
            env.keyVersion,
            tenantId,
          ),
          env,
          buildAadBytes(tenantId, env.keyVersion, COLUMN, ROW_ID),
        ),
      );
    expect(await open("tenant-a")).toBe("on-device secret");
    await expect(open("tenant-b")).rejects.toBeDefined();
  });
});
