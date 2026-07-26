import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  ANCHOR_PUBLIC_KEY_ENV,
  adminAuditAnchorTrustFromEnv,
} from "./audit-anchor-trust.ts";

function keyEnv(): Record<string, string> {
  const pair = generateKeyPairSync("ed25519");
  return {
    NODE_ENV: "production",
    CAISSON_ANCHOR_SIGNING_KEY: pair.privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64"),
    [ANCHOR_PUBLIC_KEY_ENV]: pair.publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64"),
    CAISSON_ANCHOR_SIGNING_KEY_ID: "anchor-live-v1",
  };
}

describe("admin audit anchor trust composition", () => {
  test("loads a matching private signer and public pinned key", () => {
    const env = keyEnv();
    const trust = adminAuditAnchorTrustFromEnv(env);

    expect(trust?.signer.keyId).toBe("anchor-live-v1");
    expect(trust?.pinnedKey.keyId).toBe("anchor-live-v1");
    expect(trust?.pinnedKey.publicKeySpkiBase64).toBe(
      env[ANCHOR_PUBLIC_KEY_ENV],
    );
  });

  test("production fails closed when the trust root is absent", () => {
    expect(() =>
      adminAuditAnchorTrustFromEnv({ NODE_ENV: "production" }),
    ).toThrow(/required in production/);
  });

  test("a public key that does not match the private signer is rejected", () => {
    const env = keyEnv();
    const other = generateKeyPairSync("ed25519")
      .publicKey.export({ format: "der", type: "spki" })
      .toString("base64");

    expect(() =>
      adminAuditAnchorTrustFromEnv({
        ...env,
        [ANCHOR_PUBLIC_KEY_ENV]: other,
      }),
    ).toThrow(/does not match/);
  });

  test("dev and test may omit both keys for legacy fixtures", () => {
    expect(adminAuditAnchorTrustFromEnv({ NODE_ENV: "test" })).toBeNull();
  });
});
