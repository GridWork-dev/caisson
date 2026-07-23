// Golden parity: the WebCrypto mirror in audit-worm-logic.ts must be byte-identical to the REAL
// @caisson/kernel audit-chain and @caisson/audit-worm retention primitives (both node-backed, run
// here under bun) and to the shipped golden fixture. If the mirror ever drifts from the package,
// this fails — the demo can never show a hash the real chain would not compute.
import { describe, expect, test } from "bun:test";
import {
  anchorChain as kernelAnchorChain,
  buildChain as kernelBuildChain,
  canonicalize as kernelCanonicalize,
  chainEntry as kernelChainEntry,
  hashChainLink as kernelHashChainLink,
  verifyChain as kernelVerifyChain,
  type JsonValue,
} from "@caisson/kernel";
import {
  DEFAULT_RETENTION_YEARS as PKG_DEFAULT_YEARS,
  MIN_RETENTION_YEARS as PKG_MIN_YEARS,
  retainUntilFrom as pkgRetainUntilFrom,
} from "../../../../packages/audit-worm/src/retain.ts";
import goldenAnchor from "../../../../packages/audit-worm/src/__golden__/anchor.json";

import {
  anchorChain,
  appendEntry,
  buildChain,
  canonicalize,
  chainEntry,
  cutTail,
  DEFAULT_RETENTION_YEARS,
  evaluate,
  hashChainLink,
  initialState,
  MIN_RETENTION_YEARS,
  retainUntilFrom,
  SEALED_AT,
  SEED_PAYLOADS,
  tamperRow,
  verifyChain,
  verdictLine,
} from "./audit-worm-logic.ts";

// The exact payloads that mint the shipped golden anchor (packages/audit-worm/src/index.test.ts).
const GOLDEN_PAYLOADS: readonly JsonValue[] = [
  { event: "artifact.locked", artifactId: "policy", version: 1 },
  { event: "artifact.locked", artifactId: "policy", version: 2 },
  { event: "artifact.superseded", artifactId: "policy", supersedes: 1 },
];

describe("canonicalize parity", () => {
  test.each([
    { a: 1, b: 2, c: 3 } as JsonValue,
    { c: 3, b: 2, a: 1 } as JsonValue, // key order must not matter
    [null, { z: [1, 2], a: "x" }] as unknown as JsonValue,
    "plain-string" as JsonValue,
    SEED_PAYLOADS[0] as JsonValue,
  ])("matches kernel on %o", (value) => {
    expect(canonicalize(value)).toBe(kernelCanonicalize(value));
  });
});

describe("hash + chain parity", () => {
  test("hashChainLink matches kernel (genesis + linked)", async () => {
    const g = SEED_PAYLOADS[0] as JsonValue;
    expect(await hashChainLink(null, g)).toBe(kernelHashChainLink(null, g));
    const prev =
      "9a79093302a495ef273674f9feaf0fc0c6f5db8ab5b91a973f5e87519822e085";
    const p = SEED_PAYLOADS[1] as JsonValue;
    expect(await hashChainLink(prev, p)).toBe(kernelHashChainLink(prev, p));
  });

  test("chainEntry matches kernel", async () => {
    const mine = await chainEntry(null, SEED_PAYLOADS[0] as JsonValue);
    expect(mine).toEqual(kernelChainEntry(null, SEED_PAYLOADS[0] as JsonValue));
  });

  test("buildChain over the seed payloads is byte-identical to kernel", async () => {
    const mine = await buildChain(SEED_PAYLOADS);
    expect(mine).toEqual(kernelBuildChain(SEED_PAYLOADS));
  });

  test("mirror reproduces the baked Living Chain genesis hash", async () => {
    const entries = await buildChain(SEED_PAYLOADS);
    expect(entries[0]?.hash).toBe(
      "9a79093302a495ef273674f9feaf0fc0c6f5db8ab5b91a973f5e87519822e085",
    );
  });
});

