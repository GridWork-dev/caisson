// The generator CONTRACT (ADR-0048/0068) — the leaf seam shared by `generate.ts` (the core) and
// every engine implementation (`engine-templates.ts`, the `defaultEngine` skeleton). It owns the
// buyer `Selection` schema + type and the engine seam types (`GeneratedFile` / `GeneratedFileSet` /
// `GeneratorEngine`). Kept dependency-free of the core so an engine can import the contract without
// a back-edge into `generate.ts` (which would be a build cycle). `generate.ts` re-exports every
// symbol here, so external importers keep importing from `@caisson/cli` unchanged.
import { z } from "zod";

const EDITIONS = ["compliance", "ai-kit", "local-ai", "agent-dev"] as const;

const ModuleSelection = z
  .object({
    id: z.string(),
    version: z.string(),
  })
  .strict();

/** A buyer's selection. Project name is a strict slug (it becomes a directory at P5 — no traversal). */
export const Selection = z
  .object({
    projectName: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug"),
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

export interface GeneratedFile {
  /** Relative path within the generated repo. Always a fixed literal here — never built from input. */
  readonly path: string;
  readonly content: string;
}
export type GeneratedFileSet = readonly GeneratedFile[];

/** The generator engine seam (ADR-0048). Swap the deterministic copy/transform for ts-morph later. */
export interface GeneratorEngine {
  materialize(selection: Selection): GeneratedFileSet;
}
