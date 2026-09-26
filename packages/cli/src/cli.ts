// `create-caisson` entry (ADR-0004). Parses --name/--module/--deploy/--framework/--out/--dry-run/
// --help (or a leading bare positional as the project name, e.g. `create-caisson my-app` — the
// advertised quickstart form), validates the selection against the module CATALOG, materializes
// to disk via the path-safe FileSetWriter, runs `git init` in the output directory (fail-soft), and
// prints a next-steps block to stdout. The catalog file is resolved via `resolveIndexPath()`
// (`./resolve-index-path.ts`, cwd-independent) with an env override for CI / local overrides.
import { execFile as execFileCb } from "node:child_process";
import { resolve } from "node:path";
import {
  type RegistryIndex,
  loadRegistryIndexFromFile,
} from "@caisson-sh/registry-schema";
import {
  type GeneratedFileSet,
  type RawSelection,
  type Selection,
  generate,
} from "./generate.ts";
import type * as InteractiveModule from "./interactive.ts";
import { resolveIndexPath } from "./resolve-index-path.ts";
import { createFileSetWriter } from "./writer.ts";

/**
 * Parse argv into a RAW selection (validated downstream by Zod `.strict()` — never trusted here).
 * Flags: `--name <slug>`, `--module <id@version>` (repeatable), `--deploy <railway|fly|vercel>`
 * (ADR-0268), `--framework <next>` (ADR-0287). A leading BARE positional (any token not starting
 * with `-`) is also accepted as the project name — e.g. `create-caisson my-app`, the advertised
 * `bunx create-caisson my-app` quickstart — exactly equivalent to `--name my-app`; an explicit
 * `--name` always wins on conflict, regardless of argv order, since it is folded in last below.
 * Only the first bare token is ever taken as positional; a second one still fails closed as an
 * unknown argument.
 */
export function parseArgs(argv: readonly string[]): RawSelection {
  const modules: { id: string; version: string }[] = [];
  let projectName: string | undefined;
  let positionalName: string | undefined;
  let deployTarget: string | undefined;
  let framework: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--name") {
      projectName = value;
      i++;
    } else if (flag === "--deploy") {
      deployTarget = value;
      i++;
    } else if (flag === "--framework") {
      framework = value;
      i++;
    } else if (flag === "--module") {
      // Split on the LAST "@" so a scoped id (@caisson-sh/x) keeps its leading "@".
      const at = value === undefined ? -1 : value.lastIndexOf("@");
      if (value === undefined || at <= 0) {
        throw new Error(
          `--module expects <id@version>, got ${JSON.stringify(value)}`,
        );
      }
      modules.push({ id: value.slice(0, at), version: value.slice(at + 1) });
      i++;
    } else if (
      flag !== undefined &&
      !flag.startsWith("-") &&
      positionalName === undefined
    ) {
      positionalName = flag;
    } else {
      throw new Error(`unknown argument: ${JSON.stringify(flag)}`);
    }
  }
  const resolvedName = projectName ?? positionalName;
  // Leave fields possibly-undefined → Zod `.strict()` reports the precise validation error.
  return {
    ...(resolvedName !== undefined ? { projectName: resolvedName } : {}),
    modules,
    ...(deployTarget !== undefined ? { deployTarget } : {}),
    ...(framework !== undefined ? { framework } : {}),
  };
}

/** Validate argv against the module catalog and return the generation plan (no disk write). */
export function runCli(
  argv: readonly string[],
  deps: { index: RegistryIndex },
): { selection: Selection; files: GeneratedFileSet } {
  return generate(deps.index, parseArgs(argv));
}

