// Reference-integrity (ghost-ref) validation + the typed `define*()` builders (ADR-0065). `schema.ts`
// parses ONE artifact's SHAPE; this layer validates a SET's cross-references. An artifact may depend
// on another BY NAME (`dependencies`), and a ref naming nothing in the authored set is a GHOST.
//
// Reference integrity reuses the mcp-server registry-ALLOWLIST pattern (`server.ts`): build a `Set` of
// authored names, then reject any ref not in it BEFORE it can reach a consumer — fail-closed, one ghost
// rejects the whole set. The validator THROWS (flag-never-guess); it never silently drops or guesses a
// ref. Engine-neutral: this resolves names, it does not load or run anything.
import { ValidationError, parseStrict } from "@caisson-sh/kernel";
import {
  AgentArtifact,
  RuleArtifact,
  SkillArtifact,
  parseArtifact,
} from "./schema.ts";

/**
 * Validate a SET of artifacts for reference integrity, returning the resolved ref graph.
 *
 * 1. Every artifact is parsed strict (`parseArtifact`) — a mis-shaped member rejects the whole set.
 * 2. The authored names form the allowlist (the registry-allowlist pattern applied to artifact names).
 * 3. Each `dependencies` cross-ref is resolved against that allowlist in authored order; the FIRST ref
 *    naming nothing in the set is a ghost and THROWS a redaction-safe `ValidationError`
 *    (deterministic — no partial resolution: one ghost fails the set).
 *
 * Returns the sorted `"<name>-><dep>"` ref edges of a clean set (empty when there are no cross-refs).
 */
export function validateArtifactSet(input: readonly unknown[]): string[] {
  const artifacts = input.map(parseArtifact);
  const authored = new Set(artifacts.map((artifact) => artifact.name));
  const resolved: string[] = [];
  for (const artifact of artifacts) {
    for (const ref of artifact.dependencies ?? []) {
      if (!authored.has(ref)) {
        throw new ValidationError(
          `unresolved reference '${ref}' from '${artifact.name}'`,
          { missingRef: ref, referencedBy: artifact.name },
        );
      }
      resolved.push(`${artifact.name}->${ref}`);
    }
  }
  return resolved.sort();
}

// ── define*() builders ──────────────────────────────────────────────────────────────────────────
// The authoring front door: build an artifact of a FIXED kind and validate it strict in one call,
// against the same Zod member the discriminated union (`parseArtifact`) routes to. A shape violation
// surfaces as a redaction-safe `ValidationError` (never the rejected value); the return type is the
// concrete member, so an authored artifact is narrowed without a runtime `kind` check.

/** Build + validate an `agent` artifact. Throws `ValidationError` on any shape violation. */
export function defineAgent(spec: Omit<AgentArtifact, "kind">): AgentArtifact {
  return parseStrict(AgentArtifact, { ...spec, kind: "agent" });
}

/** Build + validate a `skill` artifact. Throws `ValidationError` on any shape violation. */
export function defineSkill(spec: Omit<SkillArtifact, "kind">): SkillArtifact {
  return parseStrict(SkillArtifact, { ...spec, kind: "skill" });
}

/** Build + validate a `rule` artifact. Throws `ValidationError` on any shape violation. */
export function defineRule(spec: Omit<RuleArtifact, "kind">): RuleArtifact {
  return parseStrict(RuleArtifact, { ...spec, kind: "rule" });
}
