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

describe("the narrow kernel browser entry", () => {
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

  test("has no Node global, config, event sink, or network path", () => {
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
    for (const excluded of [
      "config.ts",
      "event-sink.ts",
      "fetch.ts",
    ] as const) {
      expect(walk.files).not.toContain(`packages/kernel/src/${excluded}`);
    }
    expect(walk.external).toEqual(["zod"]);
  });

  test("is a strict runtime subset of the existing browser-safe barrel", async () => {
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
