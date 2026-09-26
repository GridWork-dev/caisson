// Module-catalog PATH RESOLUTION (ADR-0004/0092). Pure — only node:fs/node:url — so this module
// carries ZERO workspace imports and runs standalone from a real `node_modules/@caisson-sh/cli`
// install with no other package resolvable, exactly like the simulated-installed-layout test in
// `resolve-index-path.test.ts` proves.
//
// Priority:
//  1. `CAISSON_REGISTRY_INDEX` env override (CI / local dev overrides).
//  2. The catalog the build derives from the workspace packages (`scripts/bundle-registry-index.ts`)
//     into the package root and ships via `package.json` `files` — present in both a BUILT monorepo
//     checkout and a real npm install, because `dist/cli.js` (published) and `src/cli.ts` (dev) sit
//     at the same depth under the package root, so `../registry-index.json` resolves to the same
//     place either way. An un-built checkout has no catalog: that throws, naming the fix.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function resolveIndexPath(): string {
  const fromEnv = process.env.CAISSON_REGISTRY_INDEX;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;

  const bundled = fileURLToPath(
    new URL("../registry-index.json", import.meta.url),
  );
  if (existsSync(bundled)) return bundled;
  throw new Error(
    `module catalog not found at ${bundled}: run \`bun run build\` in packages/cli, or set CAISSON_REGISTRY_INDEX`,
  );
}
