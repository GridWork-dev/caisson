// The browser-safety contract for `./browser` — proven by a STATIC SOURCE-GRAPH WALK, never by a
// build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps in
// crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker resolves
// relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports map, and
// reports any edge it could not follow, so a skipped edge can never read as clean.
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

  test("guard the guard: the walk really crossed into the kernel, past the first hop", () => {
    expect(walk.files).toContain("packages/local-store/src/rrf.ts");
    expect(walk.files.some((f) => f.includes("packages/kernel/src/"))).toBe(
      true,
    );
    // …and never the SQLite half, which has no browser form at all.
    expect(walk.files).not.toContain("packages/local-store/src/store.ts");
    expect(walk.files).not.toContain("packages/local-store/src/tenant-db.ts");
    expect(walk.files).not.toContain("packages/local-store/src/gc.ts");
  });

  test("`bun:sqlite` and `sqlite-vec` are not on the entry's external frontier", () => {
    // A `bun:`-prefixed specifier is NOT `node:`-prefixed, so the offender channel structurally
    // cannot catch it — the external frontier is where it would surface, and this package is the
    // one where that distinction actually bites.
    expect(walk.external).not.toContain("bun:sqlite");
    expect(walk.external).not.toContain("sqlite-vec");
  });

  test("positive control: the `.` barrel DOES report the irreducibly node-only modules", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // endsWith, not exact paths — offender files are workspace-root-relative.
    expect(barrel.offenders.some((o) => o.file.endsWith("src/store.ts"))).toBe(
      true,
    );
    expect(
      barrel.offenders.some((o) => o.file.endsWith("src/tenant-db.ts")),
    ).toBe(true);
    expect(
      barrel.offenders.some(
        (o) => o.file.endsWith("src/gc.ts") && o.spec === "node:crypto",
      ),
    ).toBe(true);
    // …and the barrel really does drag in the SQLite package the browser entry never touches.
    expect(barrel.external).toContain("bun:sqlite");
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
    // …and strictly fewer: the database half is the reason the barrel still exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
