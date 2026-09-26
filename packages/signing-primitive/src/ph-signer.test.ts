// src/ph-signer.test.ts — the deployment-level Ed25519ph anchoring signer (Fork R-α / ADR-0346 §5).
//
// Proves the signing MODE the R1 de-risk validated against the live public Rekor v2 instance: an
// ed25519ph signature over sample anchor bytes verifies with `@noble/curves` ed25519ph over the same
// derived public key, and every fail-closed guard holds. No network.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { ed25519, ed25519ph } from "@noble/curves/ed25519.js";
import { ConfigError, ValidationError } from "@caisson-sh/kernel";
import {
  Ed25519PhSigner,
  DEFAULT_REKOR_ANCHORING_KEY_ID,
  REKOR_ANCHORING_KEY_ENV,
  REKOR_ANCHORING_KEY_ID_ENV,
} from "./ph-signer.ts";

// A FIXED throwaway anchoring seed (32 bytes) — deterministic; NOT a real deployment key.
const SEED = Uint8Array.from(
  createHash("sha512").update("caisson-ph-test-seed").digest().subarray(0, 32),
);
const SEED_B64 = Buffer.from(SEED).toString("base64");
const ANCHOR_BYTES = new TextEncoder().encode(
  JSON.stringify({ length: 7, tipHash: "c".repeat(64) }),
);

describe("Ed25519PhSigner", () => {
  test("signs ed25519ph; verifies over the derived public key", async () => {
    const signer = new Ed25519PhSigner("dep/anchoring/v1", SEED);
    expect(signer.algorithm).toBe("ed25519ph");
    const [pub, sig] = await Promise.all([
      signer.publicKey(),
      signer.sign(ANCHOR_BYTES),
    ]);
    expect(pub.length).toBe(32);
    expect(sig.length).toBe(64);
    // Round-trip: ed25519ph.verify over the full message + derived pub key.
    expect(ed25519ph.verify(sig, ANCHOR_BYTES, pub)).toBe(true);
    // The derived pub key is the SAME as pure-ed25519's (same seed, same key) — the property the
    // Rekor verifier material (DER SPKI of this key) relies on.
    expect(
      Buffer.from(pub).equals(Buffer.from(ed25519.getPublicKey(SEED))),
    ).toBe(true);
  });

  test("a wrong ed25519ph signature does not verify (tamper)", async () => {
    const signer = new Ed25519PhSigner("dep/anchoring/v1", SEED);
    const pub = await signer.publicKey();
    const sig = await signer.sign(ANCHOR_BYTES);
    const other = new TextEncoder().encode("different-anchor-bytes");
    expect(ed25519ph.verify(sig, other, pub)).toBe(false);
  });

  test("construction fails closed on a wrong-length seed", () => {
    expect(() => new Ed25519PhSigner("k", SEED.slice(0, 31))).toThrow(
      ValidationError,
    );
    expect(() => new Ed25519PhSigner("  ", SEED)).toThrow(ValidationError);
  });

  test("fromEnv loads a base64 seed + honors the id override", () => {
    const signer = Ed25519PhSigner.fromEnv({
      [REKOR_ANCHORING_KEY_ENV]: SEED_B64,
      [REKOR_ANCHORING_KEY_ID_ENV]: "dep/rekor/v2",
    });
    expect(signer.keyId).toBe("dep/rekor/v2");
    const dflt = Ed25519PhSigner.fromEnv({
      [REKOR_ANCHORING_KEY_ENV]: SEED_B64,
    });
    expect(dflt.keyId).toBe(DEFAULT_REKOR_ANCHORING_KEY_ID);
  });

  test("fromEnv fails closed (ConfigError) on a missing or wrong-length seed", () => {
    expect(() => Ed25519PhSigner.fromEnv({})).toThrow(ConfigError);
    // 16 bytes base64 — decodes but is the wrong length.
    const short = Buffer.from(new Uint8Array(16)).toString("base64");
    expect(() =>
      Ed25519PhSigner.fromEnv({ [REKOR_ANCHORING_KEY_ENV]: short }),
    ).toThrow(ConfigError);
  });

  test("never serializes the seed", () => {
    const signer = new Ed25519PhSigner("dep/anchoring/v1", SEED);
    expect(JSON.stringify(signer)).not.toContain(SEED_B64);
    expect(JSON.parse(JSON.stringify(signer)).key).toBe("[redacted]");
  });
});
