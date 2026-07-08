// `create-caisson` entry (ADR-0004). Parses --name/--edition/--module/--out/--dry-run/--help (or a
// leading bare positional as the project name, e.g. `create-caisson my-app` — G2), validates the
// selection against the registry ALLOWLIST, materializes to disk via the path-safe FileSetWriter,
// runs `git init` in the output directory (fail-soft), and prints a next-steps block to stdout. The
// registry index is resolved via `resolveIndexPath()` (`./resolve-index-path.ts`, cwd-independent)
// with an env override for CI / local overrides.
//
// `--sample <id>` is a SEPARATE, parallel path: a free Apache-2.0 evaluation sample
// (e.g. `eu-ai-act-sample`) carries no module selection, so it never touches the registry allowlist
// or `generate()` — it goes straight through `materializeSample` (`sample-templates.ts`).
//
// `--demo` (ADR-0274 §1 / Track E1) is a THIRD parallel path: full-catalog generation with every
// commercial module replaced by a watermarked stub (`generateDemo`, `demo.ts`) — same `--name`-only
// argv contract as `--sample`, no license, no license-service call.
import { execFile as execFileCb } from "node:child_process";
import { resolve } from "node:path";
import {
  type RegistryIndex,
  loadRegistryIndexFromFile,
} from "@caisson/registry-schema";
import { type DemoModuleSummary, generateDemo } from "./demo.ts";
import {
  type GeneratedFileSet,
  type RawSelection,
  type Selection,
  generate,
} from "./generate.ts";
import type * as InteractiveModule from "./interactive.ts";
import { resolveIndexPath } from "./resolve-index-path.ts";
import { materializeSample } from "./sample-templates.ts";
import { createFileSetWriter } from "./writer.ts";

/**
 * Parse argv into a RAW selection (validated downstream by Zod `.strict()` — never trusted here).
 * Flags: `--name <slug>`, `--edition <e>`, `--module <id@version>` (repeatable),
 * `--deploy <railway|fly|vercel>` (ADR-0268), `--framework <next>` (ADR-0287). A leading BARE
 * positional (any token not starting with `-`) is also accepted as the project name — e.g.
 * `create-caisson my-app` (G2, the advertised `bunx create-caisson my-app` quickstart) — exactly
 * equivalent to `--name my-app`; an explicit `--name` always wins on conflict, regardless of argv
 * order, since it is folded in last below. Only the first bare token is ever taken as positional; a
 * second one still fails closed as an unknown argument.
 */
export function parseArgs(argv: readonly string[]): unknown {
  const modules: { id: string; version: string }[] = [];
  let projectName: string | undefined;
  let positionalName: string | undefined;
  let edition: string | undefined;
  let deployTarget: string | undefined;
  let framework: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--name") {
      projectName = value;
      i++;
    } else if (flag === "--edition") {
      edition = value;
      i++;
    } else if (flag === "--deploy") {
      deployTarget = value;
      i++;
    } else if (flag === "--framework") {
      framework = value;
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
    ...(edition !== undefined ? { edition } : {}),
    modules,
    ...(deployTarget !== undefined ? { deployTarget } : {}),
    ...(framework !== undefined ? { framework } : {}),
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
 * Parse argv for the free-SAMPLE path: just `--name <slug>`. No `--edition`/
 * `--module` here — a sample carries no module selection, so it never reaches the registry
 * allowlist. An unknown flag throws (same fail-closed posture as `parseArgs`).
 */
export function parseSampleArgs(argv: readonly string[]): {
  projectName?: string;
} {
  let projectName: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--name") {
      projectName = argv[i + 1];
      i++;
    } else {
      throw new Error(`unknown argument: ${JSON.stringify(flag)}`);
    }
  }
  return projectName !== undefined ? { projectName } : {};
}

