// @caisson/agent-kernel — the engine-neutral agent kernel (ADR-0065): agent/skill/rule schema +
// the lifecycle act FSM + the hooks dispatcher. No vendor SDK import, no LLM call — composition
// mechanism only; both base (cli, mcp-server) and the agent-dev edition consume it down-only.
export {
  AgentArtifact,
  SkillArtifact,
  RuleArtifact,
  Artifact,
  parseArtifact,
} from "./schema.ts";
export type { ArtifactKind } from "./schema.ts";

export {
  ACTS,
  CANONICAL_LIFECYCLE,
  canTransition,
  isTerminal,
  transition,
  runLifecycle,
} from "./lifecycle.ts";
export type { Act, LifecycleStep } from "./lifecycle.ts";

export { HookDispatcher } from "./hooks.ts";
export type { HookName, HookPhase, HookContext, HookHandler } from "./hooks.ts";
