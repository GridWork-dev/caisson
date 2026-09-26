// The browser-safety contract for `./browser` (ADR-0396).
//
// PROVEN BY A STATIC SOURCE-GRAPH WALK, NEVER BY A BUILD: a bundler does not fail on a node
// builtin, it SUBSTITUTES a polyfill and exits 0. The claim this entry makes is that nothing in its
// value-import graph — including the cross-package edges into @caisson-sh/kernel and
// @caisson-sh/frameworks-pack/browser — reaches one.
//
// This package is the sharpest case for the positive control: its `.` barrel reaches node builtins
// from FOUR directions (generate.ts directly, chain-verify through @caisson-sh/kernel/node,
// field-crypto-policy through @caisson-sh/field-crypto, drift/* directly). A walker that had gone
// blind to any of those would report the same empty offender list on browser.ts that a genuinely
// clean entry does.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";

const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const BROWSER_ENTRY = join(import.meta.dir, "browser.ts");
const BARREL_ENTRY = join(import.meta.dir, "index.ts");

describe("`./browser` is browser-safe", () => {
  const walk = nodeBuiltinTaint(BROWSER_ENTRY, {
    workspaceRoot: WORKSPACE_ROOT,
  });

  test("no module reachable from src/browser.ts imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("guard the guard: the walk crossed into the packages this entry composes", () => {
    expect(walk.files).toContain("packages/frameworks-pack/src/browser.ts");
    expect(walk.files.some((f) => f.startsWith("packages/kernel/src/"))).toBe(
      true,
    );
  });

  test("the excluded node-bound modules are genuinely unreachable from it", () => {
    for (const excluded of [
      "packages/compliance-core/src/evidence/generate.ts",
      "packages/compliance-core/src/evidence/collectors/chain-verify.ts",
      "packages/compliance-core/src/evidence/collectors/field-crypto-policy.ts",
      "packages/compliance-core/src/evidence/drift/schedule.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
    // …and no edge into either node-only package at all.
    expect(walk.files.some((f) => f.startsWith("packages/field-crypto/"))).toBe(
      false,
    );
    expect(walk.files).not.toContain("packages/kernel/src/audit-chain.ts");
  });
});

describe("positive control: the `.` barrel reports the taint this entry avoids", () => {
  const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
    workspaceRoot: WORKSPACE_ROOT,
  });

  test("the generator's own node builtins are reported", () => {
    const specs = barrel.offenders
      .filter((o) => o.file.endsWith("evidence/generate.ts"))
      .map((o) => o.spec)
      .sort();
    expect(specs).toEqual(["node:crypto", "node:zlib"]);
  });

  test("the cross-package taint (kernel/node, field-crypto) is reported too", () => {
    expect(
      barrel.offenders.some((o) => o.file === "packages/kernel/src/crypto.ts"),
    ).toBe(true);
    expect(
      barrel.offenders.some((o) => o.file.startsWith("packages/field-crypto/")),
    ).toBe(true);
  });
});

describe("`./browser` is a subset of `.`", () => {
  test("every runtime name exported by ./browser is also exported by the barrel", async () => {
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    const missing = Object.keys(browser).filter(
      (name) => !Object.hasOwn(barrel, name),
    );
    expect(missing).toEqual([]);
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
