// Interactive `create-caisson` first-run wizard (ADR-0262). Loaded ONLY via a dynamic `import()`
// from `cli.ts`, and only when `process.stdin.isTTY` is truthy AND at least one required
// Selection field (projectName/modules) is missing from argv — a fully non-interactive
// invocation must never reach this module (regression-locked by `cli.test.ts`, which spies the
// import). Produces the SAME raw `{projectName?, modules, deployTarget?}` shape `parseArgs`
// returns (`RawSelection`, seam.ts) — it feeds the identical `generate()`/Zod-`.strict()`/
// allowlist path, never a second schema. No network calls anywhere in this module (ADR-0093).
import { cancel, isCancel, multiselect, select, text } from "@clack/prompts";
import type { RegistryIndex } from "@caisson-sh/registry-schema";
import { DEPLOY_TARGETS, ProjectName } from "./seam.ts";
import type { RawSelection } from "./seam.ts";

type ModuleChoice = { id: string; version: string };

/** Unwrap a clack prompt result, exiting cleanly (non-zero, no stack trace) on Ctrl-C/Esc — a
 *  cancel Symbol must never reach Zod or any downstream caller. */
function ensure<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("create-caisson: cancelled");
    process.exit(1);
  }
  return value;
}

/** The same slug rule `Selection.projectName` enforces, surfaced as a live prompt validator. */
function validateProjectName(value: string | undefined): string | undefined {
  const result = ProjectName.safeParse(value);
  return result.success
    ? undefined
    : (result.error.issues[0]?.message ?? "invalid project name");
}

/** Multiselect options over the registry catalog: module id + its manifest description (when
 *  the index carries one) as a hint; the selected version is always the entry's `latest`. */
function moduleOptions(
  index: RegistryIndex,
): { value: ModuleChoice; label: string; hint?: string }[] {
  return [...index.modules]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((entry) => {
      const latest = entry.versions.find((v) => v.version === entry.latest);
      const description = latest?.manifest.description;
      return {
        value: { id: entry.id, version: entry.latest },
        label: entry.id,
        ...(description !== undefined ? { hint: description } : {}),
      };
    });
}

/** The already-known Selection fields (from argv) plus the arming context. Fields present here
 *  are never re-prompted — only a missing projectName/modules gap-fills. */
export interface WizardFlags {
  readonly projectName?: string;
  readonly modules: readonly ModuleChoice[];
  readonly deployTarget?: string;
  /** ADR-0287 — flag-only: never its own wizard question, carried through to the final raw
   *  output untouched so it isn't dropped when a partial TTY invocation still gap-fills the
   *  missing required fields. */
  readonly framework?: string;
  /** true only when ZERO selection flags were passed at all — arms the optional deploy step. A
   *  partial invocation still gap-fills the missing required fields, but skips that step. */
  readonly pureRun: boolean;
}

/**
 * Run the interactive first-run wizard. The project-name text prompt and the module multiselect
 * fire whenever the corresponding field is still missing; `pureRun` additionally arms the trailing
 * optional "add deploy config?" step (ADR-0268).
 */
export async function runWizard(
  index: RegistryIndex,
  flags: WizardFlags,
): Promise<RawSelection> {
  const projectName =
    flags.projectName ??
    ensure(
      await text({ message: "Project name", validate: validateProjectName }),
    );

  const modules =
    flags.modules.length > 0
      ? [...flags.modules]
      : ensure(
          await multiselect({
            message: "Select modules",
            options: moduleOptions(index),
            required: true,
          }),
        );

  let deployTarget = flags.deployTarget;
  if (flags.pureRun) {
    const picked = ensure(
      await select({
        message: "Add a deploy config?",
        initialValue: "none",
        options: [
          { value: "none", label: "None" },
          ...DEPLOY_TARGETS.map((target) => ({ value: target, label: target })),
        ],
      }),
    );
    if (picked !== "none") deployTarget = picked;
  }

  return {
    projectName,
    modules,
    ...(deployTarget !== undefined ? { deployTarget } : {}),
    ...(flags.framework !== undefined ? { framework: flags.framework } : {}),
  };
}
