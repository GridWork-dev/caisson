// The ADR-0220 operator mutation surface — the four locked actions (Fork AM-1 = A): entitlement
// grant, entitlement revoke, credit adjust (±), license reissue. Each:
//   1. runs as the cross-tenant `admin_write` role (`withAdminWrite`, Fork AM-2 = B) — DB-separated
//      from the buyer `app` runtime — bounded to ONE operator-chosen target account per call;
//   2. is dual-logged (Fork AM-4 = A): an `admin_action_log` row written in the SAME transaction as
//      the mutation (atomic — a failed mutation logs neither), THEN a tamper-evident WORM chain
//      entry appended to the target tenant's `AuditChainStore` (reuse, not rebuild).
// Reuse is the rule: entitlement writes route through `grantAdminComp`/`revokeAdminComp`
// (entitlement-store.ts), credit adjust rides the ADR-0074 `feature_grant`/`feature_debit` envelope
// under the registered `admin_adjust` tag (Fork AM-3 = A — no base credit_event schema change), and
// license reissue proxies the existing `POST /issue` re-serve (Fork AM-5) via an injected proxy.
//
// The Zod `.strict()` bodies here are the mutation boundary (mirroring app.ts's `/issue` body); the
// apps/admin route parses with them before calling in, so an unknown field or a missing target is
// rejected fail-closed at the edge. The account id comes from operator input (the sanctioned
// `withTenant`-contract exception, ADR-0220): the guardrails are CF-Access + this allowlist of
// exactly four RPCs + the one-account bound + the dual log, not session-derived scoping.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuditChainStore } from "@caisson/audit-worm";
import { balance, debit, grant } from "@caisson/credits";
import { asCredits, type JsonValue } from "@caisson/kernel";
import {
  buildAdminWritePolicySql,
  withAdminWrite,
  type Transactor,
} from "@caisson/tenancy-rls";
import { insertAdminActionLog, type AdminAction } from "./admin-audit-log.ts";
import {
  grantAdminComp,
  readEntitlements,
  revokeAdminComp,
} from "./entitlement-store.ts";

// The `admin_write` cross-tenant policies for every table the mutation surface writes:
// `entitlement_grant` (service-owned) + the BASE credit tables `credit_wallet` / `credit_event`.
// Applied EXTERNALLY — after the `admin_write` role exists — at DEPLOY (and in the test/dev double),
// NEVER embedded in a schema constant every buyer-path test applies (mirroring how ADR-0141's
// `buildAdminReadPolicySql` is applied outside the owning packages). Keeping the credit policies
// here also leaves base `@caisson/credits` untouched (Fork AM-3 — no money-core schema change).
// `license_grant` needs none (the reissue proxy, not admin_write, persists it). Run once per DEPLOY.
export const ADMIN_MUTATION_PROVISION_SQL = [
  buildAdminWritePolicySql("entitlement_grant"),
  buildAdminWritePolicySql("credit_wallet"),
  buildAdminWritePolicySql("credit_event"),
].join("\n");

/** The re-served token an injected `/issue` proxy returns (Fork AM-5); never carries the bearer. */
export interface ReissueProxyResult {
  token: string;
  licenseId: string;
}

/** Dependencies for the mutation surface — injected so tests need no live socket or S3. */
export interface AdminMutationDeps {
  /** The admin Postgres transactor (a role that can `SET ROLE admin_write` + `app`). */
  db: Transactor;
  /** The per-tenant WORM chain the tamper-evident audit half appends to (@caisson/audit-worm). */
  worm: AuditChainStore;
  /**
   * Server-side `/issue` proxy for reissue (Fork AM-5): re-serves the buyer's EXISTING token for
   * (accountId, major), authenticated with the distinct admin-scoped credential — NEVER the browser.
   * Injected (prod: a fetch to services/license `/issue`; tests: a fake), so this module holds no
   * socket. Must throw on a non-2xx so a failed reissue writes no audit rows.
   */
  issue: (req: {
    accountId: string;
    tier: string;
    major: number;
    expiry: string | null;
  }) => Promise<ReissueProxyResult>;
}

const accountId = z.string().trim().min(1).max(256);

export const GrantEntitlementBody = z
  .object({
    targetAccountId: accountId,
    entitlementIds: z.array(z.string().trim().min(1).max(128)).min(1).max(64),
  })
  .strict();

