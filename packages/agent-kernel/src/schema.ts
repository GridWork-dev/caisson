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

/** A skill: an ordered workflow with a trigger class (the playbook surface). */
export const SkillArtifact = strictObject({
  kind: z.literal("skill"),
  name: slug,
  description: nonEmpty,
  trigger: z.enum(["user", "manual", "runtime"]),
  steps: z.array(nonEmpty).min(1),
  dependencies,
});

/** A rule: a binding constraint with a blocking severity (never advisory). */
export const RuleArtifact = strictObject({
  kind: z.literal("rule"),
  name: slug,
  description: nonEmpty,
  severity: z.enum(["error", "warning", "info"]),
  dependencies,
});

/** The artifact union — routed by the `kind` discriminant. */
export const Artifact = z.discriminatedUnion("kind", [
  AgentArtifact,
  SkillArtifact,
  RuleArtifact,
]);

export type AgentArtifact = z.infer<typeof AgentArtifact>;
export type SkillArtifact = z.infer<typeof SkillArtifact>;
export type RuleArtifact = z.infer<typeof RuleArtifact>;
export type Artifact = z.infer<typeof Artifact>;
export type ArtifactKind = Artifact["kind"];

/** Parse an untrusted artifact, throwing a redaction-safe `ValidationError` on any violation. */
export function parseArtifact(input: unknown): Artifact {
  return parseStrict(Artifact, input);
}
