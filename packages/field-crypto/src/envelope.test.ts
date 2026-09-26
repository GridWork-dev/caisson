import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import {
  ALG_AES_256_GCM,
  FORMAT_VERSION,
  HEADER_BYTES,
  NONCE_BYTES,
  TAG_BYTES,
  parseEnvelope,
  serializeEnvelope,
} from "./envelope.ts";

// Fixed parts → a DETERMINISTIC wire string (the real nonce/tag are random in production; here they
// are fixed so the golden pins the exact wire format + structure).
const NONCE = Buffer.alloc(NONCE_BYTES, 0xab);
const CIPHERTEXT = Buffer.from("hello-ciphertext", "utf8");
const TAG = Buffer.alloc(TAG_BYTES, 0xcd);

const PARTS = {
  algId: ALG_AES_256_GCM,
  keyVersion: 1,
  nonce: NONCE,
  ciphertext: CIPHERTEXT,
  tag: TAG,
} as const;

describe("envelope (ADR-0046)", () => {
  test("serialize → parse round-trips every field", () => {
    const wire = serializeEnvelope(PARTS);
    const parsed = parseEnvelope(wire);
    expect(parsed.formatVersion).toBe(FORMAT_VERSION);
    expect(parsed.algId).toBe(ALG_AES_256_GCM);
    expect(parsed.keyVersion).toBe(1);
    expect(parsed.nonce.equals(NONCE)).toBe(true);
    expect(parsed.ciphertext.equals(CIPHERTEXT)).toBe(true);
    expect(parsed.tag.equals(TAG)).toBe(true);
  });

  test("a too-short envelope is rejected", () => {
    expect(() => parseEnvelope(Buffer.alloc(8).toString("base64"))).toThrow(
      /malformed/,
    );
  });

  test("an unknown format-version is rejected (flag, never guess)", () => {
    const buf = Buffer.from(serializeEnvelope(PARTS), "base64");
    buf.writeUInt8(0x02, 0); // bad format-version
    expect(() => parseEnvelope(buf.toString("base64"))).toThrow(
      /format-version/,
    );
  });

  test("an unknown alg-id is rejected", () => {
    const buf = Buffer.from(serializeEnvelope(PARTS), "base64");
    buf.writeUInt8(0x09, 1); // bad alg-id
    expect(() => parseEnvelope(buf.toString("base64"))).toThrow(/alg-id/);
  });

  test("rejects a bad nonce/tag length on serialize", () => {
    expect(() =>
      serializeEnvelope({ ...PARTS, nonce: Buffer.alloc(8) }),
    ).toThrow();
    expect(() =>
      serializeEnvelope({ ...PARTS, tag: Buffer.alloc(8) }),
    ).toThrow();
  });

  test("golden: the wire format + structure are pinned", () => {
    const wire = serializeEnvelope(PARTS);
    matchGolden(import.meta.url, "envelope", {
      wire,
      structure: {
        formatVersion: FORMAT_VERSION,
        algId: ALG_AES_256_GCM,
        keyVersion: 1,
        headerBytes: HEADER_BYTES,
        nonceBytes: NONCE_BYTES,
        tagBytes: TAG_BYTES,
        ciphertextBytes: CIPHERTEXT.length,
      },
    });
  });
});
