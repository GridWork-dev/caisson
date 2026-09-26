import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseComponentManifest } from "@caisson-sh/ds-manifest";
import {
  assertManifestCurrent,
  buildComponentManifest,
  discoverPrimaryComponentExports,
  hasRawColorLiteral,
  renderComponentManifest,
  SECONDARY_COMPONENT_EXPORTS,
} from "./manifest-generator.ts";

const UI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = resolve(UI_ROOT, "../ds-manifest/src/base-manifest.json");

function readUiVersion(): string {
  const input: unknown = JSON.parse(
    readFileSync(resolve(UI_ROOT, "package.json"), "utf8"),
  );
  if (
    typeof input !== "object" ||
    input === null ||
    !("version" in input) ||
    typeof input.version !== "string"
  )
    throw new Error("@caisson-sh/ui package version is missing");
  return input.version;
}

describe("component-manifest generator", () => {
  test("discovers exactly one primary component per barrel module", () => {
    const exports = discoverPrimaryComponentExports(UI_ROOT);

    expect(exports).toHaveLength(39);
    expect(exports.map(({ name }) => name)).toEqual(
      [...exports.map(({ name }) => name)].sort(),
    );
    expect(new Set(exports.map(({ name }) => name)).size).toBe(39);
    expect(exports.some(({ name }) => name === "ToastRegion")).toBe(false);
    expect(exports.some(({ name }) => name === "LedgerRow")).toBe(false);
    expect(exports.some(({ name }) => name === "registerIcons")).toBe(false);
    expect(SECONDARY_COMPONENT_EXPORTS).toEqual(["LedgerRow", "ToastRegion"]);
  });

  test("emits a strict manifest in barrel-name order with real metadata", () => {
    const discovered = discoverPrimaryComponentExports(UI_ROOT);
    const manifest = parseComponentManifest(buildComponentManifest(UI_ROOT));

    expect(manifest.generatedFor).toEqual({
      pkg: "@caisson-sh/ui",
      version: readUiVersion(),
    });
    expect(manifest.components.map(({ name }) => name)).toEqual(
      discovered.map(({ name }) => name),
    );

    const button = manifest.components.find(({ name }) => name === "Button");
    expect(button?.variants).toEqual({
      size: ["md", "sm"],
      variant: ["ghost", "primary"],
    });
    expect(button?.tokenDeps).toContain("--cs-accent");
    expect(button?.props.some(({ name }) => name === "asChild")).toBe(true);
    expect(button?.recipeRules).toContain("radix-behavior-for-polymorphism");

    const icon = manifest.components.find(({ name }) => name === "Icon");
    expect(icon?.a11yNotes.length).toBeGreaterThan(0);

    const dataTable = manifest.components.find(
      ({ name }) => name === "DataTable",
    );
    expect(dataTable?.props.some(({ name }) => name === "rows")).toBe(true);
    expect(dataTable?.props.some(({ name }) => name === "className")).toBe(
      false,
    );
    const appShell = manifest.components.find(
      ({ name }) => name === "AppShell",
    );
    expect(appShell?.tokenDeps.some((name) => name.includes("shell-"))).toBe(
      false,
    );
    expect(
      manifest.components.filter(({ hasDataStar }) => hasDataStar),
    ).toHaveLength(27);

    const bundleCard = manifest.components.find(
      ({ name }) => name === "BundleCard",
    );
    const switchComponent = manifest.components.find(
      ({ name }) => name === "Switch",
    );
    expect(bundleCard?.hasDataStar).toBe(true);
    expect(switchComponent?.hasDataStar).toBe(false);

    const badge = manifest.components.find(({ name }) => name === "Badge");
    const mobileBuyBar = manifest.components.find(
      ({ name }) => name === "MobileBuyBar",
    );
    expect(badge?.a11yNotes).toEqual([]);
    expect(mobileBuyBar?.a11yNotes).toEqual([
      "Rendered markup explicitly wires `aria-label`, `role`.",
    ]);

    expect(hasRawColorLiteral("color: oklch(0.5 0.1 220);")).toBe(true);
    expect(hasRawColorLiteral("color: var(--cs-fg);")).toBe(false);
    const codeBlock = manifest.components.find(
      ({ name }) => name === "CodeBlock",
    );
    expect(codeBlock?.recipeRules).toContain("co-located-css-tokens-only");
  });

  test("is byte-deterministic and detects synthetic drift", () => {
    const first = renderComponentManifest(buildComponentManifest(UI_ROOT));
    const second = renderComponentManifest(buildComponentManifest(UI_ROOT));

    expect(second).toBe(first);
    expect(() => assertManifestCurrent(first, second)).not.toThrow();
    expect(() =>
      assertManifestCurrent(
        first.replace('"schemaVersion": 1', '"schemaVersion": 2'),
        second,
      ),
    ).toThrow("component manifest drift");
  });

  test("the committed manifest is a byte-identical generated artifact", () => {
    const committed = readFileSync(MANIFEST_PATH, "utf8");
    const generated = renderComponentManifest(buildComponentManifest(UI_ROOT));

    assertManifestCurrent(committed, generated);
  });
});
