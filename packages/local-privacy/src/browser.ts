// Decision-only browser entry: strict policy parsing plus URL/purpose admission. The fetch-capable
// EgressGuard stays on `.` so a client demo cannot acquire a network path through this subpath.
export {
  PrivacyDecisionGuard,
  createPrivacyDecisionGuard,
} from "./decision-guard.ts";
export {
  parsePrivacyPolicy,
  localOnlyPolicy,
  ZERO_EGRESS_POLICY,
  privacyPolicySchema,
  egressSinkSchema,
  sinkKindSchema,
  privacyModeSchema,
  SANCTIONED_SINK_KINDS,
  PRIVACY_MODES,
} from "./policy.ts";
export type {
  PrivacyPolicy,
  EgressSink,
  SanctionedSinkKind,
  PrivacyMode,
} from "./policy.ts";
