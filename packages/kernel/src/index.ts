// @caisson-sh/kernel — the foundational shared library every base + edition package depends on.
//
// THIS BARREL IS BROWSER-SAFE and must stay that way: nothing reachable from here may import a node
// builtin at module scope, because a bundler resolves the entire graph behind the "@caisson-sh/kernel"
// specifier even when the importer only wanted one pure symbol. The node-only surface — constant-time
// compare (`crypto.ts`), audit-chain hashing (`audit-chain.ts`), migration assembly, and the SSRF
// guard — lives behind "@caisson-sh/kernel/node" (`node.ts`), which re-exports everything below as well.
// Adding a `node:` import to any module in this graph silently un-bundles every browser consumer.
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

export { assertNotReadOnly } from "./read-only.ts";
export type { SystemMode } from "./read-only.ts";
export { scrubForEgress, looksLikeSecret } from "./secret-scrub.ts";
export { scrubDeep, PHI_KEY } from "./scrub-deep.ts";
export { fetchWithTimeout } from "./fetch.ts";
export type { FetchTimeoutOptions } from "./fetch.ts";
export { strictObject, parseStrict } from "./schema.ts";
export { loadConfig } from "./config.ts";
export type { EnvSource } from "./config.ts";

// The pure serialization + the chain value types come straight from the node-free `canonical.ts`;
// the hashing half (`contentHash`/`hashChainLink`/`chainEntry`/`buildChain`/`verifyChain`) needs
// `node:crypto` and therefore lives on "@caisson-sh/kernel/node". `anchorChain` is pure (no hashing)
// and is reachable browser-safe on "@caisson-sh/kernel/audit-verify".
export { canonicalize } from "./canonical.ts";
export type {
  JsonValue,
  AuditChainEntry,
  ChainVerification,
  AuditChainAnchor,
} from "./canonical.ts";
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

// `assembleMigrations` / `assembleMigrationsWithPinnedPrefix` need `node:crypto` and live on
// "@caisson-sh/kernel/node". Their TYPES stay here: a `export type` re-export is erased at emit, so it
// never puts `migration-assembly.ts` into a bundle graph.
export type {
  MigrationFile,
  PackageMigrations,
  PinnedMigrationIdentity,
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
