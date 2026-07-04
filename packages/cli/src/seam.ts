// The generator CONTRACT (ADR-0048/0068) — the leaf seam shared by `generate.ts` (the core) and
// every engine implementation (`engine-templates.ts`, the `defaultEngine` skeleton). It owns the
// buyer `Selection` schema + type and the engine seam type (`GeneratorEngine`). Kept free of a
// back-edge into `generate.ts` (the core — that would be a build cycle); the only import is `zod` plus
// the base file-emit primitive. `generate.ts` re-exports every symbol here, so external importers keep
// importing from `@caisson/cli` unchanged.
//
// The file-emit shape (`GeneratedFile`/`GeneratedFileSet`) is the base `EmittedFile`/`EmittedFileSet`
// hoisted to `@caisson/migrate` (ADR-0090) so the migration assembler/runner and the generator share
// ONE declaration without the base reaching "up" into the cli. We re-export it under the
// generator-contract names so every `@caisson/cli` importer of `GeneratedFile`/`GeneratedFileSet` is
// unchanged; `@caisson/migrate` is a down-only base dependency, no cycle.
import type { EmittedFile, EmittedFileSet } from "@caisson/migrate";
import { z } from "zod";

const EDITIONS = ["compliance", "ai-kit", "local-ai", "agent-dev"] as const;

const ModuleSelection = z
  .object({
    id: z.string(),
    version: z.string(),
  })
  .strict();

/** A strict project-name slug (it becomes a directory at generation time — no traversal). Exported standalone
 *  (not read off `Selection.shape`) because `Selection` is a `ZodEffects` post-`.refine()` and does
 *  not expose `.shape` — the free-sample engine (`sample-templates.ts`, ADR-0095 W3) imports this
 *  directly so the paid and free generation paths enforce the exact same one rule. */
export const ProjectName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug");

/** A buyer's selection. Project name is a strict slug (it becomes a directory at generation time — no traversal). */
export const Selection = z
  .object({
    projectName: ProjectName,
    edition: z.enum(EDITIONS).optional(),
    modules: z.array(ModuleSelection).min(1),
  })
  .strict()
  // One id at two versions makes package.json deps (last-wins) disagree with the README (lists
  // both) — an order-dependent, non-deterministic output. Reject the ambiguity at the boundary.
  .refine(
    (s) => new Set(s.modules.map((m) => m.id)).size === s.modules.length,
    { message: "duplicate module id in selection", path: ["modules"] },
  );
export type Selection = z.infer<typeof Selection>;

/** A file in the generated repo — the base `EmittedFile` primitive (ADR-0090), re-exported under the
 *  generator-contract name. `path` is always a fixed literal here, never built from input. */
export type GeneratedFile = EmittedFile;
export type GeneratedFileSet = EmittedFileSet;

/** The generator engine seam (ADR-0048). Swap the deterministic copy/transform for ts-morph later. */
export interface GeneratorEngine {
  materialize(selection: Selection): GeneratedFileSet;
}
