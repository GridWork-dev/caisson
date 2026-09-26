import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";

const PACKAGE_ROOT = join(import.meta.dir, "..");
const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const BROWSER_ENTRY = join(import.meta.dir, "browser.ts");
const BARREL_ENTRY = join(import.meta.dir, "index.ts");

describe("package metadata for the browser/WebCrypto seam", () => {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
  ) as {
    readonly engines?: { readonly node?: string };
    readonly exports?: Record<string, unknown>;
  };

  test("publishes ./browser and pins the WebCrypto-capable Node floor", () => {
    expect(manifest.exports?.["./browser"]).toEqual({
      bun: "./src/browser.ts",
      types: "./dist/browser.d.ts",
      default: "./dist/browser.js",
    });
    expect(manifest.engines?.node).toBe(">=20.12.0");
  });
});

describe("`./browser` is the exact browser-safe inference subset", () => {
  const walk = nodeBuiltinTaint(BROWSER_ENTRY, {
    workspaceRoot: WORKSPACE_ROOT,
  });

  test("the full runtime graph has no node builtin or unresolved edge", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("has no Node global or network-capable kernel path", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([]);
    for (const excluded of [
      "packages/kernel/src/config.ts",
      "packages/kernel/src/event-sink.ts",
      "packages/kernel/src/fetch.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
  });

  test("the external frontier is exactly the known browser-safe allowlist", () => {
    expect(walk.external).toEqual(["zod"]);
  });

  test("the package-local graph is exactly port, model coordinates, and stub", () => {
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/local-inference/src/"))
        .sort(),
    ).toEqual([
      "packages/local-inference/src/backend.ts",
      "packages/local-inference/src/browser.ts",
      "packages/local-inference/src/model.ts",
      "packages/local-inference/src/stub.ts",
    ]);
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
  });

  test("the main barrel remains a positive taint control for excluded server code", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(barrel.unresolved).toEqual([]);
    expect(barrel.offenders).toContainEqual({
      file: "packages/local-inference/src/onnx-backend.ts",
      spec: "node:crypto",
    });
    expect(barrel.offenders).toContainEqual({
      file: "packages/local-inference/src/sigv4.ts",
      spec: "node:crypto",
    });
  });
});

describe("`./browser` is a one-way exact subset of `.`", () => {
  test("exports only the port constants and real deterministic stub", async () => {
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    expect(Object.keys(browser).sort()).toEqual([
      "DEFAULT_ONNX_MODEL",
      "EMBEDDING_DIM",
      "StubInferenceBackend",
    ]);
    expect(
      Object.keys(browser).filter((name) => !Object.hasOwn(barrel, name)),
    ).toEqual([]);
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
