export {
  deriveDomains,
  domainForPath,
  domainIds,
  IGNORE_UNIT,
} from "./domains.ts";
export type { Domain, SurfaceClass } from "./domains.ts";

export { applicableDimensions, DIMENSIONS, dimension } from "./dimensions.ts";
export type { Dimension, DimensionId } from "./dimensions.ts";

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

export {
  coverageGrid,
  isRoundDry,
  parseCoverage,
  serializeCoverage,
} from "./coverage.ts";
export type { Cell, CoverageRow, DryInputs, DryResult } from "./coverage.ts";

export { majorityKills, validateHighRisk } from "./validate.ts";
export type { ChallengeVerdict, Challenger } from "./validate.ts";
