export { requireSession } from "./session.ts";
export type { Role, SessionContext, SessionProvider } from "./session.ts";
export { ACCOUNT_MEMBER_SCHEMA_SQL } from "./schema.ts";
// Session-token hash-at-rest (ADR-0366) — pure crypto, no better-auth import.
export { deriveTokenLookupKey } from "./session-token.ts";
// Session-resolution half only (ADR-0257 §1.3) — runs on every login, stays open. The
// owner-gated MANAGE half (list/add/assertCanManageMembers) + WorkOS SSO moved to @caisson-sh/org-controls.
export {
  ensurePersonalAccount,
  resolveUserAccounts,
  selectActiveAccount,
} from "./membership.ts";
export type { AccountMembership } from "./membership.ts";
export {
  generateAccountKeyPair,
  signAccountJwt,
  verifyAccountJwt,
} from "./jwt.ts";
export type { AccountClaims, SignOptions } from "./jwt.ts";
