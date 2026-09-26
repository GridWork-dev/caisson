// The browser-safety contract for `./browser` (ADR-0396). This package is a money seam, so the
// claim being pinned is narrow and two-sided: the pure FIFO half really is free of node builtins,
// AND the database half really is still excluded from the entry.
//
// WHY A STATIC WALK AND NOT A BUILD: a bundler does not fail on a node builtin, it SUBSTITUTES a
// polyfill and exits 0 (~428KB observed). The proof has to live in the source graph.
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
    expect(walk.unresolved).toEqual([]);
  });

  test("no package module introduces an untracked node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
  });

  test("guard the guard: the walk crossed into @caisson-sh/kernel, not just this package", () => {
    // fifo.ts's only non-relative edge is the kernel barrel. If @caisson-sh/* resolution went blind
    // the offender list would be empty for the wrong reason, so the crossing is asserted directly.
    expect(walk.files).toContain("packages/credits/src/fifo.ts");
    expect(walk.files.some((f) => f.startsWith("packages/kernel/src/"))).toBe(
      true,
    );
  });

  test("the database half never enters the entry's graph", () => {
    // credits.ts (TenantExecutor + SQL + node:crypto) and tenancy-rls are the modules this entry
    // exists to keep out; schema.ts (the DDL) has no business in a client bundle either.
    expect(walk.files).not.toContain("packages/credits/src/credits.ts");
    expect(walk.files).not.toContain("packages/credits/src/schema.ts");
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/jobs/"))).toBe(false);
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/credits/src/"))
        .sort(),
    ).toEqual([
      "packages/credits/src/browser.ts",
      "packages/credits/src/fifo.ts",
    ]);
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A new entry here means a non-workspace dependency joined the entry's graph — a review event,
    // not a silent hole in the proof.
    expect(walk.external).toEqual(["zod"]);
  });

  test("positive control: the same walker reports node:crypto on the `.` barrel", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(
      barrel.offenders.some(
        (o) =>
          o.file === "packages/credits/src/credits.ts" &&
          o.spec === "node:crypto",
      ),
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

  test("no database-bound name leaked onto ./browser", async () => {
    const browser = await import("./browser.ts");
    for (const name of [
      "grant",
      "debit",
      "clawback",
      "balance",
      "spendableBalance",
      "getLedger",
      "sweepExpiredGrants",
      "CREDIT_SCHEMA_SQL",
    ]) {
      expect(Object.hasOwn(browser, name)).toBe(false);
    }
  });
});
