// Agent / skill / rule artifact schema (ADR-0065 · ADR-0002 `.strict()` boundary). A discriminated
// union over `kind` — the one failure mode it removes is a mis-shaped artifact reaching a consumer:
// unknown fields are rejected (not silently dropped), the discriminant routes to the right member,
// and a parse failure surfaces as a redaction-safe `ValidationError` (never the rejected values).
// Engine-neutral: this is the artifact STRUCTURE, never an engine/model binding.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";

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
 * The agentskills.io SKILL.md portability fields. Every field is OPTIONAL — an absent
 * field ⇒ a byte-identical round-trip for every skill authored before they existed (ADR-0264
 * discipline). Bounds mirror the spec's caps. `name`/`description` are bounded SKILL-SCOPED: only the
 * skill member emits a SKILL.md, so the agent/rule members keep their looser `slug`/`nonEmpty` (their
 * round-trips are untouched). The shared `slug` regex already matches the spec's name format exactly
 * (lowercase alnum, single non-consecutive hyphens, no leading/trailing) — the only addition is the cap.
 */
const skillName = slug.max(64);
const skillDescription = z.string().min(1).max(1024);
/** A `metadata` string→string property bag (client-defined keys; the top-level `.strict()` still
 * rejects unknown SKILL fields). Bounded key/value lengths + entry count. */
const skillMetadata = z
  .record(z.string().min(1).max(128), z.string().max(1024))
  .refine((m) => Object.keys(m).length <= 32, {
    message: "metadata may declare at most 32 entries",
  });
/** One `allowed-tools` token — a bare portability string (each non-empty, no internal whitespace, e.g.
 * `Bash(git:*)` / `Read`). Deliberately NOT the tool-exec `CommandSpec` shape: this is a spec
 * portability field emitted as a space-separated frontmatter string, never an execution gate. */
const allowedToolToken = z
  .string()
  .max(128)
  .regex(
    /^\S+$/,
    "an allowed-tools token must be non-empty with no whitespace",
  );
/** The optional SKILL.md fields a `SkillArtifact` gains (license, compatibility, metadata,
 * allowed-tools). Executable/bundled content (`scripts`/`references`/`assets`) is the sibling
 * `skillBundleFields` below — the emitter's write-gate (`allowScripts`) decides which reach disk. */
const skillPortabilityFields = {
  license: z.string().min(1).max(256).optional(),
  compatibility: z.string().min(1).max(500).optional(),
  metadata: skillMetadata.optional(),
  allowedTools: z.array(allowedToolToken).min(1).max(64).optional(),
};
/**
 * A relative path for a file bundled alongside a SKILL.md (e.g. `helpers/setup.sh`). Same relative-only,
 * bounded floor as `pathGlob`: a leading `/` or any `..` segment is rejected. The emitter's write-gate
 * re-checks the ASSEMBLED destination (`<skill-dir>/<category>/<path>`) too, so this is defence in
 * depth, not the sole guard.
 */
const bundledPath = z
  .string()
  .min(1)
  .max(1024)
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/,
    "must be a relative path (no leading `/`, no `..` segment)",
  );
/** One bundled file shipped next to a SKILL.md — a relative path + its text content (256 KiB cap). */
const bundledFile = strictObject({
  path: bundledPath,
  content: z.string().max(262_144),
});
/**
 * The optional BUNDLED-FILE maps a `SkillArtifact` gains (ADR-0264 optional-field discipline: all
 * absent ⇒ byte-identical round-trip; only the SKILL member carries them — agents/rules reject them via
 * the top-level `.strict()`). `references`/`assets` are inert bundled content and always emit;
 * `scripts` are executable and pass through the emitter's `allowScripts` trust gate.
 */
const skillBundleFields = {
  references: z.array(bundledFile).max(64).optional(),
  assets: z.array(bundledFile).max(64).optional(),
  scripts: z.array(bundledFile).max(64).optional(),
};

/**
 * A skill: an ordered workflow with a trigger class (the playbook surface). The raw shape (below) is
 * kept unexported/unrefined so it stays a `z.discriminatedUnion` member (a refined `ZodEffects` has no
 * `.shape` for the union to read the discriminant off); the exported `SkillArtifact` adds the
 * activation refine for direct callers (`defineSkill`, tests) and `Artifact` re-applies the same
 * refine over the whole union below so `parseArtifact` enforces it too.
 */
const SkillArtifactShape = strictObject({
  kind: z.literal("skill"),
  name: skillName,
  description: skillDescription,
  trigger: z.enum(["user", "manual", "runtime"]),
  steps: z.array(nonEmpty).min(1),
  dependencies,
  ...activationFields,
  ...skillPortabilityFields,
  ...skillBundleFields,
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
