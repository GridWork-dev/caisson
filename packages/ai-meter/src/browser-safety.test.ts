// The browser-safety contract for `./browser` (ADR-0396) — proven by a STATIC SOURCE-GRAPH WALK,
// never by a build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps
// in crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker
// resolves relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports
// map, so the zero-offender claim covers the whole graph, kernel included.
//
// The money-path stake here is sharper than a bundle size: `.` reaches the credit ledger and the
// tenant executor. This test is what keeps the DB-bound half — reserve/reconcile, the stored
// breaker, the DDL — on the far side of the entry, permanently.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";

const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const BROWSER_ENTRY = join(import.meta.dir, "browser.ts");
const BARREL_ENTRY = join(import.meta.dir, "index.ts");

describe("`./browser` is browser-safe", () => {
  const walk = nodeBuiltinTaint(BROWSER_ENTRY, {
    workspaceRoot: WORKSPACE_ROOT,
  });

  test("no module reachable from src/browser.ts imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("no package module introduces an untracked node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
  });

  test("guard the guard: the walk really crossed into @caisson-sh/kernel, not just this package", () => {
    // This package contributes only 4 files to the entry graph, so files.length alone cannot prove
    // the cross-package edge resolved — this assertion is the one that fails if @caisson-sh/*
    // resolution goes blind and greens on nothing.
    expect(walk.files.some((f) => f.startsWith("packages/kernel/src/"))).toBe(
      true,
    );
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A new entry here means a non-workspace dependency joined the client graph — a review event,
    // not a silent hole in the proof.
    expect(walk.external).toEqual(["zod"]);
  });

  test("the DB-bound money path is unreachable from the entry", () => {
    // The three modules that move a wallet or touch a tenant executor, named individually: a future
    // `export * from "./meter.ts"` fails here before it fails on offenders.
    for (const server of ["meter.ts", "breaker.ts", "schema.ts"]) {
      expect(walk.files).not.toContain(`packages/ai-meter/src/${server}`);
    }
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/credits/"))).toBe(
      false,
    );
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/ai-meter/src/"))
        .sort(),
    ).toEqual([
      "packages/ai-meter/src/browser.ts",
      "packages/ai-meter/src/contracts.ts",
      "packages/ai-meter/src/estimate.ts",
      "packages/ai-meter/src/token-rates.ts",
    ]);
  });

  test("positive control: the `.` barrel DOES report the node builtin the server half carries", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // endsWith, not exact paths — offender files are workspace-root-relative.
    expect(
      barrel.offenders.some(
        (o) =>
          o.file.endsWith("ai-meter/src/meter.ts") && o.spec === "node:crypto",
      ),
    ).toBe(true);
    expect(barrel.unresolved).toEqual([]);
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
    // …and strictly fewer: the DB-bound half is the reason the barrel still exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