export const HELP = `\
create-caisson — scaffold a repo from the Caisson registry

Usage:
  create-caisson <name> [--module <id@version> …] [--edition <e>] [--deploy <target>] \\
    [--framework <target>] [--out <dir>] [--dry-run]   # <name> is shorthand for --name <name>
  create-caisson --name <slug> --module <id@version> [--module …] \\
    [--edition <e>] [--deploy <target>] [--framework <target>] [--out <dir>] [--dry-run]
  create-caisson --sample <id> --name <slug> [--out <dir>] [--dry-run]
  create-caisson --demo --name <slug> [--out <dir>] [--dry-run]
  create-caisson                              # interactive first-run (TTY only)

Flags:
  --name <slug>          Project name (a-z, 0-9, kebab slug; max 64 chars)
  --module <id@version>  @caisson module (repeatable; exact semver version)
  --edition <e>          compliance | ai-production | local-first | agentic-dev | provenance |
                          everything — the legacy edition ids (ai-kit, local-ai, agent-dev) still
                          work and resolve to their bundle above (ADR-0257)
  --deploy <target>      Add a deploy config: railway | fly | vercel (default: none)
  --framework <target>   Add a framework starter: next — a wired Next.js App-Router app
                          demonstrating auth/tenancy/billing/jobs/email/ai-config wiring on the
                          base substrate (default: none)
  --sample <id>          A free, Apache-2.0 evaluation sample (e.g. eu-ai-act-sample) — no
                          --module/--edition; no Caisson license key required to install or run
  --demo                 Generate against the FULL catalog, with every commercial module replaced
                          by a watermarked stub (see DEMO.md in the generated repo) — no
                          --module/--edition, no license, never for production
  --out <dir>            Output directory (defaults to <projectName>)
  --dry-run              Print the file plan without writing anything to disk
  --help, -h             Show this help

Interactive mode: run with no flags in a terminal (TTY) and create-caisson prompts for the
missing pieces — a licensed module/edition build vs the free sample vs the full-catalog demo,
project name, and modules. Any flag you DO pass is never re-prompted; supply every required flag
(or pipe stdin) to skip prompts entirely.

Before running the installer (non-sample path), add CAISSON_LICENSE_TOKEN (your Caisson license
key) to .npmrc. See the generated README for the full setup steps — or https://caisson.sh/docs.
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

/** Next-steps for the free-SAMPLE path — no license key, since every dependency the
 *  sample carries (`@caisson/kernel`) is Apache-2.0 on the public npm registry. */
function printSampleNextSteps(projectName: string, targetDir: string): void {
  process.stdout.write(
    `\ncreate-caisson: generated "${projectName}" (free sample) → ${targetDir}\n` +
      `\nNext steps:\n` +
      `  1. cd ${targetDir}\n` +
      `  2. bun install   # public npm only — no Caisson license key needed\n` +
      `  3. bun run demo  # the evidence-path walkthrough\n` +
      `  4. bun test      # the sample's own verify suite\n` +
      `\nDocs: https://caisson.sh/docs\n`,
  );
}

/** Next-steps for the full-catalog DEMO path (ADR-0274 §1) — no license key: every commercial
 *  module in the generation is a local stub, not an installable dependency. The open Apache base
 *  installs from the Caisson registry (`.npmrc` scope mapping, no auth token) — NOT public npm,
 *  which does not hold the `@caisson` scope (F1). */
function printDemoNextSteps(
  projectName: string,
  targetDir: string,
  modules: readonly DemoModuleSummary[],
): void {
  const stubbed = modules.filter((m) => m.tier === "paid").length;
  process.stdout.write(
    `\ncreate-caisson: generated "${projectName}" (demo — ${stubbed} of ${modules.length} ` +
      `catalog modules stubbed) → ${targetDir}\n` +
      `\nNext steps:\n` +
      `  1. cd ${targetDir}\n` +
      `  2. bun install   # the open Apache base installs from the Caisson registry, no license key needed\n` +
      `  3. bun run build && bun test\n` +
      `  4. See DEMO.md for the full catalog + which modules are stubs\n` +
      `\nGet a license at https://caisson.sh to swap the stubs for the real modules.\n` +
      `Docs: https://caisson.sh/docs\n`,
  );
}

/**
 * ADR-0262 gap-fill for the `--sample` path: it carries no module selection, so a missing
 * project name is the only thing the wizard ever fills in here. Prompts ONLY when `isTTY` is
 * true; a non-TTY invocation throws exactly like the pre-ADR-0262 behavior (caught by the outer
 * try/catch → the same stderr message + exit code). `loadInteractive` is an injectable seam
 * (real dynamic import by default) so `cli.test.ts` can spy on it without a live TTY — it must
 * NEVER be called when `projectName` is already supplied or `isTTY` is false.
 */
export async function resolveSampleProjectName(
  selectionArgs: readonly string[],
  isTTY: boolean,
  loadInteractive: () => Promise<typeof InteractiveModule> = () =>
    import("./interactive.ts"),
): Promise<string> {
  const { projectName } = parseSampleArgs(selectionArgs);
  if (projectName !== undefined) return projectName;
  if (!isTTY) {
    throw new Error("--sample requires --name <slug>");
  }
  const { promptSampleProjectName } = await loadInteractive();
  return promptSampleProjectName();
}

