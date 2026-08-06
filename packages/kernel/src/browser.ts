// Narrow, decision-only browser surface. The historical `.` entry remains browser-compatible, but
// it intentionally includes config, event-sink, and fetch helpers. Packages promising a zero-network
// client graph import this strict subset so those capabilities cannot arrive through a barrel edge.
export {
  CaissonError,
  ValidationError,
  AuthnError,
  AuthzError,
  EntitlementError,
  InsufficientCreditsError,
  NotFoundError,
  TenancyError,
  ConflictError,
  GuardrailError,
  RateLimitError,
  ConfigError,
  InternalError,
  isCaissonError,
  isUniqueViolation,
  toErrorResponse,
} from "./errors.ts";
export type { ErrorEnvelope } from "./errors.ts";

export { strictObject, parseStrict } from "./schema.ts";
export { scrubForEgress, looksLikeSecret } from "./secret-scrub.ts";

export {
  evidencePackSchema,
  usageMeteringSchema,
  evalResultSchema,
  guardrailBlockSchema,
} from "./observability.ts";
export type {
  EvidencePack,
  UsageMetering,
  EvalResult,
  GuardrailBlock,
} from "./observability.ts";
