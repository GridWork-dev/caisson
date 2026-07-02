// @caisson/guardrails — the gateway content-safety primitive (ADR-0063): a swappable `Moderator`
// port + a TS-native PII engine (mask / hash / reversible-tokenize via field-crypto) behind a
// fail-closed input/output guard that throws `GuardrailError` 422 and emits a metadata-only
// `guardrail.blocked` event to the kernel `EventSink`. `guard.ts` also runs an unconditional
// credential-shape gate (ADR-0209, category `"secret"`) before either leg reaches the moderator; a
// standalone FTC "4 Ps" dark-pattern evaluator scores marketing/UI copy separately (`ftc4p.ts`). A
// base primitive the AI Production Kit gateway composes; it never imports an edition (ADR-0003).

// Moderator port + drivers + the forge.config policy block.
export {
  moderatorPolicySchema,
  compileBlocklist,
  localModerator,
  providerModerator,
  customModerator,
  moderateWithDeadline,
} from "./moderator.ts";
export type {
  GuardCategory,
  ModerationResult,
  Moderator,
  ModeratorPolicy,
} from "./moderator.ts";

// PII detection + redaction (mask / hash / reversible tokenize).
export {
  PII_KINDS,
  PII_COLUMN_CONTEXT,
  detectPii,
  redactPii,
  tokenizePii,
  detokenizePii,
} from "./pii.ts";
export type {
  PiiKind,
  PiiMatch,
  PiiToken,
  PiiMode,
  RedactMode,
} from "./pii.ts";

// The fail-closed input/output guard.
export { guardInput, guardOutput } from "./guard.ts";
export type {
  GuardPolicy,
  GuardRuntime,
  GuardOutcome,
  PiiPolicy,
} from "./guard.ts";

// FTC "4 Ps" dark-pattern presentation guardrail (ADR-0209) — scores static marketing/UI copy;
// optionally wrappable as a Moderator via `ftc4pModerator`, but not wired into `guard.ts` itself.
export {
  FTC_4P_DIMENSIONS,
  evaluateFtc4P,
  ftc4pModerator,
  ftc4pFindingSchema,
  ftc4pResultSchema,
} from "./ftc4p.ts";
export type { Ftc4PDimension, Ftc4PFinding, Ftc4PResult } from "./ftc4p.ts";