describe("anchor golden-fixture parity", () => {
  test("anchorChain on the golden payloads equals the shipped fixture", async () => {
    const entries = await buildChain(GOLDEN_PAYLOADS);
    const mine = anchorChain(entries);
    expect(mine).toEqual(kernelAnchorChain(entries));
    expect(mine).toEqual({
      length: goldenAnchor.length,
      tipHash: goldenAnchor.tipHash,
      genesisHash: goldenAnchor.genesisHash,
    });
  });
});

describe("verifyChain parity across the poke's break-it moves", () => {
  test("a clean chain verifies (with and without anchor), matching kernel", async () => {
    const s = await initialState();
    expect(await verifyChain(s.entries)).toEqual({
      valid: true,
      brokenAt: null,
    });
    expect(await verifyChain(s.entries, s.anchor)).toEqual(
      kernelVerifyChain(s.entries, s.anchor),
    );
    expect(await verifyChain(s.entries, s.anchor)).toEqual({
      valid: true,
      brokenAt: null,
    });
  });

  test("tampering an interior row breaks at that index, matching kernel", async () => {
    const s = tamperRow(await initialState(), 1);
    const mine = await verifyChain(s.entries);
    expect(mine).toEqual(kernelVerifyChain(s.entries));
    expect(mine).toEqual({ valid: false, brokenAt: 1 });
  });

  test("cutting the tail passes internal but fails the anchor (length oracle), matching kernel", async () => {
    const s = cutTail(await initialState());
    // Surviving prefix is internally consistent...
    expect(await verifyChain(s.entries)).toEqual({
      valid: true,
      brokenAt: null,
    });
    // ...but the committed anchor length catches it.
    const anchored = await verifyChain(s.entries, s.anchor);
    expect(anchored).toEqual(kernelVerifyChain(s.entries, s.anchor));
    expect(anchored.valid).toBe(false);
  });
});

describe("evaluate + verdictLine drive the UI honestly", () => {
  test("clean chain: row 0 is Chain root, rest Verified, verdict ok", async () => {
    const s = await initialState();
    const v = await evaluate(s);
    expect(v.rows[0]).toBe("Chain root");
    expect(v.rows.slice(1)).toEqual(["Verified", "Verified", "Verified"]);
    expect(verdictLine(v, s).state).toBe("ok");
  });

  test("tamper: the broken row and every row after read Tampered, verdict fail", async () => {
    const s = tamperRow(await initialState(), 1);
    const v = await evaluate(s);
    expect(v.rows).toEqual(["Chain root", "Tampered", "Tampered", "Tampered"]);
    expect(verdictLine(v, s).state).toBe("fail");
  });

  test("cut tail: rows stay clean but the anchor verdict fails on length", async () => {
    const s = cutTail(await initialState());
    const v = await evaluate(s);
    expect(v.rows.every((r) => r !== "Tampered")).toBe(true);
    expect(v.lengthMatches).toBe(false);
    expect(verdictLine(v, s).state).toBe("fail");
  });

  test("append re-anchors: the grown chain verifies clean against its new anchor", async () => {
    const s = await appendEntry(await initialState());
    expect(s.entries.length).toBe(SEED_PAYLOADS.length + 1);
    const v = await evaluate(s);
    expect(v.anchored).toEqual({ valid: true, brokenAt: null });
  });
});

describe("retention mirror parity", () => {
  test("constants match the shipped package", () => {
    expect(MIN_RETENTION_YEARS).toBe(PKG_MIN_YEARS);
    expect(DEFAULT_RETENTION_YEARS).toBe(PKG_DEFAULT_YEARS);
  });

  test("retainUntilFrom matches the package on the fixed seal date", () => {
    expect(retainUntilFrom(SEALED_AT).getTime()).toBe(
      pkgRetainUntilFrom(SEALED_AT).getTime(),
    );
    expect(retainUntilFrom(SEALED_AT, MIN_RETENTION_YEARS).getTime()).toBe(
      pkgRetainUntilFrom(SEALED_AT, MIN_RETENTION_YEARS).getTime(),
    );
  });

  test("a below-floor term fails closed, like the package", () => {
    expect(() => retainUntilFrom(SEALED_AT, MIN_RETENTION_YEARS - 1)).toThrow();
  });
});
