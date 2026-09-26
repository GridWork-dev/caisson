// The browser-safety contract for `./browser` (ADR-0396) — proven by a STATIC SOURCE-GRAPH WALK,
// never by a build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps
// in crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker
// resolves relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports
// map, so the zero-offender claim covers the whole graph, kernel included.
//
// The walker's own blind spot is node GLOBALS (`Buffer` is not an import), so the second describe
// scans the SAME walked files for them — a `Buffer` here would pull the `buffer/` polyfill into a
// client bundle exactly as silently.
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

  test("nor uses a node global — the walker's blind spot, scanned separately", () => {
    const globals = nodeGlobalTaint(walk.files, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // This package's own modules add none. `Buffer` is the one that matters: it is what the hex and
    // base64 codecs in portable.ts deliberately do NOT use.
    expect(
      globals.filter((o) => o.file.startsWith("packages/signing-primitive/")),
    ).toEqual([]);
    // The single pre-existing hit in the wider graph, NAMED rather than filtered away blind:
    // @caisson-sh/kernel's `loadConfig(schema, source = process.env)` default parameter, which has been
    // on the kernel `.` barrel since its ./node split. A bundler substitutes a static object for it.
    expect(globals).toEqual([
      { file: "packages/kernel/src/config.ts", spec: "process" },
    ]);
  });

  test("guard the guard: the walk really resolved a graph, including across packages", () => {
    expect(walk.files.length).toBeGreaterThan(2);
    expect(walk.files).toContain("packages/signing-primitive/src/portable.ts");
    expect(walk.files.some((f) => f.includes("packages/kernel/src/"))).toBe(
      true,
    );
    // …and never sign.ts, which is exactly what the split exists to keep out of a client bundle.
    expect(walk.files).not.toContain("packages/signing-primitive/src/sign.ts");
  });

  test("the external frontier is exactly the two dependency-free crypto/JSON leaves", () => {
    // @noble/ed25519 is pure JS with zero node imports (verified: its only runtime lookup is
    // `globalThis.crypto`), so leaving it unwalked does not weaken the claim above. Pinned so a new
    // external edge on this entry has to be justified in a diff, never absorbed silently.
    expect(walk.external).toEqual(["@noble/ed25519", "zod"]);
  });

  test("positive control: the `.` barrel DOES report the node-only signing half", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(
      barrel.offenders.some(
        (o) => o.file.endsWith("src/sign.ts") && o.spec === "node:crypto",
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
    // …and strictly fewer: the signing identity + constant-time compares are why the barrel exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
