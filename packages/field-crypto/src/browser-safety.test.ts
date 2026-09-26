// The browser-safety contract for `./browser` (ADR-0396) — proven by a STATIC SOURCE-GRAPH WALK,
// never by a build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps
// in crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker
// resolves relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports
// map, so the zero-offender claim covers the whole graph, kernel included.
//
// The walker's own blind spot is node GLOBALS (`Buffer` is not an import), and this package is where
// that matters most: every byte handled here used to be a `Buffer`. The second test scans the SAME
// walked files for them.
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
    // This package's own modules add none: portable.ts hand-rolls the base64/hex codecs precisely so
    // no `Buffer` reaches this graph and pulls the `buffer/` polyfill in behind it.
    expect(
      globals.filter((o) => o.file.startsWith("packages/field-crypto/")),
    ).toEqual([]);
    expect(globals).toEqual([]);
    for (const excluded of [
      "packages/kernel/src/config.ts",
      "packages/kernel/src/event-sink.ts",
      "packages/kernel/src/fetch.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
  });

  test("guard the guard: the walk really resolved a graph, including across packages", () => {
    expect(walk.files.length).toBeGreaterThan(2);
    expect(walk.files).toContain("packages/field-crypto/src/portable.ts");
    expect(walk.files.some((f) => f.includes("packages/kernel/src/"))).toBe(
      true,
    );
    // …and never the node-only halves the entry exists to keep out of a client bundle.
    for (const excluded of [
      "packages/field-crypto/src/cipher.ts",
      "packages/field-crypto/src/derive.ts",
      "packages/field-crypto/src/envelope.ts",
      "packages/field-crypto/src/column.ts",
      "packages/field-crypto/src/kms.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
  });

  test("the external frontier is exactly zod, reached through the kernel", () => {
    expect(walk.external).toEqual(["zod"]);
  });

  test("positive control: the `.` barrel DOES report the node-only halves", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    const tainted = [...new Set(barrel.offenders.map((o) => o.file))];
    for (const expected of [
      "packages/field-crypto/src/cipher.ts",
      "packages/field-crypto/src/derive.ts",
    ]) {
      expect(tainted).toContain(expected);
    }
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
    // …and strictly fewer: the KMS/Drizzle/node half is why the barrel still exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
