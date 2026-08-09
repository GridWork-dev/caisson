// The generator core (ADR-0048/0021/0004). Validates a buyer's selection against the registry
// ALLOWLIST — every module id AND version — BEFORE any path construction or subprocess, then
// materializes a workspace via a deterministic engine seam (in-repo template copy + typed transform,
// ADR-0048). `templatesEngine` is the real templated drive (ADR-0068/0072): it reads the in-repo
// `templates/` tree and emits the buyer repo. The disk write (FileSetWriter)
// + buyer MCP plug in behind the same seam (a separate task).
import {
  type RegistryIndex,
  assertKnownModule,
  assertKnownVersion,
} from "@caisson/registry-schema";
import { expandEditionModules } from "./edition-expand.ts";
import { templatesEngine } from "./engine-templates.ts";
import {
  type GeneratedFileSet,
  type GeneratorEngine,
  Selection,
} from "./seam.ts";

// Re-export the generator contract from its leaf module so external importers keep importing the
// `Selection` schema/type + the engine seam types from `@caisson/cli` (via `./generate.ts`)
// unchanged. The declarations live in `seam.ts` to keep engine implementations off a build cycle.
export {
  DEPLOY_TARGETS,
  FRAMEWORK_TARGETS,
  type GeneratedFile,
  type GeneratedFileSet,
  type GeneratorEngine,
  type RawSelection,
  Selection,
} from "./seam.ts";

/**
 * Parse + ALLOWLIST-GATE a raw selection. Zod `.strict()` first, then every module id + version is
 * validated against the registry index (`assertKnownModule` re-asserts the slug regex;
 * `assertKnownVersion` blocks a raw version reaching a path). Throws BEFORE any side effect — the
 * generator must never construct a path or spawn a subprocess for an unknown module.
 */
export function validateSelection(
  index: RegistryIndex,
  raw: unknown,
): Selection {
  // `--edition <bundle>` with no explicit `--module` auto-expands to the
  // bundle's CURRENT member modules (each at its index `.latest`) so the buyer need not hand-list
  // them and the `Selection.modules.min(1)` invariant below is satisfied unchanged. An explicit
  // selection is untouched; an unknown edition still fails closed (expandEditionModules throws /
  // the Edition Zod transform rejects on the parse below).
  let toParse = raw;
  if (typeof raw === "object" && raw !== null) {
    const r = raw as { edition?: unknown; modules?: unknown };
    if (
      typeof r.edition === "string" &&
      r.edition.length > 0 &&
      (!Array.isArray(r.modules) || r.modules.length === 0)
    ) {
      toParse = { ...r, modules: expandEditionModules(index, r.edition) };
    }
  }
  const selection = Selection.parse(toParse);
  for (const m of selection.modules) {
    assertKnownModule(index, m.id);
    assertKnownVersion(index, m.id, m.version);
  }
  return selection;
}

/**
 * Validate (allowlist) then materialize. Validation runs FIRST, so an unknown id/version throws
 * before the engine is ever invoked (a spy engine is never called on a bad selection). Returns the
 * file set in memory — this step does not write to disk (the writer is a separate, injected seam).
 */
export function generate(
  index: RegistryIndex,
  raw: unknown,
  engine: GeneratorEngine = templatesEngine,
): { selection: Selection; files: GeneratedFileSet } {
  const selection = validateSelection(index, raw);
  return { selection, files: engine.materialize(selection) };
}
