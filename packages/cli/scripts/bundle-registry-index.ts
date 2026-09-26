// Module-catalog BUNDLER: derives the generator's module catalog from the workspace at build time
// and writes it into the CLI package root, so a PUBLISHED install (which never sees the monorepo)
// ships it. `resolveIndexPath()` (`src/resolve-index-path.ts`) reads it back via `import.meta.url`,
// same depth from `src/cli.ts` (dev) and `dist/cli.js` (built/published). Gitignored build
// artifact, regenerated every build, never hand-edited.
//
// Source of truth: every non-private `packages/*` package. The id and version come from its
// package.json (the changesets version truth); description, dependencies and stability come from its
// `manifest.ts`, which the standards gate holds in agreement with package.json. One version per
// module: the catalog is what this checkout would publish, not a publish history.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ModuleManifest,
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/cli/scripts
export const PACKAGES_DIR = join(HERE, "..", "..");
export const BUNDLED_INDEX = join(HERE, "..", "registry-index.json");

const PackageJson = z.object({
  name: z.string(),
  version: z.string(),
  private: z.boolean().optional(),
});

export async function buildCatalog(
  packagesDir: string = PACKAGES_DIR,
): Promise<RegistryIndex> {
  const modules: RegistryIndex["modules"] = [];
  for (const dir of readdirSync(packagesDir).sort()) {
    const pkgPath = join(packagesDir, dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = PackageJson.parse(JSON.parse(readFileSync(pkgPath, "utf8")));
    if (pkg.private === true) continue;
    const { default: raw }: { default: unknown } = await import(
      join(packagesDir, dir, "manifest.ts")
    );
    const manifest = ModuleManifest.parse(raw);
    if (manifest.id !== pkg.name || manifest.version !== pkg.version) {
      throw new Error(
        `${dir}: manifest ${manifest.id}@${manifest.version} disagrees with package.json ${pkg.name}@${pkg.version}`,
      );
    }
    modules.push({
      id: pkg.name,
      latest: pkg.version,
      versions: [{ version: pkg.version, manifest }],
    });
  }
  return loadRegistryIndex({ schemaVersion: 1, modules });
}

export async function bundleCatalog(
  dest: string = BUNDLED_INDEX,
  packagesDir: string = PACKAGES_DIR,
): Promise<RegistryIndex> {
  const catalog = await buildCatalog(packagesDir);
  writeFileSync(dest, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

if (import.meta.main) {
  const catalog = await bundleCatalog();
  process.stdout.write(
    `cli: bundled ${catalog.modules.length} workspace modules -> ${BUNDLED_INDEX}\n`,
  );
}
