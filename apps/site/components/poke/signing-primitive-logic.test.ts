// Parity + behavior tests for the signing-primitive poke engine (ADR-0378 lock 2). The engine mirrors
// the REAL @caisson/signing-primitive detached-Ed25519 verify path via WebCrypto; these tests pin it
// boolean/byte-identical to (a) the package's own exported functions and (b) its committed __golden__
// fixtures, so the poke can never drift from shipped behavior. Runs under bun (WebCrypto + the real
// node:crypto / @noble path both live). The real package is imported by relative path because it is not
// symlinked into apps/site node_modules; the goldens are its shipped fixtures.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  canonicalize as realCanonicalize,
  type JsonValue,
} from "@caisson/kernel";
import {
  Ed25519Signer,
  StubTimestampAuthority,
  evidenceSignablePayload as realEvidenceSignablePayload,
  signEvidencePack as realSignEvidencePack,
  verifyEvidenceSignature as realVerifyEvidenceSignature,
  timestampCountersignsSignature as realTimestampCountersigns,
} from "../../../../packages/signing-primitive/src/sign.ts";

import * as sp from "./signing-primitive-logic.ts";

// The package's committed golden manifest — the byte-stable body its own tests sign + pin against.
import goldenManifest from "../../../../packages/signing-primitive/src/__golden__/evidence-pack.manifest.json";

// The byte-pinned detached signature golden (raw hex, no framing), read the same way sign.test.ts does.
const goldenSignatureHex = readFileSync(
  new URL(
    "../../../../packages/signing-primitive/src/__golden__/signed-manifest.sig",
    import.meta.url,
  ),
  "utf8",
).trim();

// The fixed per-tenant test identity that produced the golden (sign.test.ts TENANT_SEED / TENANT_KEY_ID).
const TENANT_SEED = Uint8Array.from(Buffer.from("42".repeat(32), "hex"));
const TENANT_KEY_ID = "tenant-acme-prod/evidence-signing/v1";

describe("the embedded sample IS the shipped golden (honest-artifact floor)", () => {
  test("SAMPLE_MANIFEST deep-equals the real __golden__/evidence-pack.manifest.json", () => {
    expect(sp.SAMPLE_MANIFEST).toEqual(goldenManifest);
  });

  test("SAMPLE_SIGNATURE reproduces the golden .sig, key, and keyId exactly", async () => {
    const real = await realSignEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      goldenManifest,
    );
    expect(sp.SAMPLE_SIGNATURE.signature).toBe(goldenSignatureHex);
    expect(sp.SAMPLE_SIGNATURE.signature).toBe(real.signature);
    expect(sp.SAMPLE_SIGNATURE.publicKey).toBe(real.publicKey);
    expect(sp.SAMPLE_SIGNATURE.keyId).toBe(real.keyId);
    expect(sp.SAMPLE_SIGNATURE.signature).toHaveLength(
      sp.ED25519_SIGNATURE_BYTES * 2,
    );
    expect(sp.SAMPLE_SIGNATURE.publicKey).toHaveLength(
      sp.ED25519_PUBLIC_BYTES * 2,
    );
  });
});

describe("canonicalize + signable payload (mirror of kernel canonical.ts + sign.ts)", () => {
  test("canonicalize equals the real @caisson/kernel canonicalize on the golden body", () => {
    expect(sp.canonicalize(goldenManifest as JsonValue)).toBe(
      realCanonicalize(goldenManifest as JsonValue),
    );
  });

  test("evidenceSignablePayload equals the real sign.ts payload byte-for-byte", () => {
    const mine = new TextDecoder().decode(
      sp.evidenceSignablePayload(goldenManifest),
    );
    const real = new TextDecoder().decode(
      realEvidenceSignablePayload(goldenManifest),
    );
    expect(mine).toBe(real);
    // It is exactly the canonical body concatenated with the WORM chain tip (ADR-0056).
    expect(mine).toBe(
      realCanonicalize(goldenManifest as JsonValue) +
        goldenManifest.chainAnchor.tipHash,
    );
  });
});

