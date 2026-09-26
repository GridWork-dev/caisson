// @caisson-sh/agent-kernel — the engine-neutral agent kernel (ADR-0065): agent/skill/rule schema +
// the lifecycle act FSM + the hooks dispatcher. No vendor SDK import, no LLM call — composition
// mechanism only; both base (cli, mcp-server) and the Agentic-Dev bundle consume it down-only.
export {
  AgentArtifact,
  SkillArtifact,
  RuleArtifact,
  Artifact,
  parseArtifact,
} from "./schema.ts";
export type { ArtifactKind } from "./schema.ts";

export {
  validateArtifactSet,
  defineAgent,
  defineSkill,
  defineRule,
} from "./validate.ts";

export {
  ACTS,
  CANONICAL_LIFECYCLE,
  canTransition,
  isTerminal,
  transition,
  runLifecycle,
} from "./lifecycle.ts";
export type { Act, LifecycleStep } from "./lifecycle.ts";

export { HookDispatcher, commandHandler } from "./hooks.ts";
export type {
  HookName,
  HookPhase,
  HookContext,
  HookHandler,
  HookDispatchResult,
  HookDispatcherOptions,
  CommandHookSpec,
  CommandRunner,
} from "./hooks.ts";

export {
  allow,
  deny,
  mutate,
  isAllow,
  isDeny,
  isMutate,
  predicateGuard,
  evaluateGuards,
} from "./governance.ts";
export type {
  HookDecision,
  HookResult,
  TransitionContext,
  TransitionGuard,
} from "./governance.ts";

export {
  AuditedLifecycle,
  InMemoryAuditLifecycleStore,
} from "./audit-lifecycle.ts";
export type {
  RecordedDecision,
  LifecycleAuditPayload,
  AuditLifecycleSnapshot,
  AuditLifecycleStore,
  AuditedLifecycleOptions,
  RecordOutcome,
} from "./audit-lifecycle.ts";

export {
  makeRedactingLogger,
  toRedactedJsonlLine,
} from "./redacting-logger.ts";
export type { JsonlSink } from "./redacting-logger.ts";
