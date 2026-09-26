// Curated Caisson-native RULES (ADR-0065/0066). A minimal default set authored against the
// agent-kernel `RuleArtifact` schema through the `defineRule` builder — so every entry is validated
// `.strict()` at module load (a mis-shaped rule throws here, never reaches a consumer). These are
// Caisson-native binding constraints, authored directly against this schema. A rule is a blocking
// constraint with a severity (never advisory). Authored in stable, deterministic order — the emitter
// renders this order.
import { type RuleArtifact, defineRule } from "@caisson-sh/agent-kernel";

/** The default rule set a buyer of the agent-dev edition gets out of the box (engine-neutral). */
export const CAISSON_RULES: readonly RuleArtifact[] = [
  defineRule({
    name: "no-any-in-prod",
    description:
      "Production code may not use `any` or silence a real type error; model the type instead.",
    severity: "error",
  }),
  defineRule({
    name: "validate-at-boundaries",
    description:
      "All external input is parsed by a strict schema at the boundary; unknown fields are rejected, not dropped.",
    severity: "error",
  }),
  defineRule({
    name: "constant-time-secret-compare",
    description:
      "Every secret, token, or signature comparison uses a constant-time compare, never a plain equality check.",
    severity: "error",
  }),
  defineRule({
    name: "bounded-outbound-fetch",
    description:
      "Every outbound network call carries an explicit timeout; an unbounded request is rejected in review.",
    severity: "warning",
  }),
];
