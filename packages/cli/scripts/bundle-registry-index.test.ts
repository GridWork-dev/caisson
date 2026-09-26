// Catalog-parity guard. The bundled catalog (`registry-index.json`, written by the build) must list
// every non-private `packages/*` package at exactly its package.json version, and nothing else.
// The expected side is read straight from the package.json files here, never through the bundler,
// so a package the bundler drops, or a version bump that was not rebundled, fails this test.
// Turbo builds the package before its tests run; a missing bundle fails, it never skips.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadRegistryIndexFromFile } from "@caisson/registry-schema";
import { BUNDLED_INDEX, PACKAGES_DIR } from "./bundle-registry-index.ts";

function workspaceVersions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dir of readdirSync(PACKAGES_DIR)) {
    const path = join(PACKAGES_DIR, dir, "package.json");
    if (!existsSync(path)) continue;
    const pkg = JSON.parse(readFileSync(path, "utf8")) as {
      name: string;
      version: string;
      private?: boolean;
    };
    if (pkg.private !== true) out[pkg.name] = pkg.version;
  }
  return out;
}

describe("bundled module catalog", () => {
  test("lists every non-private workspace package at its package.json version", () => {
    if (!existsSync(BUNDLED_INDEX)) {
      throw new Error(
        `${BUNDLED_INDEX} is missing: run \`bun run build\` in packages/cli first`,
      );
    }
    const catalog = loadRegistryIndexFromFile(BUNDLED_INDEX);
    const bundled: Record<string, string[]> = {};
    for (const m of catalog.modules) {
      bundled[m.id] = [m.latest, ...m.versions.map((v) => v.version)];
    }
    const expected: Record<string, string[]> = {};
    for (const [name, version] of Object.entries(workspaceVersions())) {
      expected[name] = [version, version];
    }
    // Sanity floor: the workspace read itself found the packages (47 at the time of writing).
    expect(Object.keys(expected).length).toBeGreaterThanOrEqual(40);
    // One comparison so a failure lists every missing, extra, or stale module at once.
    expect(bundled).toEqual(expected);
  });
});
