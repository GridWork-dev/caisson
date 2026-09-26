// Registry-index BUNDLER: copies the canonical `registry/index.json` into the CLI package root at
// build time,
// so a PUBLISHED install (which never sees the monorepo's `registry/` dir — 3 levels above
// `packages/cli`, never bundled by `files`) still ships a usable snapshot. `resolveIndexPath()`
// (`src/resolve-index-path.ts`) reads it back via `import.meta.url`, same depth from `src/cli.ts`
// (dev) and `dist/cli.js` (built/published). Gitignored build artifact, regenerated every build —
// never hand-edited, never committed; `registry/index.json` stays the single source of truth
// (ADR-0047).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/cli/scripts
export const SOURCE_INDEX = join(
  HERE,
  "..",
  "..",
  "..",
  "registry",
  "index.json",
);
export const BUNDLED_INDEX = join(HERE, "..", "registry-index.json");

export function bundleRegistryIndex(
  source: string = SOURCE_INDEX,
  dest: string = BUNDLED_INDEX,
): void {
  if (!existsSync(source)) {
    throw new Error(`registry index not found at ${source}`);
  }
  copyFileSync(source, dest);
}

if (import.meta.main) {
  bundleRegistryIndex();
  process.stdout.write(
    `cli: bundled registry/index.json -> ${BUNDLED_INDEX}\n`,
  );
}
