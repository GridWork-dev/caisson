import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadBaseManifest } from "./read";

function readUiVersion(): string {
  const input: unknown = JSON.parse(
    readFileSync(resolve(import.meta.dir, "../../ui/package.json"), "utf8"),
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

describe("loadBaseManifest", () => {
  test("reads and validates the committed generated base manifest", () => {
    const manifest = loadBaseManifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.generatedFor.pkg).toBe("@caisson-sh/ui");
    expect(manifest.generatedFor.version).toBe(readUiVersion());
    expect(manifest.components).toHaveLength(39);
  });

  test("covers both a data-* component and a no-data-* one (variants derive from TS types, not attribute scanning)", () => {
    const manifest = loadBaseManifest();
    const button = manifest.components.find((c) => c.name === "Button");
    const terminal = manifest.components.find((c) => c.name === "Terminal");
    expect(button?.hasDataStar).toBe(true);
    expect(terminal?.hasDataStar).toBe(false);
    // A no-data-* component still carries its typed props — the schema never silently drops it.
    expect(terminal?.props.length).toBeGreaterThan(0);
  });

  test("every component carries a non-empty name and summary", () => {
    const manifest = loadBaseManifest();
    for (const c of manifest.components) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.summary.length).toBeGreaterThan(0);
    }
  });
});
