// The browser-safety contract for `./browser` (ADR-0396) — proven by a STATIC SOURCE-GRAPH WALK,
// never by a build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps
// in crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker
// resolves relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports
// map, so the zero-offender claim covers the whole graph, kernel included.
//
// This package's two node-only modules are reached by DIFFERENT mechanisms — hooks.ts imports
// node:child_process directly, audit-lifecycle.ts imports the `@caisson-sh/kernel/node` subpath — so
// the positive control below pins one of each: a walker blind to bare specifiers and a walker
// blind to `node:` both fail loudly here instead of greening vacuously.
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

  test("guard the guard: the walk really resolved a graph, including across packages", () => {
    expect(walk.files).toContain("packages/agent-kernel/src/lifecycle.ts");
    expect(walk.files).toContain(
      "packages/agent-kernel/src/redacting-logger.ts",
    );
    // The kernel edge is a BARE specifier — this is the assertion that fails if @caisson-sh/*
    // resolution goes blind and the whole zero-offender result becomes a walk over nothing.
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the node-only halves stay out of the graph entirely", () => {
    expect(walk.files).not.toContain("packages/agent-kernel/src/hooks.ts");
    expect(walk.files).not.toContain(
      "packages/agent-kernel/src/audit-lifecycle.ts",
    );
    expect(walk.files).not.toContain("packages/kernel/src/node.ts");
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    expect(walk.external).toEqual(["zod"]);
  });

  test("positive control: the `.` barrel DOES report both node-only mechanisms", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // Direct `node:` import in this package…
    expect(
      barrel.offenders.some(
        (o) =>
          o.file.endsWith("agent-kernel/src/hooks.ts") &&
          o.spec === "node:child_process",
      ),
    ).toBe(true);
    // …and one reached only through the `@caisson-sh/kernel/node` subpath.
    expect(
      barrel.offenders.some((o) => o.file.endsWith("kernel/src/crypto.ts")),
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
    // …and strictly fewer: the node-only half is the reason the barrel still exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
