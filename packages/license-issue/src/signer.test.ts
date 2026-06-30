// @caisson/license-issue — signer + env key-loader behavior (ADR-0110). Proves the default
// Ed25519Signer constructs/signs/derives correctly from a `node:crypto` PRIVATE KeyObject and — the
// security-critical part — that the env key loader fails CLOSED on a missing / malformed / non-Ed25519
// `CAISSON_LICENSE_SIGNING_KEY` with a typed `ConfigError` that NAMES the env key but NEVER echoes the
// key value (no key material may reach a log/egress path). The key is PKCS8 DER, base64 — the
// production format the operator provisioned (ADR-0107).
import { describe, expect, test } from "bun:test";
import { ConfigError, ValidationError } from "@caisson/kernel";
import {
  type KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import {
  DEFAULT_SIGNING_KEY_ID,
  Ed25519Signer,
  LICENSE_SIGNING_KEY_ENV,
  LICENSE_SIGNING_KEY_ID_ENV,
} from "./signer.ts";

/** A deterministic 32-byte test seed (a documented test vector, never a production secret). */
const SEED = createHash("sha256")
  .update("license-issue-signer-test-seed")
  .digest();
// Ed25519 PKCS#8 DER = 16-byte fixed prefix ‖ 32-byte raw seed (RFC 8410).
const PKCS8_DER = Buffer.concat([
  Buffer.from("302e020100300506032b657004220420", "hex"),
  SEED,
]);
const PKCS8_B64 = PKCS8_DER.toString("base64");
const PRIVATE_KEY: KeyObject = createPrivateKey({
  key: PKCS8_DER,
  format: "der",
  type: "pkcs8",
});

describe("Ed25519Signer (default issuer signer)", () => {
  test("constructs from an Ed25519 private key and signs a detached 64-byte signature", async () => {
    const signer = new Ed25519Signer("k1", PRIVATE_KEY);
    expect(signer.keyId).toBe("k1");
    expect(signer.algorithm).toBe("ed25519");
    const sig = await signer.sign(new TextEncoder().encode("hello"));
    expect(sig).toHaveLength(64);
    const pub = await signer.publicKey();
    expect(pub).toHaveLength(32);
  });

  test("rejects a PUBLIC key (fail-closed ValidationError)", () => {
    const publicKey = createPublicKey(
      PRIVATE_KEY.export({ format: "pem", type: "pkcs8" }),
    );
    expect(() => new Ed25519Signer("k1", publicKey)).toThrow(ValidationError);
  });

  test("rejects a non-Ed25519 key (fail-closed ValidationError)", () => {
    const { privateKey: x25519 } = generateKeyPairSync("x25519");
    expect(() => new Ed25519Signer("k1", x25519)).toThrow(ValidationError);
  });

  test("rejects an empty keyId", () => {
    expect(() => new Ed25519Signer("   ", PRIVATE_KEY)).toThrow(
      ValidationError,
    );
  });

  test("never serializes key material (toJSON redacts, KeyObject is opaque)", () => {
    const json = JSON.stringify(new Ed25519Signer("k1", PRIVATE_KEY));
    expect(json).toContain("[redacted]");
    expect(json).not.toContain(PKCS8_B64);
    expect(json).not.toContain(SEED.toString("hex"));
  });
});

describe("Ed25519Signer.fromEnv (key loader, fail-closed)", () => {
  test("loads a valid PKCS8-base64 key and defaults the keyId", () => {
    const signer = Ed25519Signer.fromEnv({
      [LICENSE_SIGNING_KEY_ENV]: PKCS8_B64,
    });
    expect(signer.keyId).toBe(DEFAULT_SIGNING_KEY_ID);
  });

  test("honors an explicit LICENSE_SIGNING_KEY_ID override", () => {
    const signer = Ed25519Signer.fromEnv({
      [LICENSE_SIGNING_KEY_ENV]: PKCS8_B64,
      [LICENSE_SIGNING_KEY_ID_ENV]: "rotated-2027",
    });
    expect(signer.keyId).toBe("rotated-2027");
  });

  test("missing key → ConfigError naming the env key, never echoing a value", () => {
    expect(() => Ed25519Signer.fromEnv({})).toThrow(ConfigError);
    try {
      Ed25519Signer.fromEnv({});
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain(LICENSE_SIGNING_KEY_ENV);
    }
  });

  test("malformed / non-Ed25519 key → ConfigError that never echoes the bad value", () => {
    // A non-base64-PKCS8 garbage value, an empty value, and a valid-but-wrong-curve (x25519) key.
    const x25519B64 = generateKeyPairSync("x25519")
      .privateKey.export({ format: "der", type: "pkcs8" })
      .toString("base64");
    for (const bad of ["not-a-real-pkcs8-key-value", "", x25519B64]) {
      const fail = () =>
        Ed25519Signer.fromEnv({ [LICENSE_SIGNING_KEY_ENV]: bad });
      expect(fail).toThrow(ConfigError);
      try {
        fail();
      } catch (e) {
        if (bad.length > 0) {
          expect((e as ConfigError).message).not.toContain(bad);
        }
        expect((e as ConfigError).message).toContain(LICENSE_SIGNING_KEY_ENV);
      }
    }
  });
});
