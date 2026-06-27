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
  RateLimitError,
  ConfigError,
  InternalError,
  isCaissonError,
  isUniqueViolation,
  toErrorResponse,
} from "./errors.ts";
export type { ErrorEnvelope } from "./errors.ts";

export { safeEqualFixed, safeEqualVariable } from "./crypto.ts";
export { fetchWithTimeout } from "./fetch.ts";
export type { FetchTimeoutOptions } from "./fetch.ts";
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
} from "./observability.ts";
export type {
  EvidencePack,
  UsageMetering,
  EvalResult,
} from "./observability.ts";

export { assembleMigrations } from "./migration-assembly.ts";
export type {
  MigrationFile,
  PackageMigrations,
  MergedMigration,
  SchemaVersionEntry,
  MigrationAssembly,
} from "./migration-assembly.ts";
