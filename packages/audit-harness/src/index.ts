export { AUDIT_DOMAINS } from "./domains.ts";
export type { AuditDomain } from "./domains.ts";

export {
  parseFindings,
  reconcile,
  serializeFindings,
  stableId,
  withId,
} from "./findings.ts";
export type {
  Finding,
  FindingSeverity,
  FindingStatus,
  RawFinding,
  ReconcileClass,
  ReconcileResult,
} from "./findings.ts";

export { checkScope } from "./scope-guard.ts";

export {
  enumerateSurface,
  selectValidateCandidates,
  summarize,
} from "./surface.ts";
export type { LedgerSummary } from "./surface.ts";

export { majorityKills, validateHighRisk } from "./validate.ts";
export type { ChallengeVerdict, Challenger } from "./validate.ts";
