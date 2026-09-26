import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import {
  type AuditChainEntry,
  anchorChain,
  buildChain,
  canonicalize,
  chainEntry,
  contentHash,
  hashChainLink,
  verifyChain,
} from "./audit-chain.ts";

const PAYLOADS = [
  { event: "locked", artifactId: "art-1", version: 1 },
  { event: "superseded", artifactId: "art-1", version: 2 },
  { event: "locked", artifactId: "art-2", version: 1 },
] as const;

describe("audit-chain", () => {
  test("a built chain verifies end to end", () => {
    const chain = buildChain(PAYLOADS);
    expect(chain).toHaveLength(3);
    expect(chain[0]!.prevHash).toBeNull(); // genesis
    expect(chain[0]!.seq).toBe(0);
    expect(chain[1]!.prevHash).toBe(chain[0]!.hash); // linked
    expect(verifyChain(chain)).toEqual({ valid: true, brokenAt: null });
  });

  test("contentHash is a known-answer, canonicalization-invariant, collision-separating tag", () => {
    // KAT: sha256(canonicalize({claim:"frozen",version:1})) — pins the algorithm + hex encoding.
    expect(contentHash({ claim: "frozen", version: 1 })).toBe(
      "2bf699d5bd95fb95122d4252333340c45ec95e28ed6586c8152e33d35d2dfcf5",
    );
    // Key order does not change the hash (canonicalization is load-bearing).
    expect(contentHash({ version: 1, claim: "frozen" })).toBe(
      contentHash({ claim: "frozen", version: 1 }),
    );
    // A different payload yields a different tag.
    expect(contentHash({ claim: "frozen", version: 2 })).not.toBe(
      contentHash({ claim: "frozen", version: 1 }),
    );
    // A single-claim tag is NOT a chain link — it must differ from the 2-tuple chain hash.
    expect(contentHash({ claim: "frozen", version: 1 })).not.toBe(
      hashChainLink(null, { claim: "frozen", version: 1 }),
    );
  });

  test("canonicalization makes the hash key-order independent", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
    expect(hashChainLink(null, { a: 1, b: 2 })).toBe(
      hashChainLink(null, { b: 2, a: 1 }),
    );
    // ...but value differences DO change the hash.
    expect(hashChainLink(null, { a: 1 })).not.toBe(
      hashChainLink(null, { a: 2 }),
    );
  });

  test("a non-finite number is not canonicalizable", () => {
    expect(() => canonicalize({ n: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => canonicalize({ n: Number.NaN })).toThrow();
  });

  test("tampering a payload breaks verification at that index", () => {
    const chain = buildChain(PAYLOADS);
    const tampered = [...chain];
    tampered[1] = {
      ...chain[1]!,
      payload: { event: "superseded", artifactId: "art-1", version: 999 },
    };
    expect(verifyChain(tampered)).toEqual({ valid: false, brokenAt: 1 });
  });

  test("tampering only the stored hash breaks verification at that index", () => {
    const chain = buildChain(PAYLOADS);
    const tampered = [...chain];
    tampered[2] = { ...chain[2]!, hash: "0".repeat(64) };
    expect(verifyChain(tampered)).toEqual({ valid: false, brokenAt: 2 });
  });

  test("reordering entries breaks verification at the first moved index", () => {
    const chain = buildChain(PAYLOADS);
    const reordered: AuditChainEntry[] = [chain[0]!, chain[2]!, chain[1]!];
    expect(verifyChain(reordered).valid).toBe(false);
    expect(verifyChain(reordered).brokenAt).toBe(1);
  });

  test("dropping a MIDDLE entry breaks verification", () => {
    const chain = buildChain(PAYLOADS);
    const dropped: AuditChainEntry[] = [chain[0]!, chain[2]!];
    expect(verifyChain(dropped).valid).toBe(false);
    expect(verifyChain(dropped).brokenAt).toBe(1);
  });

  // --- TM8: internal consistency alone does NOT catch tail-truncation or wholesale rewrite. ---

  test("tail-truncation passes WITHOUT an anchor (documented limit)", () => {
    const chain = buildChain(PAYLOADS);
    // Dropping the LAST entry leaves a still-internally-consistent prefix — verifies clean.
    expect(verifyChain(chain.slice(0, -1))).toEqual({
      valid: true,
      brokenAt: null,
    });
  });

  test("an anchor catches tail-truncation", () => {
    const chain = buildChain(PAYLOADS);
    const anchor = anchorChain(chain);
    expect(verifyChain(chain, anchor)).toEqual({ valid: true, brokenAt: null });
    // Same prefix that passed unanchored is now rejected against the committed length.
    expect(verifyChain(chain.slice(0, -1), anchor)).toEqual({
      valid: false,
      brokenAt: 2,
    });
  });

  test("an anchor catches a wholesale rewrite (forged self-consistent chain)", () => {
    const chain = buildChain(PAYLOADS);
    const anchor = anchorChain(chain);
    // A fresh chain over forged payloads is internally consistent but has a different tip.
    const forged = buildChain([
      { event: "locked", artifactId: "art-1", version: 1 },
      { event: "locked", artifactId: "art-1", version: 1 }, // tampered history
      { event: "locked", artifactId: "art-2", version: 1 },
    ]);
    expect(verifyChain(forged)).toEqual({ valid: true, brokenAt: null }); // self-consistent
    expect(verifyChain(forged, anchor)).toEqual({ valid: false, brokenAt: 2 }); // tip mismatch
  });

  test("an anchor catches a re-rooted chain (genesis mismatch)", () => {
    const chain = buildChain(PAYLOADS);
    const anchor = anchorChain(chain);
    const reRooted = buildChain([
      { event: "forged-genesis", artifactId: "art-1", version: 1 },
      ...PAYLOADS.slice(1),
    ]);
    expect(verifyChain(reRooted, anchor)).toEqual({
      valid: false,
      brokenAt: 0,
    });
  });

  test("anchorChain refuses an empty chain", () => {
    expect(() => anchorChain([])).toThrow();
  });

  test("an empty chain trivially verifies", () => {
    expect(verifyChain([])).toEqual({ valid: true, brokenAt: null });
  });

  test("chainEntry(null, …) mints genesis", () => {
    const g = chainEntry(null, { hello: "world" });
    expect(g.seq).toBe(0);
    expect(g.prevHash).toBeNull();
    expect(g.hash).toBe(hashChainLink(null, { hello: "world" }));
  });

  test("the built chain matches its golden (KAT for canonicalize + sha256)", () => {
    matchGolden(import.meta.url, "audit-chain", buildChain(PAYLOADS));
  });
});
