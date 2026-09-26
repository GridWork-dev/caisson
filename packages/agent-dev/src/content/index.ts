// Curated Caisson-native content barrel (ADR-0065/0066). The agent-dev edition's default
// agents/skills/rules set, authored once against the engine-neutral agent-kernel schema and exposed
// as ONE typed `Artifact[]` the emitter and the edition composition consume down-only. Every member
// was validated `.strict()` by its `define*()` builder; reference integrity over the whole set (no
// ghost cross-refs) is asserted by `validateArtifactSet` in `content.test.ts`.
//
// Stable, deterministic order — rules, then skills, then agents — so the emitted bundle is byte-stable.
// This barrel is content only; it imports NOTHING from the emitter or the package root, keeping the
// curated set decoupled from how any harness renders it.
import type { Artifact } from "@caisson-sh/agent-kernel";
import { CAISSON_AGENTS } from "./agents.ts";
import { CAISSON_RULES } from "./rules.ts";
import { CAISSON_SKILLS } from "./skills.ts";

export { CAISSON_AGENTS } from "./agents.ts";
export { CAISSON_RULES } from "./rules.ts";
export { CAISSON_SKILLS } from "./skills.ts";

/** The full curated default set — rules, then skills, then agents — as one typed artifact list. */
export const CAISSON_DEFAULT_ARTIFACTS: readonly Artifact[] = [
  ...CAISSON_RULES,
  ...CAISSON_SKILLS,
  ...CAISSON_AGENTS,
];
