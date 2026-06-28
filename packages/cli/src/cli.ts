// `create-caisson` entry (ADR-0004/T18). Parses --name/--edition/--module/--out/--dry-run/--help,
// validates the selection against the registry ALLOWLIST, materializes to disk via the path-safe
// FileSetWriter, runs `git init` in the output directory (fail-soft), and prints a next-steps
// block to stdout. The registry index is resolved via `import.meta.url` (cwd-independent) with
// an env override for CI / local overrides.
import { execFile as execFileCb } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type RegistryIndex,
  loadRegistryIndexFromFile,
} from "@caisson/registry";
import { type GeneratedFileSet, type Selection, generate } from "./generate.ts";
import { createFileSetWriter } from "./writer.ts";

/**
 * Parse argv into a RAW selection (validated downstream by Zod `.strict()` — never trusted here).
 * Flags: `--name <slug>`, `--edition <e>`, `--module <id@version>` (repeatable).
 */
export function parseArgs(argv: readonly string[]): unknown {
  const modules: { id: string; version: string }[] = [];
  let projectName: string | undefined;
  let edition: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--name") {
      projectName = value;
      i++;
    } else if (flag === "--edition") {
      edition = value;
      i++;
    } else if (flag === "--module") {
      // Split on the LAST "@" so a scoped id (@caisson/x) keeps its leading "@".
      const at = value === undefined ? -1 : value.lastIndexOf("@");
      if (value === undefined || at <= 0) {
        throw new Error(
          `--module expects <id@version>, got ${JSON.stringify(value)}`,
        );
      }
      modules.push({ id: value.slice(0, at), version: value.slice(at + 1) });
      i++;
    } else {
      throw new Error(`unknown argument: ${JSON.stringify(flag)}`);
    }
  }
  // Leave fields possibly-undefined → Zod `.strict()` reports the precise validation error.
  return {
    ...(projectName !== undefined ? { projectName } : {}),
    ...(edition !== undefined ? { edition } : {}),
    modules,
  };
}

/** Validate argv against the registry allowlist and return the generation plan (no disk write). */
export function runCli(
  argv: readonly string[],
  deps: { index: RegistryIndex },
): { selection: Selection; files: GeneratedFileSet } {
  return generate(deps.index, parseArgs(argv));
}

/**
 * Resolve the registry index the CLI validates against.
 *
 * Priority:
 *  1. `CAISSON_REGISTRY_INDEX` env override (CI / local dev overrides).
 *  2. Bundled snapshot anchored to `import.meta.url` — cwd-independent; works from a published bin.
 *     In the monorepo resolves to `<repo>/registry/index.json`.
 */
function resolveIndexPath(): string {
  const fromEnv = process.env.CAISSON_REGISTRY_INDEX;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  // packages/cli/src/cli.ts → ../../../registry/index.json = <repo>/registry/index.json
  return fileURLToPath(
    new URL("../../../registry/index.json", import.meta.url),
  );
}

const HELP = `\
create-caisson — scaffold a repo from the Caisson registry

Usage:
  create-caisson --name <slug> --module <id@version> [--module …] \\
    [--edition <e>] [--out <dir>] [--dry-run]

Flags:
  --name <slug>          Project name (a-z, 0-9, kebab slug; max 64 chars)
  --module <id@version>  @caisson module (repeatable; exact semver version)
  --edition <e>          compliance | ai-kit | local-ai | agent-dev
  --out <dir>            Output directory (defaults to <projectName>)
  --dry-run              Print the file plan without writing anything to disk
  --help, -h             Show this help

Before running the installer, add NODE_AUTH_TOKEN (your Caisson license key) to .npmrc.
See the generated README for the full setup steps — or https://caisson.sh/docs.
`;

/**
 * Thin Promise wrapper around `execFile` using an ARGUMENT ARRAY — no shell-string interpolation
 * (ADR-0068 / Caisson security floor). Never called with template-literal or concatenated input.
 */
function execFileAsync(cmd: string, args: readonly string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFileCb(cmd, args, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Attempt `git init <dir>` fail-soft: a missing git binary or non-zero exit prints a notice and
 * returns; the rest of post-generation continues. Security: execFile arg-array only, never a
 * shell-string (ADR-0068).
 */
async function tryGitInit(dir: string): Promise<void> {
  // Resolve to an absolute path first: a `--out` value beginning with `-` would otherwise be read
  // by `git init` as a flag, not a directory (SECURITY.md INFO-2). Resolution also matches the dir
  // the writer materialized into (it resolves identically), so git initializes the right tree.
  await execFileAsync("git", ["init", resolve(dir)]).catch((e: unknown) => {
    process.stdout.write(
      `create-caisson: git init skipped — ${(e as Error).message}\n`,
    );
  });
}

function printNextSteps(projectName: string, targetDir: string): void {
  process.stdout.write(
    `\ncreate-caisson: generated "${projectName}" → ${targetDir}\n` +
      `\nNext steps:\n` +
      `  1. cd ${targetDir}\n` +
      `  2. Add your Caisson license key to .npmrc (see README.md)\n` +
      `  3. bun install   # or: npm install\n` +
      `  4. bun run build\n` +
      `\nDocs: https://caisson.sh/docs\n`,
  );
}

if (import.meta.main) {
  void (async () => {
    const argv = process.argv.slice(2);

    // Extract --help / --dry-run / --out before passing the remainder to parseArgs.
    // Flag-value pairs for --name / --edition / --module flow through untouched.
    const selectionArgs: string[] = [];
    let out: string | undefined;
    let dryRun = false;
    let help = false;

    for (let i = 0; i < argv.length; i++) {
      const flag = argv[i];
      if (flag === "--help" || flag === "-h") {
        help = true;
      } else if (flag === "--dry-run") {
        dryRun = true;
      } else if (flag === "--out") {
        const next = argv[i + 1];
        if (next === undefined) {
          process.stderr.write("create-caisson: --out requires a directory\n");
          process.exit(1);
        }
        out = next;
        i++;
      } else if (flag !== undefined) {
        selectionArgs.push(flag);
      }
    }

    try {
      if (help) {
        process.stdout.write(HELP);
        process.exit(0);
      }

      const index = loadRegistryIndexFromFile(resolveIndexPath());
      const { selection, files } = runCli(selectionArgs, { index });
      const targetDir = out ?? selection.projectName;

      if (dryRun) {
        process.stdout.write(
          `create-caisson: dry-run — ${files.length} files for ` +
            `"${selection.projectName}"` +
            `${selection.edition ? ` (${selection.edition} edition)` : ""}\n`,
        );
        for (const f of files) {
          process.stdout.write(`  ${f.path}\n`);
        }
        process.exit(0);
      }

      const write = createFileSetWriter();
      await write(targetDir, files);
      await tryGitInit(targetDir);
      printNextSteps(selection.projectName, targetDir);
    } catch (e) {
      process.stderr.write(`create-caisson: ${(e as Error).message}\n`);
      process.exit(1);
    }
  })();
}
