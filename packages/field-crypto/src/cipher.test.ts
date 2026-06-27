import { describe, expect, test } from "bun:test";
import { AesGcmCipher, aesGcm } from "./cipher.ts";
import { buildAad } from "./aad.ts";

const KEY = Buffer.alloc(32, 0x33);
const OTHER_KEY = Buffer.alloc(32, 0x44);
const AAD = buildAad("tenant_a", 1, "patient.ssn");
const PLAINTEXT = Buffer.from("424-12-9999", "utf8");

describe("AesGcmCipher (AES-256-GCM, ADR-0045)", () => {
  test("round-trips plaintext", () => {
    const parts = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    expect(parts.nonce.length).toBe(12);
    expect(parts.tag.length).toBe(16);
    const back = aesGcm.decrypt(KEY, parts, AAD);
    expect(back.toString("utf8")).toBe("424-12-9999");
  });

  test("uses a fresh nonce per encrypt (no nonce reuse)", () => {
    const a = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    const b = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    expect(a.nonce.toString("hex")).not.toBe(b.nonce.toString("hex"));
    expect(a.ciphertext.toString("hex")).not.toBe(b.ciphertext.toString("hex"));
  });

  test("a tampered ciphertext fails authentication", () => {
    const parts = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    const tampered = { ...parts, ciphertext: Buffer.from(parts.ciphertext) };
    tampered.ciphertext[0] = tampered.ciphertext[0]! ^ 0xff;
    expect(() => aesGcm.decrypt(KEY, tampered, AAD)).toThrow();
  });

  test("a tampered tag fails authentication", () => {
    const parts = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    const tampered = { ...parts, tag: Buffer.from(parts.tag) };
    tampered.tag[0] = tampered.tag[0]! ^ 0xff;
    expect(() => aesGcm.decrypt(KEY, tampered, AAD)).toThrow();
  });

  test("an AAD mismatch fails authentication (no cross-row/tenant/column reuse)", () => {
    const parts = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    const otherAad = buildAad("tenant_b", 1, "patient.ssn"); // different tenant
    expect(() => aesGcm.decrypt(KEY, parts, otherAad)).toThrow();
    const otherColumn = buildAad("tenant_a", 1, "patient.mrn"); // different column
    expect(() => aesGcm.decrypt(KEY, parts, otherColumn)).toThrow();
  });

  test("the wrong key fails authentication", () => {
    const parts = aesGcm.encrypt(KEY, PLAINTEXT, AAD);
    expect(() => aesGcm.decrypt(OTHER_KEY, parts, AAD)).toThrow();
  });

  test("rejects a wrong-length key", () => {
    expect(() => aesGcm.encrypt(Buffer.alloc(16), PLAINTEXT, AAD)).toThrow();
  });

  test("exposes the AES-256-GCM alg-id", () => {
    expect(new AesGcmCipher().algId).toBe(0x01);
  });
});
