import { describe, expect, test } from "bun:test";
import {
  generateKeyPairSync,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { ConfigError, ValidationError } from "@caisson-sh/kernel";
import { EVIDENCE_PACK_KEY_ID_MAX_LENGTH } from "@caisson-sh/kernel/evidence";
import {
  ANCHOR_SIGNING_KEY_ENV,
  DEFAULT_ANCHOR_SIGNING_KEY_ID,
  Ed25519AnchorSigner,
} from "./anchor-signer.ts";

/** Export a generated Ed25519 private key as the base64 PKCS8 DER the env loader expects. */
function makeEnvKey(): { b64: string; publicKey: KeyObject } {
  const kp = generateKeyPairSync("ed25519");
  const der = kp.privateKey.export({ format: "der", type: "pkcs8" });
  return { b64: Buffer.from(der).toString("base64"), publicKey: kp.publicKey };
}

describe("Ed25519AnchorSigner.fromEnv", () => {
  test("loads a valid key and produces a verifiable Ed25519 signature", async () => {
    const { b64, publicKey } = makeEnvKey();
    const signer = Ed25519AnchorSigner.fromEnv({
      [ANCHOR_SIGNING_KEY_ENV]: b64,
    });
    expect(signer.keyId).toBe(DEFAULT_ANCHOR_SIGNING_KEY_ID);

    const payload = new TextEncoder().encode('{"length":1,"tipHash":"ab"}');
    const sig = await signer.sign(payload);
    expect(sig.length).toBe(64);
    expect(cryptoVerify(null, payload, publicKey, sig)).toBe(true);
  });

  test("honors a custom identity id from env", () => {
    const { b64 } = makeEnvKey();
    const signer = Ed25519AnchorSigner.fromEnv({
      [ANCHOR_SIGNING_KEY_ENV]: b64,
      CAISSON_ANCHOR_SIGNING_KEY_ID: "anchor-signer-2027",
    });
    expect(signer.keyId).toBe("anchor-signer-2027");
  });

  test("a missing key fails closed with a ConfigError that names the var, not a value", () => {
    try {
      Ed25519AnchorSigner.fromEnv({});
      throw new Error("expected fromEnv to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).message).toContain(ANCHOR_SIGNING_KEY_ENV);
    }
  });

  test("a malformed key fails closed with a ConfigError and never echoes the bytes", () => {
    const junk = Buffer.from("not a real pkcs8 key").toString("base64");
    try {
      Ed25519AnchorSigner.fromEnv({ [ANCHOR_SIGNING_KEY_ENV]: junk });
      throw new Error("expected fromEnv to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).message).not.toContain(junk);
    }
  });
});

describe("Ed25519AnchorSigner constructor", () => {
  test("accepts the verifier key-id limit and rejects one character more", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    expect(
      new Ed25519AnchorSigner(
        "k".repeat(EVIDENCE_PACK_KEY_ID_MAX_LENGTH),
        privateKey,
      ).keyId,
    ).toHaveLength(EVIDENCE_PACK_KEY_ID_MAX_LENGTH);
    expect(
      () =>
        new Ed25519AnchorSigner(
          "k".repeat(EVIDENCE_PACK_KEY_ID_MAX_LENGTH + 1),
          privateKey,
        ),
    ).toThrow(ValidationError);
  });

  test("rejects a public key (requires a private key)", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    expect(() => new Ed25519AnchorSigner("k", publicKey)).toThrow(
      ValidationError,
    );
  });

  test("toJSON never serializes the key material", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const signer = new Ed25519AnchorSigner("k", privateKey);
    expect(signer.toJSON().key).toBe("[redacted]");
  });
});
