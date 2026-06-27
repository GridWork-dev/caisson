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
