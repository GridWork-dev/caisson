import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";

const PACKAGE_ROOT = join(import.meta.dir, "..");
const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const BROWSER_ENTRY = join(import.meta.dir, "browser.ts");

describe("the local-privacy decision-only browser entry", () => {
  test("is published as ./browser", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as { readonly exports?: Record<string, unknown> };
    expect(manifest.exports?.["./browser"]).toEqual({
      bun: "./src/browser.ts",
      types: "./dist/browser.d.ts",
      default: "./dist/browser.js",
    });
  });

  test("contains policy decisions but no fetch-capable module", () => {
    expect(existsSync(BROWSER_ENTRY)).toBe(true);
    if (!existsSync(BROWSER_ENTRY)) return;
    const walk = nodeBuiltinTaint(BROWSER_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([]);
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/local-privacy/src/"))
        .sort(),
    ).toEqual([
      "packages/local-privacy/src/browser.ts",
      "packages/local-privacy/src/decision-guard.ts",
      "packages/local-privacy/src/policy.ts",
    ]);
    for (const excluded of [
      "packages/local-privacy/src/egress-guard.ts",
      "packages/kernel/src/config.ts",
      "packages/kernel/src/event-sink.ts",
      "packages/kernel/src/fetch.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
    expect(walk.external).toEqual(["zod"]);
  });

  test("is a strict one-way runtime subset of the main entry", async () => {
    if (!existsSync(BROWSER_ENTRY)) return;
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    expect(Object.keys(browser).length).toBeGreaterThan(0);
    expect(
      Object.keys(browser).filter((name) => !Object.hasOwn(barrel, name)),
    ).toEqual([]);
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