export const RevokeEntitlementBody = z
  .object({
    targetAccountId: accountId,
    entitlementId: z.string().trim().min(1).max(128),
  })
  .strict();

export const AdjustCreditsBody = z
  .object({
    targetAccountId: accountId,
    // Integer credit units (ADR-0007), non-zero, bounded — a comp or a correction, never a float.
    deltaCredits: z
      .number()
      .int()
      .refine((n) => n !== 0, "deltaCredits must be non-zero"),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const ReissueLicenseBody = z
  .object({
    targetAccountId: accountId,
    major: z.number().int().nonnegative(),
  })
  .strict();

export type GrantEntitlementInput = z.infer<typeof GrantEntitlementBody> & {
  actorEmail: string;
};
export type RevokeEntitlementInput = z.infer<typeof RevokeEntitlementBody> & {
  actorEmail: string;
};
export type AdjustCreditsInput = z.infer<typeof AdjustCreditsBody> & {
  actorEmail: string;
};
export type ReissueLicenseInput = z.infer<typeof ReissueLicenseBody> & {
  actorEmail: string;
  /** The stored grant's tier/expiry, read by the caller (ADR-0141 admin read) — a re-serve only. */
  tier: string;
  expiry: string | null;
};

/** Append the tamper-evident WORM half AFTER the mutation+log tx commits (both are separate roles).
 *  A mutation that throws never reaches here → neither half is written (Fork AM-4 atomicity). */
async function appendWorm(
  deps: AdminMutationDeps,
  targetAccountId: string,
  action: AdminAction,
  actorEmail: string,
  before: JsonValue,
  after: JsonValue,
): Promise<void> {
  await deps.worm.append(targetAccountId, {
    source: "admin_action",
    action,
    actorEmail,
    targetAccountId,
    before,
    after,
    at: new Date().toISOString(),
  });
}

export interface EntitlementMutationResult {
  targetAccountId: string;
  before: string[];
  after: string[];
  changed: number;
}

/** Action 1 — comp a set of entitlements to one account (source_kind `admin_comp`). */
export async function grantEntitlementAdmin(
  deps: AdminMutationDeps,
  input: GrantEntitlementInput,
): Promise<EntitlementMutationResult> {
  const result = await withAdminWrite(deps.db, async (tx) => {
    const before = await readEntitlements(tx, input.targetAccountId);
    const changed = await grantAdminComp(tx, {
      accountId: input.targetAccountId,
      entitlementIds: input.entitlementIds,
      sourceEventId: randomUUID(),
    });
    const after = await readEntitlements(tx, input.targetAccountId);
    await insertAdminActionLog(tx, {
      actorEmail: input.actorEmail,
      targetAccountId: input.targetAccountId,
      action: "entitlement_grant",
      before: { entitlements: before },
      after: { entitlements: after },
    });
    return { before, after, changed };
  });
  await appendWorm(
    deps,
    input.targetAccountId,
    "entitlement_grant",
    input.actorEmail,
    { entitlements: result.before },
    { entitlements: result.after },
  );
  return { targetAccountId: input.targetAccountId, ...result };
}

/** Action 2 — revoke an operator comp entitlement for one account (admin_comp grants only). */
export async function revokeEntitlementAdmin(
  deps: AdminMutationDeps,
  input: RevokeEntitlementInput,
): Promise<EntitlementMutationResult> {
  const result = await withAdminWrite(deps.db, async (tx) => {
    const before = await readEntitlements(tx, input.targetAccountId);
    const changed = await revokeAdminComp(tx, {
      accountId: input.targetAccountId,
      entitlementId: input.entitlementId,
    });
    const after = await readEntitlements(tx, input.targetAccountId);
    await insertAdminActionLog(tx, {
      actorEmail: input.actorEmail,
      targetAccountId: input.targetAccountId,
      action: "entitlement_revoke",
      before: { entitlements: before },
      after: { entitlements: after },
    });
    return { before, after, changed };
  });
  await appendWorm(
    deps,
    input.targetAccountId,
    "entitlement_revoke",
    input.actorEmail,
    { entitlements: result.before },
    { entitlements: result.after },
  );
  return { targetAccountId: input.targetAccountId, ...result };
}

export interface CreditAdjustResult {
  targetAccountId: string;
  balanceBefore: number;
  balanceAfter: number;
  /** Credits actually applied — for a negative adjust this is clamped to the prior balance. */
  applied: number;
}

/**
 * Action 3 — adjust a wallet (± integer credits). Positive rides base `grant`(feature_grant); a
 * negative correction clamps to the current balance (SELECT ... FOR UPDATE) then rides base
 * `debit`(feature_debit) — NEVER pushing the wallet below zero, and NEVER relying on debit's 402
 * floor (we clamp so it cannot trip). Both carry the registered `admin_adjust` tag (Fork AM-3 = A),
 * so the money core needs no new `credit_event` type. Amounts are integer + branded (`asCredits`,
 * ADR-0007/0212). Runs as `admin_write`; base `credits` stays free of operator concerns.
 */
export async function adjustCreditsAdmin(
  deps: AdminMutationDeps,
  input: AdjustCreditsInput,
): Promise<CreditAdjustResult> {
  const result = await withAdminWrite(deps.db, async (tx) => {
    const balanceBefore = await balance(tx, input.targetAccountId);
    const idempotencyKey = randomUUID();
    let balanceAfter = balanceBefore;
    let applied = 0;
    if (input.deltaCredits > 0) {
      const r = await grant(tx, {
        accountId: input.targetAccountId,
        eventType: "feature_grant",
        feature: "admin_adjust",
        amount: asCredits(input.deltaCredits),
        idempotencyKey,
      });
      balanceAfter = r.balance;
      applied = input.deltaCredits;
    } else {
      // Clamp the debit to the balance under a row lock so it can never underflow the wallet.
      const locked = await tx.query<{ balance: number }>(
        `SELECT balance FROM credit_wallet WHERE account_id = $1 FOR UPDATE`,
        [input.targetAccountId],
      );
      const current = locked.rows[0]?.balance ?? 0;
      const clamped = Math.min(-input.deltaCredits, current);
      if (clamped > 0) {
        const r = await debit(tx, {
          accountId: input.targetAccountId,
          eventType: "feature_debit",
          feature: "admin_adjust",
          amount: asCredits(clamped),
          idempotencyKey,
        });
        balanceAfter = r.balance;
        applied = -clamped;
      } else {
        balanceAfter = current;
        applied = 0;
      }
    }
    await insertAdminActionLog(tx, {
      actorEmail: input.actorEmail,
      targetAccountId: input.targetAccountId,
      action: "credit_adjust",
      before: { balance: balanceBefore },
      after: { balance: balanceAfter, applied, reason: input.reason },
    });
    return { balanceBefore, balanceAfter, applied };
  });
  await appendWorm(
    deps,
    input.targetAccountId,
    "credit_adjust",
    input.actorEmail,
    { balance: result.balanceBefore },
    {
      balance: result.balanceAfter,
      applied: result.applied,
      reason: input.reason,
    },
  );
  return { targetAccountId: input.targetAccountId, ...result };
}

export interface ReissueResult {
  targetAccountId: string;
  major: number;
  licenseId: string;
  token: string;
}

/**
 * Action 4 — reissue a license: re-serve the buyer's EXISTING token for (accountId, major) via the
 * injected admin-scoped `/issue` proxy (Fork AM-5). No DB mutation of its own; the proxy's `/issue`
 * persists idempotently. Dual-logged like the others (before = the prior licenseId if known, after =
 * the re-served one). The bearer never leaves the proxy; this returns only `{ token, licenseId }`.
 */
export async function reissueLicenseAdmin(
  deps: AdminMutationDeps,
  input: ReissueLicenseInput,
): Promise<ReissueResult> {
  const reissued = await deps.issue({
    accountId: input.targetAccountId,
    tier: input.tier,
    major: input.major,
    expiry: input.expiry,
  });
  // Log AFTER the proxy succeeds — a failed reissue (proxy throws) writes no audit rows.
  await withAdminWrite(deps.db, (tx) =>
    insertAdminActionLog(tx, {
      actorEmail: input.actorEmail,
      targetAccountId: input.targetAccountId,
      action: "license_reissue",
      before: { major: input.major },
      after: { major: input.major, licenseId: reissued.licenseId },
    }),
  );
  await appendWorm(
    deps,
    input.targetAccountId,
    "license_reissue",
    input.actorEmail,
    { major: input.major },
    { major: input.major, licenseId: reissued.licenseId },
  );
  return {
    targetAccountId: input.targetAccountId,
    major: input.major,
    licenseId: reissued.licenseId,
    token: reissued.token,
  };
}
