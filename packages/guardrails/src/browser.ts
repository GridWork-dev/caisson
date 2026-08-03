// Browser-safe public subset: the shared PII detector/mask, WebCrypto hash + field tokenization,
// local moderator, and fail-closed guard. No KMS/provider transport, FTC/claims presentation logic,
// demo fixtures, or Node-only synchronous crypto crosses this boundary.
export {
  PII_KINDS,
  PII_COLUMN_CONTEXT,
  detectPii,
  maskPii,
} from "./pii-core.ts";
export type {
  PiiKind,
  PiiMatch,
  PiiMode,
  PiiToken,
  RedactMode,
} from "./pii-core.ts";

export {
  hashPiiAsync,
  tokenizePiiAsync,
  detokenizePiiAsync,
} from "./pii-browser.ts";
export type { BrowserPiiCryptoContext } from "./pii-browser.ts";

export { localModerator } from "./moderator.ts";
export type {
  GuardCategory,
  ModerationResult,
  Moderator,
} from "./moderator.ts";

export { guardInputAsync } from "./guard-browser.ts";
export type {
  BrowserGuardOutcome,
  BrowserGuardPolicy,
  BrowserPiiPolicy,
} from "./guard-browser.ts";
export { guardOutput } from "./guard-core.ts";
export type { GuardPolicyBase, GuardRuntime } from "./guard-core.ts";
