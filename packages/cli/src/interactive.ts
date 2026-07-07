// Interactive `create-caisson` first-run wizard (ADR-0262). Loaded ONLY via a dynamic `import()`
// from `cli.ts`, and only when `process.stdin.isTTY` is truthy AND at least one required
// Selection field (projectName/modules) is missing from argv — a fully non-interactive
// invocation must never reach this module (regression-locked by `cli.test.ts`, which spies the
// import). Produces the SAME raw `{projectName?, edition?, modules, deployTarget?}` shape
// `parseArgs` returns (`RawSelection`, seam.ts) — it feeds the identical
// `generate()`/Zod-`.strict()`/allowlist path, never a second schema. No network calls anywhere
// in this module (ADR-0093).
import { cancel, isCancel, multiselect, select, text } from "@clack/prompts";
import type { RegistryIndex } from "@caisson/registry-schema";
import { DEPLOY_TARGETS, ProjectName } from "./seam.ts";
import type { RawSelection } from "./seam.ts";
import { SAMPLE_TEMPLATES } from "./sample-templates.ts";

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

/** Multiselect options over the registry allowlist: module id + its manifest description (when
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
  readonly edition?: string;
  readonly modules: readonly ModuleChoice[];
  readonly deployTarget?: string;
  /** true only when ZERO selection flags were passed at all — arms the licensed-vs-sample mode
   *  question and the optional deploy step. A partial licensed invocation (e.g. `--edition` alone)
   *  still gap-fills the missing required fields, but skips both of those. */
  readonly pureRun: boolean;
}

export type WizardResult =
  | { readonly kind: "sample"; readonly projectName: string }
  | { readonly kind: "demo"; readonly projectName: string }
  | { readonly kind: "licensed"; readonly raw: RawSelection };

/**
 * Run the interactive first-run wizard. `pureRun` gates two things, both per ADR-0262/ADR-0268
 * (the mode question also gained the ADR-0274 §1 demo choice): the first "what to generate"
 * question (equal-weight, neither preselected), and the trailing optional "add deploy config?"
 * step. Everything else — the project-name text prompt and the module multiselect — fires
 * whenever the corresponding field is still missing, regardless of `pureRun`.
 */
export async function runWizard(
  index: RegistryIndex,
  flags: WizardFlags,
): Promise<WizardResult> {
  if (flags.pureRun) {
    const mode = ensure(
      await select({
        message: "What would you like to generate?",
        options: [
          { value: "licensed", label: "A licensed module/edition build" },
          { value: "sample", label: "The free sample (no license needed)" },
          {
            value: "demo",
            label:
              "The full catalog, commercial modules as stubs (no license needed)",
          },
        ],
      }),
    );
    if (mode === "sample" || mode === "demo") {
      const projectName = ensure(
        await text({ message: "Project name", validate: validateProjectName }),
      );
      return { kind: mode, projectName };
    }
  }

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
    kind: "licensed",
    raw: {
      projectName,
      ...(flags.edition !== undefined ? { edition: flags.edition } : {}),
      modules,
      ...(deployTarget !== undefined ? { deployTarget } : {}),
    },
  };
}

/** Gap-fill for the `--sample` path: it carries no module selection, so this is the ENTIRE
 *  interactive surface for that mode — reused both when `--sample` was passed as a flag (only the
 *  name is missing) and when the pure-run mode question above resolves to "sample". */
export async function promptSampleProjectName(): Promise<string> {
  return ensure(
    await text({ message: "Project name", validate: validateProjectName }),
  );
}

/** The sample template id the pure-run wizard's "sample" branch materializes. Only one sample
 *  exists today (`sample-templates.ts`); a multi-sample picker is a later-ADR concern. */
export const DEFAULT_SAMPLE_ID = SAMPLE_TEMPLATES[0];
