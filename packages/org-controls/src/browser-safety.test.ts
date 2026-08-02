// The browser-safety contract for `./browser` (ADR-0396) — proven by a STATIC SOURCE-GRAPH WALK,
// never by a build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps
// in crypto-browserify and the client chunk silently grows ~428KB, exit 0).
//
// This package's blocker is NOT a node builtin — the `.` barrel reaches zero of them. It is the
// EXTERNAL frontier: `@clerk/backend` (a JWKS-verifying SDK) and `pg` (a Postgres driver, reached
// through @caisson/tenancy-rls). So the walk's `external` set is the load-bearing assertion here,
// alongside the offender/unresolved channels. A walker that only counted `node:` specifiers would
// have called the whole barrel clean.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { nodeBuiltinTaint } from "@caisson/testing/module-graph";

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

  test("the external frontier carries no server-only package", () => {
    // zod rides in through the kernel barrel and is browser-safe; the two that are not must be
    // unreachable, and this is the ONLY channel that can say so (they are not `node:` specifiers).
    expect(walk.external).toEqual(["zod"]);
  });

  test("guard the guard: the walk really resolved a graph, including across packages", () => {
    expect(walk.files.length).toBeGreaterThan(5);
    expect(walk.files.some((f) => f.includes("packages/kernel/src/"))).toBe(
      true,
    );
    // The db-bound and SSO halves stay out of the graph entirely.
    for (const f of ["membership.ts", "clerk.ts", "workos.ts"]) {
      expect(walk.files.some((p) => p.endsWith(`org-controls/src/${f}`))).toBe(
        false,
      );
    }
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
  });

  test("the `.` barrel is what a client bundle must not reach", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(barrel.external).toContain("@clerk/backend");
    expect(barrel.external).toContain("pg");
  });

  test("positive control: the walker still flags a known-tainted graph", () => {
    // @caisson/auth is a real dependency of this package and its barrel IS node:crypto-tainted
    // (jwt.ts, session-token.ts). gate.ts imports `Role` from it as a statement-level `import
    // type`, which is erased — this control proves that erasure is doing real work, and that a
    // walker gone blind fails here instead of greening the entry vacuously.
    const auth = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/auth/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      auth.offenders.some(
        (o) =>
          o.file === "packages/auth/src/jwt.ts" && o.spec === "node:crypto",
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
    // …and strictly fewer: the transport + db-bound half is why the barrel still exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });

  test("the gate on ./browser IS the function the barrel exports, not a second copy", async () => {
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    expect(browser.assertCanManageMembers).toBe(barrel.assertCanManageMembers);
  });
});
