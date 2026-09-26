// The browser-safety contract for `./browser`: prove the source graph itself, including workspace
// dependencies and Node globals. A successful bundle is not evidence because bundlers may polyfill.
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

  test("has no reachable Node builtin or unresolved import", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("adds no Node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([]);
  });

  test("has an exact package-module allowlist and browser-safe external frontier", () => {
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/guardrails/src/"))
        .sort(),
    ).toEqual([
      "packages/guardrails/src/browser.ts",
      "packages/guardrails/src/guard-browser.ts",
      "packages/guardrails/src/guard-core.ts",
      "packages/guardrails/src/moderator.ts",
      "packages/guardrails/src/pii-browser.ts",
      "packages/guardrails/src/pii-core.ts",
    ]);
    expect(walk.files).toContain("packages/field-crypto/src/portable.ts");
    expect(
      walk.files.some((file) => file.startsWith("packages/kernel/src/")),
    ).toBe(true);
    for (const excluded of [
      "packages/kernel/src/config.ts",
      "packages/kernel/src/event-sink.ts",
      "packages/kernel/src/fetch.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
    expect(walk.external).toEqual(["zod"]);
  });

  test("positive control: the main barrel still exposes the Node sync path", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(barrel.offenders).toContainEqual({
      file: "packages/guardrails/src/pii.ts",
      spec: "node:crypto",
    });
  });
});

describe("`./browser` is an exact one-way public subset", () => {
  test("every browser runtime export is a main-barrel export", async () => {
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    expect(Object.keys(browser)).toEqual([
      "PII_COLUMN_CONTEXT",
      "PII_KINDS",
      "detectPii",
      "detokenizePiiAsync",
      "guardInputAsync",
      "guardOutput",
      "hashPiiAsync",
      "localModerator",
      "maskPii",
      "tokenizePiiAsync",
    ]);
    expect(
      Object.keys(browser).filter((name) => !Object.hasOwn(barrel, name)),
    ).toEqual([]);
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });

  test("shared leaves are the same functions, not browser copies", async () => {
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    for (const name of [
      "detectPii",
      "maskPii",
      "hashPiiAsync",
      "tokenizePiiAsync",
      "detokenizePiiAsync",
      "localModerator",
      "guardInputAsync",
    ] as const) {
      expect(browser[name]).toBe(barrel[name]);
    }
  });
});