describe("verifyEvidenceSignature — WebCrypto Ed25519, boolean-parity with the real package", () => {
  test("the good sample verifies (true under my engine AND the real @noble path)", async () => {
    expect(
      await sp.verifyEvidenceSignature(sp.SAMPLE_MANIFEST, sp.SAMPLE_SIGNATURE),
    ).toBe(true);
    expect(
      await realVerifyEvidenceSignature(goldenManifest, sp.SAMPLE_SIGNATURE),
    ).toBe(true);
  });

  test("the tamper control: one flipped chain-tip byte fails (mine + real agree)", async () => {
    const tampered = sp.withTamperedTip(sp.SAMPLE_MANIFEST);
    expect(
      await sp.verifyEvidenceSignature(tampered, sp.SAMPLE_SIGNATURE),
    ).toBe(false);
    expect(
      await realVerifyEvidenceSignature(tampered, sp.SAMPLE_SIGNATURE),
    ).toBe(false);
  });

  test("the tamper control: swapping the verifying key fails (mine + real agree)", async () => {
    const swapped = {
      ...sp.SAMPLE_SIGNATURE,
      publicKey: sp.FOREIGN_PUBLIC_KEY,
    };
    expect(await sp.verifyEvidenceSignature(sp.SAMPLE_MANIFEST, swapped)).toBe(
      false,
    );
    expect(await realVerifyEvidenceSignature(goldenManifest, swapped)).toBe(
      false,
    );
  });

  test("fails CLOSED on malformed hex / wrong-length / unknown algorithm (never throws)", async () => {
    expect(
      await sp.verifyEvidenceSignature(sp.SAMPLE_MANIFEST, {
        ...sp.SAMPLE_SIGNATURE,
        signature: "zz",
      }),
    ).toBe(false);
    expect(
      await sp.verifyEvidenceSignature(sp.SAMPLE_MANIFEST, {
        ...sp.SAMPLE_SIGNATURE,
        signature: "ab",
      }),
    ).toBe(false);
    expect(
      await sp.verifyEvidenceSignature(sp.SAMPLE_MANIFEST, {
        ...sp.SAMPLE_SIGNATURE,
        algorithm: "ed25519ph",
      }),
    ).toBe(false);
  });
});

describe("flipTipByte — the flip-one-payload-byte tamper", () => {
  test("XORs exactly the first byte's low bit", () => {
    expect(sp.flipTipByte("0a1b2c3d")).toBe("0b1b2c3d");
  });

  test("changes exactly one byte of the real tip and keeps the length", () => {
    const orig = sp.SAMPLE_MANIFEST.chainAnchor.tipHash;
    const flipped = sp.flipTipByte(orig);
    expect(flipped).toHaveLength(orig.length);
    let differingChars = 0;
    for (let i = 0; i < orig.length; i++) {
      if (orig[i] !== flipped[i]) differingChars++;
    }
    expect(differingChars).toBeLessThanOrEqual(2); // at most one byte = two hex chars
    expect(differingChars).toBeGreaterThan(0);
  });
});

describe("RFC-3161 countersign receipt (mirror of sign.ts StubTimestampAuthority + verify)", () => {
  test("sampleCountersign reproduces the real stub token deep-identically", async () => {
    const realStub = new StubTimestampAuthority({
      now: new Date(sp.SAMPLE_TIMESTAMPED_AT),
    });
    const realToken = await realStub.countersign(
      sp.fromHex(sp.SAMPLE_SIGNATURE.signature),
    );
    const mineToken = await sp.sampleCountersign(sp.SAMPLE_SIGNATURE);
    expect(mineToken).toEqual(realToken);
    expect(mineToken.messageImprint).toHaveLength(64); // sha256 hex
  });

  test("timestampCountersignsSignature holds for THIS signature, mine + real agree", async () => {
    const token = await sp.sampleCountersign(sp.SAMPLE_SIGNATURE);
    expect(
      await sp.timestampCountersignsSignature(token, sp.SAMPLE_SIGNATURE),
    ).toBe(true);
    expect(realTimestampCountersigns(token, sp.SAMPLE_SIGNATURE)).toBe(true);
    // The imprint binds the signature bytes, so a swapped verifying key leaves the countersign intact.
    expect(
      await sp.timestampCountersignsSignature(token, {
        ...sp.SAMPLE_SIGNATURE,
        publicKey: sp.FOREIGN_PUBLIC_KEY,
      }),
    ).toBe(true);
  });

  test("rejects a token bound to a different signature, and malformed hex fails closed", async () => {
    const token = await sp.sampleCountersign(sp.SAMPLE_SIGNATURE);
    expect(
      await sp.timestampCountersignsSignature(token, {
        ...sp.SAMPLE_SIGNATURE,
        signature: "ab".repeat(64),
      }),
    ).toBe(false);
    expect(
      await sp.timestampCountersignsSignature(token, {
        ...sp.SAMPLE_SIGNATURE,
        signature: "zz",
      }),
    ).toBe(false);
  });
});
