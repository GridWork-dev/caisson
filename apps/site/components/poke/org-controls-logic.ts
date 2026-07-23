// Deterministic client-side mirror of @caisson/org-controls's owner-gated membership write
// (ADR-0176 / ADR-0257 §1.3) for the "org-controls" poke (ADR-0378 lock 2, kimi CANDIDATES §B).
// Nothing here fetches, persists, measures the visitor, or uses Date.now / Math.random in a
// rendered-output path.
//
// Why mirrored instead of imported: @caisson/org-controls declares exactly one export, ".", which
// resolves to src/index.ts. That barrel pulls in workos.ts and clerk.ts (network SSO transports —
// clerk.ts also imports the `@clerk/backend` SDK) plus membership.ts and admin-write.ts, both of
// which import the RUNTIME `@caisson/kernel` barrel ("@caisson/kernel", not a subpath) for
// `AuthzError`/`TenancyError` — that barrel itself re-exports audit-chain.ts's `node:crypto`
// `createHash` and ssrf.ts's `node:dns/promises`, so it cannot resolve in a browser bundle.
// membership.ts's own writes (`addAccountMember`/`removeAccountMember`) additionally call
// `withTenant` from `@caisson/tenancy-rls`, a real Postgres transaction — nothing a static site can
// run client-side regardless of bundling. org-controls exposes no subpath around any of this, so the
// owner-gate + row-shape logic below is a line-for-line port of `assertCanManageMembers` and the
// literal SQL `addAccountMember` issues (packages/org-controls/src/membership.ts), parity-pinned in
// org-controls-logic.test.ts against that real file (imported by relative path — apps/site does not
// declare @caisson/org-controls as a dependency).
//
// ONE exception: the "audit row" below is NOT a mirror. `hashChainLinkAsync` is imported for real
// from `@caisson/kernel/audit-verify` — a dedicated subpath that imports only the node-free
// `canonical.ts` and WebCrypto, so it is genuinely bundle-safe (the same primitive
// `@caisson/audit-worm`'s own client-side `useRowVerify` hook uses). @caisson/org-controls does not
// wire a live audit-log table for `account_member` today; this demo runs the real, generic
// audit-chain hash (ADR-0006) over the row a mutation would write, to show what one tamper-evident
// entry would look like — never claiming a shipped feature that does not exist.
import { hashChainLinkAsync } from "@caisson/kernel/audit-verify";

/** Mirrors @caisson/auth's session.ts `Role` — the DB CHECK constraint is `role IN ('owner','seat')`. */
export type Role = "owner" | "seat";

/** Mirrors kernel `errors.ts` `AuthzError` — 403, metadata-free. */
export interface RoleGateError {
  readonly code: "forbidden";
  readonly httpStatus: 403;
  readonly message: string;
}

export type RoleGateVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly error: RoleGateError };

/** Verbatim: membership.ts `assertCanManageMembers`'s thrown `AuthzError` message. */
const DENIAL_MESSAGE = "Only an account owner can manage members or billing";

/**
 * Verbatim algorithm: membership.ts `assertCanManageMembers` (ADR-0176 — seats cannot manage), ported
 * to a return value instead of a throw so the poke can render it without a try/catch. Every
 * `addAccountMember` / `removeAccountMember` call runs this gate first, unconditionally.
 */
export function checkManageMembers(actorRole: Role): RoleGateVerdict {
  if (actorRole !== "owner") {
    return {
      allowed: false,
      error: { code: "forbidden", httpStatus: 403, message: DENIAL_MESSAGE },
    };
  }
  return { allowed: true };
}

/** The shape `account_member` (packages/auth/src/schema.ts `ACCOUNT_MEMBER_SCHEMA_SQL`) carries. */
export interface AccountMemberRow {
  readonly account_id: string;
  readonly user_id: string;
  readonly role: Role;
  readonly created_at: string;
}

/** Sample account this demo adds a seat to. Labeled as a sample in the UI, never a real account. */
export const SAMPLE_ACCOUNT_ID = "acct_sample";
/** Sample user id an owner is adding as a seat. */
export const SAMPLE_NEW_USER_ID = "user_sample_new";
/**
 * A FIXED stand-in for the real INSERT's `created_at timestamptz NOT NULL DEFAULT now()` — this demo
 * never calls the clock, so the row shown is reproducible on every render.
 */
export const SAMPLE_CREATED_AT = "2026-01-01T00:00:00.000Z";
/** Verbatim: `addAccountMember`'s own default for its `role` parameter. */
const DEFAULT_ADDED_ROLE: Role = "seat";

/**
 * The row `addAccountMember`'s `INSERT INTO account_member (account_id, user_id, role) VALUES
 * ($1, $2, $3) ON CONFLICT DO NOTHING` would write, over the sample inputs above. Pure — no DB call.
 */
export function buildMemberRow(): AccountMemberRow {
  return {
    account_id: SAMPLE_ACCOUNT_ID,
    user_id: SAMPLE_NEW_USER_ID,
    role: DEFAULT_ADDED_ROLE,
    created_at: SAMPLE_CREATED_AT,
  };
}

/** One link of a kernel audit chain (kernel/canonical.ts `AuditChainEntry`'s public shape). */
export interface AuditChainRow {
  readonly seq: number;
  readonly prevHash: string | null;
  readonly payload: AccountMemberRow;
  readonly hash: string;
}

/**
 * This demo's own first (genesis) chain entry over `row` — real `hashChainLinkAsync` (WebCrypto
 * SHA-256), not a mirror. `seq`/`prevHash` follow kernel `chainEntry`'s genesis case (`prev === null`
 * → `seq: 0`, `prevHash: null`); that arithmetic is the only part not imported (`chainEntry` itself
 * lives in the node-tainted `audit-chain.ts`, unreachable here).
 */
export async function buildAuditEntry(
  row: AccountMemberRow,
): Promise<AuditChainRow> {
  const prevHash: string | null = null;
  const hash = await hashChainLinkAsync(prevHash, { ...row });
  return { seq: 0, prevHash, payload: row, hash };
}
