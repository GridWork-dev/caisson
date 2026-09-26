// The browser-safety contract for `./browser` (ADR-0396).
//
// WHY A STATIC SOURCE WALK AND NOT A BUILD: a bundler does not fail on a node builtin, it
// SUBSTITUTES one, so an `exit 0` build proves nothing. This package's own risk is narrower than a
// builtin and even quieter: the `.` barrel reaches `@caisson-sh/tenancy-rls` through schema.ts, which
// puts the `pg` driver on the graph. `pg` is not a `node:` specifier, so the offender list alone
// would never catch it — the external-frontier assertion below is what does.
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
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the unwalked external frontier is exactly zod — the `pg` driver is absent", () => {
    expect(walk.external).toEqual(["zod"]);
  });

  test("the database half is unreachable from the entry", () => {
    for (const excluded of [
      "packages/prompt-registry/src/schema.ts",
      "packages/prompt-registry/src/registry.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
  });

  test("guard the guard: the walk crossed into kernel, not just this package", () => {
    // refs.ts and render.ts both import `@caisson-sh/kernel` — a resolver that went blind on
    // `@caisson-sh/*` specifiers would still report zero offenders, so this is the assertion that
    // keeps the clean result from being vacuous.
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
    expect(walk.files).toContain("packages/prompt-registry/src/refs.ts");
    expect(walk.files).toContain("packages/prompt-registry/src/render.ts");
  });

  test("positive control: the same walker still reports builtins on a tainted entry", () => {
    // `@caisson-sh/kernel/node` is the node half of a package this one depends on: a walker that had
    // stopped seeing imports at all would report zero here too.
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/kernel/src/node.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
    expect(tainted.offenders.some((o) => o.spec.startsWith("node:"))).toBe(
      true,
    );
  });

  test("positive control: the `.` barrel really does drag the driver this entry cuts", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(barrel.external).toContain("pg");
    expect(barrel.files).toContain("packages/prompt-registry/src/schema.ts");
    expect(
      barrel.files.some((f) => f.startsWith("packages/tenancy-rls/")),
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
