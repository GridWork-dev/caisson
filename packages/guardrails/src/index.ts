// @caisson-sh/guardrails — the gateway content-safety primitive (ADR-0063): a swappable `Moderator`
// port + a TS-native PII engine (mask / hash / reversible-tokenize via field-crypto) behind a
// fail-closed input/output guard that throws `GuardrailError` 422 and emits a metadata-only
// `guardrail.blocked` event to the kernel `EventSink`. `guard.ts` also runs an unconditional
// credential-shape gate (ADR-0215, category `"secret"`) before either leg reaches the moderator; a
// standalone FTC "4 Ps" dark-pattern evaluator scores marketing/UI copy separately (`ftc4p.ts`), and
// a claim-ceiling evaluator gates marketing/AI claim strings against their backing eval evidence
// (`claim-ceiling.ts`). A base primitive the AI Production Kit gateway composes; it never imports an
// edition (ADR-0003).

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
  maskPii,
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

// Additive WebCrypto/browser twins. These names also form the supported `./browser` subset.
export {
  hashPiiAsync,
  tokenizePiiAsync,
  detokenizePiiAsync,
} from "./pii-browser.ts";
export type { BrowserPiiCryptoContext } from "./pii-browser.ts";

// The fail-closed input/output guard.
export { guardInput, guardOutput } from "./guard.ts";
export type {
  GuardPolicy,
  GuardRuntime,
  GuardOutcome,
  PiiPolicy,
} from "./guard.ts";
export { guardInputAsync } from "./guard-browser.ts";
export type {
  BrowserGuardOutcome,
  BrowserGuardPolicy,
  BrowserPiiPolicy,
} from "./guard-browser.ts";
export type { GuardPolicyBase } from "./guard-core.ts";

// FTC "4 Ps" dark-pattern presentation guardrail (ADR-0215) — scores static marketing/UI copy;
// optionally wrappable as a Moderator via `ftc4pModerator`, but not wired into `guard.ts` itself.
export {
  FTC_4P_DIMENSIONS,
  evaluateFtc4P,
  ftc4pModerator,
  ftc4pFindingSchema,
  ftc4pResultSchema,
} from "./ftc4p.ts";
export type { Ftc4PDimension, Ftc4PFinding, Ftc4PResult } from "./ftc4p.ts";

// Evidence-gated claims / honest claim-ceiling release gate — a generic evidence -> claim-tier
// evaluator consumed at copy-review time, not wired into `guard.ts` (no live request leg).
export {
  CLAIM_TIERS,
  claimTier,
  assertClaimAllowed,
  allowedClaims,
  ClaimCeilingError,
  claimEvidenceSchema,
  claimSchema,
} from "./claim-ceiling.ts";
export type { ClaimTier, ClaimEvidence, Claim } from "./claim-ceiling.ts";
