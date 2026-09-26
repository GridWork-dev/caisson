// Registry-index PATH RESOLUTION (ADR-0004/0092). Pure — only node:fs/node:url — so this module
// carries ZERO workspace imports and runs standalone from a real `node_modules/@caisson/cli`
// install with no other package resolvable, exactly like the simulated-installed-layout test in
// `resolve-index-path.test.ts` proves. Fixes a real-install bug where the generator could not
// find its module registry once installed from npm outside this monorepo.
//
// Priority:
//  1. `CAISSON_REGISTRY_INDEX` env override (CI / local dev overrides).
//  2. The BUNDLED snapshot copied into the package root at build time
//     (`scripts/bundle-registry-index.ts`) and
//     shipped via `package.json` `files` — present in both a BUILT monorepo checkout and a real npm
//     install, because `dist/cli.js` (published) and `src/cli.ts` (dev) sit at the same depth under
//     the package root, so `../registry-index.json` resolves to the same place either way.
//  3. Dev fallback: an un-built monorepo source checkout (the bundle step hasn't run yet) reads the
//     canonical `<repo>/registry/index.json` directly. Never reachable from a real install — that
//     path sits 3 levels above `packages/cli` and is never bundled into the npm tarball.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function resolveIndexPath(): string {
  const fromEnv = process.env.CAISSON_REGISTRY_INDEX;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;

  const bundled = fileURLToPath(
    new URL("../registry-index.json", import.meta.url),
  );
  if (existsSync(bundled)) return bundled;

  // packages/cli/src/resolve-index-path.ts → ../../../registry/index.json = <repo>/registry/index.json
  return fileURLToPath(
    new URL("../../../registry/index.json", import.meta.url),
  );
}
