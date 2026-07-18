import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  buildShadcnRegistry,
  parseBarrelModules,
} from "./gen-shadcn-registry.ts";

const repoRoot = resolve(import.meta.dir, "..");

describe("buildShadcnRegistry — explicit per-file targets (CAISSON-126)", () => {
  const registry = buildShadcnRegistry(repoRoot);

  test("caisson-tokens theme item target is unchanged (literal styles path)", () => {
    const theme = registry.items.find((i) => i.name === "caisson-tokens");
    expect(theme).toBeDefined();
    expect(theme?.files).toEqual([
      {
        path: "packages/ui/styles/tokens.css",
        type: "registry:file",
        target: "styles/caisson-tokens.css",
      },
    ]);
  });

  test("button item's files carry flat @ui/ targets, not a nested packages/ui path", () => {
    const button = registry.items.find((i) => i.name === "button");
    expect(button).toBeDefined();
    const tsx = button?.files.find((f) => f.path.endsWith("button.tsx"));
    const css = button?.files.find((f) => f.path.endsWith("button.css"));
    expect(tsx?.target).toBe("@ui/button.tsx");
    expect(css?.target).toBe("@ui/button.css");
  });

  test("every registry:ui file across every item has a target and no item has duplicate targets", () => {
    for (const item of registry.items) {
      const seen = new Set<string>();
      for (const file of item.files) {
        expect(file.target).toBeDefined();
        expect(seen.has(file.target!)).toBe(false);
        seen.add(file.target!);
      }
    }
  });

  test("no component item file targets a nested packages/ path", () => {
    for (const item of registry.items) {
      if (item.name === "caisson-tokens") continue;
      for (const file of item.files) {
        expect(file.target).toMatch(/^@ui\//);
      }
    }
  });
});

describe("parseBarrelModules (unchanged behavior sanity check)", () => {
  test("still finds real barrel modules", () => {
    const barrel = Bun.file(
      resolve(repoRoot, "packages/ui/src/components/index.ts"),
    );
    return barrel.text().then((source) => {
      const mods = parseBarrelModules(source);
      expect(mods).toContain("button");
      expect(mods.length).toBeGreaterThan(30);
    });
  });
});
