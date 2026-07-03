// @caisson/kernel — the foundational shared library every base + edition package depends on.
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

export { safeEqualFixed, safeEqualVariable } from "./crypto.ts";
export { scrubForEgress, looksLikeSecret } from "./secret-scrub.ts";
export { scrubDeep, PHI_KEY } from "./scrub-deep.ts";
export { fetchWithTimeout } from "./fetch.ts";
export type { FetchTimeoutOptions } from "./fetch.ts";
export {
  assertResolvedHostPublic,
  assertSafePublicUrl,
  assertSafePublicUrlResolved,
  isPrivateAddress,
  ssrfGuardedFetch,
} from "./ssrf.ts";
export { strictObject, parseStrict } from "./schema.ts";
export { loadConfig } from "./config.ts";
export type { EnvSource } from "./config.ts";

export {
  canonicalize,
  hashChainLink,
  chainEntry,
  buildChain,
  verifyChain,
  anchorChain,
} from "./audit-chain.ts";
export type {
  JsonValue,
  AuditChainEntry,
  ChainVerification,
  AuditChainAnchor,
} from "./audit-chain.ts";
export {
  validateVersionSet,
  isCurrent,
  currentVersions,
  versionChain,
} from "./versioning.ts";
export type { VersionRecord } from "./versioning.ts";

export {
  InMemoryEventSink,
  NoopEventSink,
  OtelPostgresEventSink,
  opsEventSchema,
  redactEvent,
} from "./event-sink.ts";
export type {
  EventSink,
  OpsEvent,
  OtelPostgresSinkOptions,
  OtlpSend,
} from "./event-sink.ts";

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

export { assembleMigrations } from "./migration-assembly.ts";
export type {
  MigrationFile,
  PackageMigrations,
  MergedMigration,
  SchemaVersionEntry,
  MigrationAssembly,
} from "./migration-assembly.ts";

export {
  CREDIT_CONVERSION,
  creditConversionSchema,
  parseCreditConversion,
  centsToCredits,
  centsToCreditsProvenance,
} from "./credit-conversion.ts";
export type { CreditConversion } from "./credit-conversion.ts";

export {
  asCents,
  asCredits,
  asMicroUsd,
  asMicroUsdPerCredit,
  // The brand key itself — exported so a dependent package's declaration emit can NAME the branded
  // types through this public entry (TS2742 otherwise). Never used at runtime on money values.
  brandTag,
  unwrapMoney,
} from "./money.ts";
export type {
  Cents,
  Credits,
  MicroUsd,
  MicroUsdPerCredit,
  MoneyBrand,
  RoundedMoney,
  RoundingMode,
} from "./money.ts";
