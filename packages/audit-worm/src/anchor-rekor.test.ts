// src/anchor-rekor.test.ts — the Rekor v1.1 leg, verified HERMETICALLY against committed fixtures
// (R4 parse + R5 offline verify + R6 fixtures + R8 shard-rotation). ZERO live TUF/Rekor fetch: the
// golden `TransparencyLogEntry` + pinned `trusted_root.json` were captured once in the R1 de-risk.
//
// The sample anchor bytes are reconstructed byte-identically to the R1 submission (a fixed object
// literal) so the `SHA-512(anchorBytes)` leaf-digest binding is exercised for real.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rekorEntryToReceipt, verifyRekorReceipt } from "./anchor-rekor.ts";
import type { TransparencyReceipt } from "./anchor-transparency.ts";

const FIX = join(import.meta.dir, "__fixtures__", "rekor-v2");
const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIX, name), "utf8"));

const goldenEntry = (): unknown => readFixture("golden-entry.json");
const trustedRoot = (): unknown => readFixture("trusted_root.json");

/** The EXACT sample anchor bytes submitted in R1 (hashes only, no PII). */
const SAMPLE_ANCHOR = new TextEncoder().encode(
  JSON.stringify({
    length: 42,
    tipHash: "a".repeat(64),
    genesisHash: "b".repeat(64),
  }),
);

function goldenReceipt(): TransparencyReceipt {
  return rekorEntryToReceipt(goldenEntry(), trustedRoot());
}

describe("rekorEntryToReceipt (R4 parse)", () => {
  test("builds a self-contained receipt from the golden entry + trusted_root", () => {
    const r = goldenReceipt();
    expect(r.algorithm).toBe("rekor-v2-hashedrekord");
    expect(r.origin).toBe("log2025-1.rekor.sigstore.dev");
    expect(r.logKeyDetails).toBe("PKIX_ED25519");
    expect(r.logPublicKey.length).toBeGreaterThan(0); // snapshotted from trusted_root
    expect(r.inclusionHashes.length).toBeGreaterThan(0);
    expect(r.logIndex).toMatch(/^\d+$/);
  });

  test("fails closed when the trusted_root has no matching shard key", () => {
    const emptyRoot = {
      tlogs: [
        {
          logId: { keyId: "AAAA" },
          publicKey: { rawBytes: "AA==", keyDetails: "PKIX_ED25519" },
        },
      ],
    };
    expect(() => rekorEntryToReceipt(goldenEntry(), emptyRoot)).toThrow();
  });
});

describe("verifyRekorReceipt (R5 offline verify)", () => {
  test("verifies the golden receipt against the current anchor bytes — zero network", () => {
    const result = verifyRekorReceipt(goldenReceipt(), SAMPLE_ANCHOR);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.logIndex).toMatch(/^\d+$/);
  });

  test("fails closed on a digest mismatch (wrong anchor bytes)", () => {
    const result = verifyRekorReceipt(
      goldenReceipt(),
      new TextEncoder().encode("different-anchor"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("digest");
  });

  test("fails closed on a tampered inclusion-proof hash", () => {
    const r = goldenReceipt();
    const flipped: TransparencyReceipt = {
      ...r,
      inclusionHashes: [
        Buffer.from(new Uint8Array(32).fill(9)).toString("base64"),
        ...r.inclusionHashes.slice(1),
      ],
    };
    const result = verifyRekorReceipt(flipped, SAMPLE_ANCHOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inclusion proof");
  });

  test("fails closed on a tampered checkpoint root", () => {
    const r = goldenReceipt();
    // Rewrite the base64 rootHash line with a different 32-byte value; the note signature no longer verifies.
    const badRoot = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
    const lines = r.checkpoint.split("\n");
    lines[2] = badRoot;
    const result = verifyRekorReceipt(
      { ...r, checkpoint: lines.join("\n") },
      SAMPLE_ANCHOR,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("checkpoint signature");
  });

  test("fails closed on a wrong-origin checkpoint", () => {
    const r = goldenReceipt();
    const result = verifyRekorReceipt(
      { ...r, origin: "evil.example.com" },
      SAMPLE_ANCHOR,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("origin");
  });
});

describe("shard rotation (R8): a receipt is self-verifying via its EMBEDDED key", () => {
  test("verify uses only the receipt-embedded log key — no live trusted_root at verify time", () => {
    // Prove independence: build the receipt, then verify with NOTHING but the receipt + anchor bytes.
    // A future retired shard whose key is gone from trusted_root still verifies because the key travels
    // in the receipt (spike decision #2).
    const r = goldenReceipt();
    expect(verifyRekorReceipt(r, SAMPLE_ANCHOR).ok).toBe(true);
  });

  test("no `log2025` shard URL is hardcoded in source (grep-assert)", () => {
    const src = readFileSync(join(import.meta.dir, "anchor-rekor.ts"), "utf8");
    expect(src.includes("log2025")).toBe(false);
  });
});
