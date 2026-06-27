import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import {
  type AuditChainEntry,
  buildChain,
  canonicalize,
  chainEntry,
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

  test("dropping an entry breaks verification", () => {
    const chain = buildChain(PAYLOADS);
    const dropped: AuditChainEntry[] = [chain[0]!, chain[2]!];
    expect(verifyChain(dropped).valid).toBe(false);
    expect(verifyChain(dropped).brokenAt).toBe(1);
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