/**
 * ADR-0274 gap-fill for the `--demo` path: identical shape to `resolveSampleProjectName` — a
 * missing project name is the only thing ever prompted for (demo mode carries no module
 * selection; it always composes the full catalog). Reuses the SAME `parseSampleArgs`
 * `{ --name only }` argv contract and the same `promptSampleProjectName` prompt.
 */
export async function resolveDemoProjectName(
  selectionArgs: readonly string[],
  isTTY: boolean,
  loadInteractive: () => Promise<typeof InteractiveModule> = () =>
    import("./interactive.ts"),
): Promise<string> {
  const { projectName } = parseSampleArgs(selectionArgs);
  if (projectName !== undefined) return projectName;
  if (!isTTY) {
    throw new Error("--demo requires --name <slug>");
  }
  const { promptSampleProjectName } = await loadInteractive();
  return promptSampleProjectName();
}

/** What the licensed (non-`--sample`, non-`--demo`) path resolved to: either a raw Selection
 *  ready for `generate()`, or — when the pure-run wizard's mode question picked the free sample or
 *  the full-catalog demo instead (ADR-0262/ADR-0274) — the project name for that flow's exact
 *  same generation path (`--sample`/`--demo` flag entry points). */
export type LicensedResolution =
  | {
      readonly kind: "sample";
      readonly sampleId: string;
      readonly projectName: string;
    }
  | { readonly kind: "demo"; readonly projectName: string }
  | { readonly kind: "licensed"; readonly raw: unknown };

/**
 * ADR-0262/ADR-0268 gap-fill for the licensed path: fills a missing projectName/modules via the
 * interactive wizard ONLY when `isTTY` is true AND a required field is still missing after argv
 * is parsed. A fully-specified invocation, or non-TTY stdin, returns `rawFromFlags` untouched —
 * `loadInteractive` (real dynamic import by default) is NEVER called on that path, the invariant
 * `cli.test.ts` spies to lock.
 */
