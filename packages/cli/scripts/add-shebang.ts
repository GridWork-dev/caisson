// Post-tsc shebang hook (ADR-0092/0111). `tsc` emits `dist/cli.js` WITHOUT a shebang, but the
// published `create-caisson` bin (`./dist/cli.js`) must be directly executable by `npx`/`node` —
// the OS exec path needs `#!/usr/bin/env node` on line 1. This build step prepends it after `tsc`
// runs, mirroring the `bundle-migrations.ts` build-hook pattern (a deterministic, idempotent file
// step resolved via `import.meta.url`, never cwd). Idempotent: a second run is a no-op, so a
// repeated `bun run build` never stacks shebangs. A missing `dist/cli.js` is a hard error — the
// hook must run AFTER `tsc -p tsconfig.json`, never against an unbuilt tree.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SHEBANG = "#!/usr/bin/env node";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/cli/scripts
/** The compiled CLI entry the published `bin` points at (`packages/cli/dist/cli.js`). */
export const CLI_DIST = join(HERE, "..", "dist", "cli.js");

/**
 * Prepend the node shebang to a built CLI file if absent. Pure on inputs (takes the target path),
 * idempotent (returns false when the shebang is already line 1), fail-closed on a missing build.
 */
export function ensureShebang(target: string = CLI_DIST): boolean {
  if (!existsSync(target)) {
    throw new Error(
      `add-shebang: ${target} not found — run after \`tsc -p tsconfig.json\` (ADR-0092).`,
    );
  }
  const body = readFileSync(target, "utf8");
  if (body.startsWith(`${SHEBANG}\n`) || body === SHEBANG) return false;
  writeFileSync(target, `${SHEBANG}\n${body}`);
  return true;
}

if (import.meta.main) {
  const added = ensureShebang();
  // A build script reports what it did (process.stdout, not console — no-console floor).
  process.stdout.write(
    added
      ? `cli: prepended '${SHEBANG}' to dist/cli.js\n`
      : `cli: dist/cli.js already has the node shebang — no-op\n`,
  );
}
