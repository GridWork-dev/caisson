import { describe, expect, test } from "bun:test";

import { chainIntact, verifyChain, type ChainEntry } from "./audit-chain";

const good: ChainEntry[] = [
  { hash: "h0" },
  { hash: "h1", prevHash: "h0" },
  { hash: "h2", prevHash: "h1" },
];

describe("verifyChain", () => {
  test("genesis then verified links for an intact chain", () => {
    expect(verifyChain(good)).toEqual(["genesis", "verified", "verified"]);
    expect(chainIntact(good)).toBe(true);
  });

  test("a mismatched prevHash breaks that link", () => {
    const tampered: ChainEntry[] = [
      { hash: "h0" },
      { hash: "h1", prevHash: "WRONG" },
      { hash: "h2", prevHash: "h1" },
    ];
    expect(verifyChain(tampered)).toEqual(["genesis", "broken", "verified"]);
    expect(chainIntact(tampered)).toBe(false);
  });

  test("a missing prevHash on a non-genesis entry is broken", () => {
    const gap: ChainEntry[] = [{ hash: "h0" }, { hash: "h1" }];
    expect(verifyChain(gap)).toEqual(["genesis", "broken"]);
  });

  test("empty chain is trivially intact", () => {
    expect(verifyChain([])).toEqual([]);
    expect(chainIntact([])).toBe(true);
  });
});
