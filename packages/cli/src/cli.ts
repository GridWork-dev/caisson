// `create-caisson` entry (ADR-0004). Skeleton: arg-parse + Zod-strict selection + the registry
// allowlist gate are real and tested NOW; the full agent-driven generation + disk materialization +
// buyer-MCP drive are P5 (the seams in generate.ts / meter.ts). The entry validates the selection
// against the registry index BEFORE it would construct any path or spawn a subprocess.
import {
  type RegistryIndex,
  loadRegistryIndexFromFile,
} from "@caisson/registry";
import { type GeneratedFileSet, type Selection, generate } from "./generate.ts";

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

/** Resolve the registry index the CLI validates against. P5 bundles it with the published package. */
function resolveIndexPath(): string {
  const fromEnv = process.env.CAISSON_REGISTRY_INDEX;
  if (fromEnv === undefined || fromEnv.length === 0) {
    throw new Error(
      "create-caisson: set CAISSON_REGISTRY_INDEX to the registry index path (P5 bundles this with the package)",
    );
  }
  return fromEnv;
}

if (import.meta.main) {
  try {
    const index = loadRegistryIndexFromFile(resolveIndexPath());
    const { selection, files } = runCli(process.argv.slice(2), { index });
    process.stdout.write(
      `create-caisson: planned ${files.length} files for "${selection.projectName}"` +
        `${selection.edition ? ` (${selection.edition} edition)` : ""}\n`,
    );
  } catch (e) {
    process.stderr.write(`create-caisson: ${(e as Error).message}\n`);
    process.exit(1);
  }
}
