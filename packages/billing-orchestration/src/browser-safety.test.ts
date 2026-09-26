// The browser-safety contract for `./browser` (ADR-0396). Proven by a STATIC SOURCE-GRAPH WALK, never
// by a build: a bundler does not FAIL on a node builtin, it SUBSTITUTES one (turbopack swaps in
// crypto-browserify and the client chunk silently grows ~428KB, exit 0). This package is the sharpest
// case for that — its `.` barrel reaches node:crypto through @caisson-sh/billing's signature verifiers and
// reaches `pg` through @caisson-sh/tenancy-rls, so "the site built fine" would have proven nothing.
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

  test("nor introduces an untracked node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
  });

  test("guard the guard: the walk crossed the package boundary into kernel", () => {
    // The entry's own subgraph is two files, so files.length can never carry the cross-package
    // claim — this is the assertion that fails if @caisson-sh/* resolution silently goes blind and
    // greens on nothing.
    expect(walk.files).toContain(
      "packages/billing-orchestration/src/event-keys.ts",
    );
    expect(walk.files.some((f) => f.startsWith("packages/kernel/src/"))).toBe(
      true,
    );
    expect(
      walk.files
        .filter((file) =>
          file.startsWith("packages/billing-orchestration/src/"),
        )
        .sort(),
    ).toEqual([
      "packages/billing-orchestration/src/browser.ts",
      "packages/billing-orchestration/src/event-keys.ts",
    ]);
  });

  test("the server-only half stays out of the entry's graph", () => {
    // The claim, its schema SQL, the checkout drivers, and the signature verifiers are the whole
    // reason this entry exists as a subset rather than a re-export of the barrel.
    expect(walk.files).not.toContain(
      "packages/billing-orchestration/src/idempotency.ts",
    );
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/billing/"))).toBe(
      false,
    );
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // zod arrives through the kernel barrel. A second entry here means a new non-workspace
    // dependency joined the browser entry's graph; that is a review event, not a silent hole in
    // the proof.
    expect(walk.external).toEqual(["zod"]);
  });

  test("positive control: the same walker reports node builtins on the `.` barrel", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(barrel.unresolved).toEqual([]);
    // Reached ONLY through the bare specifier @caisson-sh/billing, so this doubles as proof that the
    // walker follows workspace exports maps rather than stopping at the first package edge.
    expect(
      barrel.offenders.some(
        (o) => o.file === "packages/billing/src/webhook.ts",
      ),
    ).toBe(true);
    expect(barrel.offenders.every((o) => o.spec.startsWith("node:"))).toBe(
      true,
    );
    // `pg` is the tenancy-rls edge — an external package, so it lands on the frontier, not in
    // offenders. Named here so the barrel's server-only shape is stated, not implied.
    expect(barrel.external).toContain("pg");
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
    expect(Object.keys(browser).sort()).toEqual([
      "assertValidSourceEventId",
      "sideEffectEventKey",
    ]);
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
