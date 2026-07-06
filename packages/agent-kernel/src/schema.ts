// Agent / skill / rule artifact schema (ADR-0065 · ADR-0002 `.strict()` boundary). A discriminated
// union over `kind` — the one failure mode it removes is a mis-shaped artifact reaching a consumer:
// unknown fields are rejected (not silently dropped), the discriminant routes to the right member,
// and a parse failure surfaces as a redaction-safe `ValidationError` (never the rejected values).
// Engine-neutral: this is the artifact STRUCTURE, never an engine/model binding.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";

/** kebab-case slug — the stable id a generated file/registry entry is keyed on. */
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a kebab-case slug");
const nonEmpty = z.string().min(1);

/**
 * How a rule/skill activates in a harness that supports scoped activation (ADR-0264): unconditionally
 * (`always`), scoped to `paths` globs, or only on an explicit manual trigger. Absent ⇒ `always` (today's
 * behavior — every artifact authored before this field existed round-trips unaffected). Field names
 * are tracked against the open agentsmd RFC #179 (ADR-0264); a later ADR migrates if it ratifies
 * different names.
 */
const activation = z.enum(["always", "paths", "manual"]);

/**
 * A relative glob path scoping a `paths`-activated artifact (e.g. `src/**\/*.ts`). Bounded +
 * relative-only (file-path-safety floor): a leading `/` or any `..` segment is rejected — the same
 * discipline the registry manifest's `relPath` field applies to on-disk paths, applied here to
 * author-supplied scope globs.
 */
const pathGlob = z
  .string()
  .min(1)
  .max(1024)
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/,
    "must be a relative glob path (no leading `/`, no `..` segment)",
  );

/** The activation-extension fields `RuleArtifact` and `SkillArtifact` gain (ADR-0264). `AgentArtifact`
 * is untouched — an agent's invocation trigger is `whenToInvoke` prose, not file scoping. */
const activationFields = {
  activation: activation.optional(),
  paths: z.array(pathGlob).min(1).max(64).optional(),
};

/** `paths` activation requires a non-empty `paths[]`; the array's own `.min(1)` already forbids an
 * EMPTY array once present — this closes the remaining gap where `paths` is omitted entirely. The
 * `kind` field is declared (though unused) only so this predicate type-checks against the `Artifact`
 * UNION too: TS rejects an otherwise all-optional parameter type as a "weak type" against a union
 * member (`AgentArtifact`) sharing none of its properties, and `kind` is the one property every
 * member actually has. */
function pathsRequiredWhenScoped(value: {
  readonly kind?: unknown;
  readonly activation?: "always" | "paths" | "manual" | undefined;
  readonly paths?: readonly string[] | undefined;
}): boolean {
  return value.activation !== "paths" || value.paths !== undefined;
}
const ACTIVATION_REFINE_ISSUE = {
  message: "'paths' activation requires a non-empty paths[] array",
  path: ["paths"],
};

/**
 * By-name cross-refs to OTHER artifacts in the authored set — an agent depending on a skill, a skill
 * on a rule. Optional (omitted ⇒ no refs; no `.default()` so an artifact without refs round-trips
 * byte-identically). Reference integrity is enforced at SET-validate time, not here: `validate.ts`
 * resolves every entry against the authored-name allowlist and rejects a ghost ref (`validateArtifactSet`).
 */
const dependencies = z.array(slug).optional();

/** An agent: a capability-scoped worker with an allowed tool set + an invocation trigger. */
export const AgentArtifact = strictObject({
  kind: z.literal("agent"),
  name: slug,
  description: nonEmpty,
  /** Normalized capability verbs (e.g. `code_review`, `security_audit`). */
  capabilities: z.array(nonEmpty),
  /** Allowed tool names — the agent's authority surface. */
  tools: z.array(nonEmpty),
  whenToInvoke: nonEmpty,
  dependencies,
});

/**
 * A skill: an ordered workflow with a trigger class (the playbook surface). The raw shape (below) is
 * kept unexported/unrefined so it stays a `z.discriminatedUnion` member (a refined `ZodEffects` has no
 * `.shape` for the union to read the discriminant off); the exported `SkillArtifact` adds the
 * activation refine for direct callers (`defineSkill`, tests) and `Artifact` re-applies the same
 * refine over the whole union below so `parseArtifact` enforces it too.
 */
const SkillArtifactShape = strictObject({
  kind: z.literal("skill"),
  name: slug,
  description: nonEmpty,
  trigger: z.enum(["user", "manual", "runtime"]),
  steps: z.array(nonEmpty).min(1),
  dependencies,
  ...activationFields,
});
export const SkillArtifact = SkillArtifactShape.refine(
  pathsRequiredWhenScoped,
  ACTIVATION_REFINE_ISSUE,
);

/** A rule: a binding constraint with a blocking severity (never advisory). See the `SkillArtifactShape`
 * comment above for why the raw shape and the refined export are separate declarations. */
const RuleArtifactShape = strictObject({
  kind: z.literal("rule"),
  name: slug,
  description: nonEmpty,
  severity: z.enum(["error", "warning", "info"]),
  dependencies,
  ...activationFields,
});
export const RuleArtifact = RuleArtifactShape.refine(
  pathsRequiredWhenScoped,
  ACTIVATION_REFINE_ISSUE,
);

/** The artifact union — routed by the `kind` discriminant, then re-refined so a `paths`-activated
 * rule/skill reached through `parseArtifact` (not the standalone `RuleArtifact`/`SkillArtifact`
 * exports) is held to the same non-empty-`paths[]` contract. */
export const Artifact = z
  .discriminatedUnion("kind", [
    AgentArtifact,
    SkillArtifactShape,
    RuleArtifactShape,
  ])
  .refine(pathsRequiredWhenScoped, ACTIVATION_REFINE_ISSUE);

export type AgentArtifact = z.infer<typeof AgentArtifact>;
export type SkillArtifact = z.infer<typeof SkillArtifact>;
export type RuleArtifact = z.infer<typeof RuleArtifact>;
export type Artifact = z.infer<typeof Artifact>;
export type ArtifactKind = Artifact["kind"];

/** Parse an untrusted artifact, throwing a redaction-safe `ValidationError` on any violation. */
export function parseArtifact(input: unknown): Artifact {
  return parseStrict(Artifact, input);
}