export const HELP = `\
create-caisson — scaffold a repo from the Caisson module catalog

Usage:
  create-caisson <name> [--module <id@version> …] [--deploy <target>] \\
    [--framework <target>] [--out <dir>] [--dry-run]   # <name> is shorthand for --name <name>
  create-caisson --name <slug> --module <id@version> [--module …] \\
    [--deploy <target>] [--framework <target>] [--out <dir>] [--dry-run]
  create-caisson                              # interactive first-run (TTY only)

Flags:
  --name <slug>          Project name (a-z, 0-9, kebab slug; max 64 chars)
  --module <id@version>  @caisson-sh module (repeatable; exact semver version)
  --deploy <target>      Add a deploy config: railway | fly | vercel (default: none)
  --framework <target>   Add a framework starter: next — a wired Next.js App-Router app
                          demonstrating auth/tenancy/billing/jobs/email/ai-config wiring on the
                          base substrate (default: none)
  --out <dir>            Output directory (defaults to <projectName>)
  --dry-run              Print the file plan without writing anything to disk
  --help, -h             Show this help

Interactive mode: run with no flags in a terminal (TTY) and create-caisson prompts for the
missing pieces — project name and modules. Any flag you DO pass is never re-prompted; supply every
required flag (or pipe stdin) to skip prompts entirely.

Every module installs from the public npm registry. See https://caisson.sh/docs.
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
      `  2. bun install   # or: npm install\n` +
      `  3. bun run build\n` +
      `\nDocs: https://caisson.sh/docs\n`,
  );
}

/**
 * ADR-0262/ADR-0268 gap-fill: fills a missing projectName/modules via the interactive wizard ONLY
 * when `isTTY` is true AND a required field is still missing after argv is parsed. A
 * fully-specified invocation, or non-TTY stdin, returns the parsed argv untouched —
 * `loadInteractive` (real dynamic import by default) is NEVER called on that path, the invariant
 * `cli.test.ts` spies to lock.
 */
export async function resolveSelection(
  selectionArgs: readonly string[],
  index: RegistryIndex,
  isTTY: boolean,
  loadInteractive: () => Promise<typeof InteractiveModule> = () =>
    import("./interactive.ts"),
): Promise<RawSelection> {
  const rawFromFlags = parseArgs(selectionArgs);
  const allRequiredPresent =
    rawFromFlags.projectName !== undefined && rawFromFlags.modules.length > 0;

  if (!isTTY || allRequiredPresent) return rawFromFlags;

  // "pure run" = zero selection flags at all — arms the optional deploy step (ADR-0268) inside the
  // wizard; a partial invocation still gap-fills the missing required fields, but skips it.
  // `--framework` (ADR-0287) is flag-only — never its own wizard question, just carried through
  // untouched so a TTY invocation that DID pass it doesn't silently drop it.
  const anySelectionFlag =
    rawFromFlags.projectName !== undefined ||
    rawFromFlags.modules.length > 0 ||
    rawFromFlags.deployTarget !== undefined ||
    rawFromFlags.framework !== undefined;

  const { runWizard } = await loadInteractive();
  return runWizard(index, {
    ...(rawFromFlags.projectName !== undefined
      ? { projectName: rawFromFlags.projectName }
      : {}),
    modules: rawFromFlags.modules,
    ...(rawFromFlags.deployTarget !== undefined
      ? { deployTarget: rawFromFlags.deployTarget }
      : {}),
    ...(rawFromFlags.framework !== undefined
      ? { framework: rawFromFlags.framework }
      : {}),
    pureRun: !anySelectionFlag,
  });
}

if (import.meta.main) {
  void (async () => {
    const argv = process.argv.slice(2);

    // Extract --help / --dry-run / --out before passing the remainder to parseArgs. Flag-value
    // pairs for --name / --module / --deploy / --framework flow through untouched.
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
        // A value starting with "--" is another flag, not a directory — it would otherwise
        // greedily swallow that flag as the value and silently skip it (code review P2-5).
        if (next === undefined || next.startsWith("--")) {
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

      // Arming rule (ADR-0262): interactive prompts run ONLY when stdin is a TTY, and only for
      // Selection fields still missing after argv is parsed — a fully-specified invocation (or
      // non-TTY stdin, e.g. CI/piped) resolves below with `./interactive.ts` never imported.
      const isTTY = process.stdin.isTTY === true;

      const index = loadRegistryIndexFromFile(resolveIndexPath());
      const raw = await resolveSelection(selectionArgs, index, isTTY);
      const { selection, files } = generate(index, raw);
      const targetDir = out ?? selection.projectName;

      if (dryRun) {
        process.stdout.write(
          `create-caisson: dry-run — ${files.length} files for "${selection.projectName}"\n`,
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