export async function resolveLicensed(
  selectionArgs: readonly string[],
  index: RegistryIndex,
  isTTY: boolean,
  loadInteractive: () => Promise<typeof InteractiveModule> = () =>
    import("./interactive.ts"),
): Promise<LicensedResolution> {
  const rawFromFlags = parseArgs(selectionArgs) as RawSelection;
  const allRequiredPresent =
    rawFromFlags.projectName !== undefined && rawFromFlags.modules.length > 0;

  if (!isTTY || allRequiredPresent) {
    return { kind: "licensed", raw: rawFromFlags };
  }

  // "pure run" = zero selection flags at all — arms the licensed-vs-sample mode question and the
  // optional deploy step (ADR-0262/ADR-0268) inside the wizard; a partial invocation (e.g.
  // `--edition` alone) still gap-fills the missing required fields, but skips both of those.
  // `--framework` (ADR-0287) is flag-only, same as `--edition` — never its own wizard question,
  // just carried through untouched so a TTY invocation that DID pass it doesn't silently drop it.
  const anySelectionFlag =
    rawFromFlags.projectName !== undefined ||
    rawFromFlags.edition !== undefined ||
    rawFromFlags.modules.length > 0 ||
    rawFromFlags.deployTarget !== undefined ||
    rawFromFlags.framework !== undefined;

  const { runWizard, DEFAULT_SAMPLE_ID } = await loadInteractive();
  const wizard = await runWizard(index, {
    ...(rawFromFlags.projectName !== undefined
      ? { projectName: rawFromFlags.projectName }
      : {}),
    ...(rawFromFlags.edition !== undefined
      ? { edition: rawFromFlags.edition }
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

  if (wizard.kind === "sample") {
    return {
      kind: "sample",
      sampleId: DEFAULT_SAMPLE_ID,
      projectName: wizard.projectName,
    };
  }
  if (wizard.kind === "demo") {
    return { kind: "demo", projectName: wizard.projectName };
  }
  return { kind: "licensed", raw: wizard.raw };
}

/**
 * Materialize a free sample end-to-end: print the dry-run plan (exits) or write to disk, git
 * init, print next steps. Shared by the `--sample` flag path and the interactive wizard's
 * "free sample" branch (ADR-0262) so the two entry points stay mechanically identical.
 */
async function generateSample(
  sampleId: string,
  projectName: string,
  opts: { out: string | undefined; dryRun: boolean },
): Promise<void> {
  const files = materializeSample(sampleId, projectName);
  const targetDir = opts.out ?? projectName;

  if (opts.dryRun) {
    process.stdout.write(
      `create-caisson: dry-run — ${files.length} files for ` +
        `"${projectName}" (sample: ${sampleId})\n`,
    );
    for (const f of files) {
      process.stdout.write(`  ${f.path}\n`);
    }
    process.exit(0);
  }

  const write = createFileSetWriter();
  await write(targetDir, files);
  await tryGitInit(targetDir);
  printSampleNextSteps(projectName, targetDir);
}

/**
 * Materialize the full-catalog DEMO end-to-end (ADR-0274 §1): print the dry-run plan (exits) or
 * write to disk, git init, print next steps. Shared by the `--demo` flag path and the interactive
 * wizard's "demo" branch, mirroring `generateSample`'s shape exactly.
 */
async function generateDemoProject(
  projectName: string,
  opts: { out: string | undefined; dryRun: boolean },
): Promise<void> {
  const index = loadRegistryIndexFromFile(resolveIndexPath());
  const {
    projectName: resolvedName,
    files,
    modules,
  } = generateDemo(index, { projectName });
  const targetDir = opts.out ?? resolvedName;
  const stubbed = modules.filter((m) => m.tier === "paid").length;

  if (opts.dryRun) {
    process.stdout.write(
      `create-caisson: dry-run — ${files.length} files for ` +
        `"${resolvedName}" (demo: ${stubbed} of ${modules.length} modules stubbed)\n`,
    );
    for (const f of files) {
      process.stdout.write(`  ${f.path}\n`);
    }
    process.exit(0);
  }

  const write = createFileSetWriter();
  await write(targetDir, files);
  await tryGitInit(targetDir);
  printDemoNextSteps(resolvedName, targetDir, modules);
}

if (import.meta.main) {
  void (async () => {
    const argv = process.argv.slice(2);

    // Extract --help / --dry-run / --out / --sample / --demo before passing the remainder to
    // parseArgs. Flag-value pairs for --name / --edition / --module flow through untouched.
    const selectionArgs: string[] = [];
    let out: string | undefined;
    let sample: string | undefined;
    let demo = false;
    let dryRun = false;
    let help = false;

    for (let i = 0; i < argv.length; i++) {
      const flag = argv[i];
      if (flag === "--help" || flag === "-h") {
        help = true;
      } else if (flag === "--dry-run") {
        dryRun = true;
      } else if (flag === "--demo") {
        demo = true;
      } else if (flag === "--out") {
        const next = argv[i + 1];
        // A value starting with "--" is another flag, not a directory — e.g. `--sample --demo`
        // would otherwise greedily swallow "--demo" as the value and silently skip its own flag
        // (code review P2-5).
        if (next === undefined || next.startsWith("--")) {
          process.stderr.write("create-caisson: --out requires a directory\n");
          process.exit(1);
        }
        out = next;
        i++;
      } else if (flag === "--sample") {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          process.stderr.write(
            "create-caisson: --sample requires a template id\n",
          );
          process.exit(1);
        }
        sample = next;
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

      if (sample !== undefined && demo) {
        process.stderr.write(
          "create-caisson: --sample and --demo are mutually exclusive\n",
        );
        process.exit(1);
      }

      // Arming rule (ADR-0262): interactive prompts run ONLY when stdin is a TTY, and only for
      // Selection fields still missing after argv is parsed — a fully-specified invocation (or
      // non-TTY stdin, e.g. CI/piped) resolves below with `./interactive.ts` never imported, so
      // the non-interactive behavior is byte-identical to before ADR-0262.
      const isTTY = process.stdin.isTTY === true;

      if (sample !== undefined) {
        const projectName = await resolveSampleProjectName(
          selectionArgs,
          isTTY,
        );
        await generateSample(sample, projectName, { out, dryRun });
        return;
      }

      if (demo) {
        const projectName = await resolveDemoProjectName(selectionArgs, isTTY);
        await generateDemoProject(projectName, { out, dryRun });
        return;
      }

      const index = loadRegistryIndexFromFile(resolveIndexPath());
      const resolved = await resolveLicensed(selectionArgs, index, isTTY);

      if (resolved.kind === "sample") {
        await generateSample(resolved.sampleId, resolved.projectName, {
          out,
          dryRun,
        });
        return;
      }

      if (resolved.kind === "demo") {
        await generateDemoProject(resolved.projectName, { out, dryRun });
        return;
      }

      const { selection, files } = generate(index, resolved.raw);
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
