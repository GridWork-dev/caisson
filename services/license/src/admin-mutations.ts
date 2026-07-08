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
//
// Id-space note: a real Caisson platform account id is a 32-char [A-Za-z0-9] better-auth id (and
// `accountId == userId` for the personal account, ADR-0176) — NOT a UUID. `@caisson/audit-worm`'s
// `buildArtifactKey`/`assertSafeKey` enforce a UUID first key segment, so the WORM anchor tenant
// segment is DERIVED from the account id via `wormAnchorAccount` below (audit-worm stays unchanged);
// the RAW account id is preserved inside the logged WORM payload, so auditability is not lost.
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuditChainStore } from "@caisson/audit-worm";
import {
  balance,
  clawback,
  debit,
  grant,
  outstandingClaw,
  sweepExpiredGrants,
} from "@caisson/credits";
import {
  asCredits,
  NotFoundError,
  ValidationError,
  type JsonValue,
} from "@caisson/kernel";
import {
  buildAdminSelectPolicySql,
  buildAdminWritePolicySql,
  withAdminWrite,
} from "@caisson/org-controls";
import {
  expandEntitlements,
  type RegistryIndex,
} from "@caisson/registry-schema";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";
import { insertAdminActionLog, type AdminAction } from "./admin-audit-log.ts";
import {
  acquireAccountBillingLock,
  grantAdminComp,
  readEntitlements,
  reconcileCoverageGrants,
  revokeAdminComp,
  revokePurchaseGrants,
} from "./entitlement-store.ts";
import {
  readDenySet,
  recordLicenseRevocations,
} from "./license-revocation-store.ts";

// The `admin_write` cross-tenant policies for every table the mutation surface touches: WRITE
// policies for the tables it actually mutates — `entitlement_grant` (service-owned) + the BASE
// credit tables `credit_wallet` / `credit_event` — and SELECT-only policies for the tables it only
// ever READS (`account_member` for the existence check; `license_grant` for the ADR-0225
// edge-deny-set read). Applied EXTERNALLY — after the `admin_write` role exists — at DEPLOY (and in
// the test/dev double), NEVER embedded in a schema constant every buyer-path test applies (mirroring
// how ADR-0141's `buildAdminReadPolicySql` is applied outside the owning packages). Keeping the credit
// policies here also leaves base `@caisson/credits` untouched (Fork AM-3 — no money-core schema
// change). Run once per DEPLOY.
export const ADMIN_MUTATION_PROVISION_SQL = [
  buildAdminWritePolicySql("entitlement_grant"),
  buildAdminWritePolicySql("credit_wallet"),
  buildAdminWritePolicySql("credit_event"),
  // ADR-0252: `debit()` now materializes FIFO consumption — the admin negative-adjust path writes
  // `grant_consumption` rows through the same money core, so admin_write needs the write policy on
  // the join table too. Re-run this provisioning at DEPLOY after the 0015 migration lands.
  buildAdminWritePolicySql("grant_consumption"),
  // Read-only existence check: `account_member` is the base @caisson/auth table, always
  // carrying at least one row per real account (`ensurePersonalAccount` on first sign-in, ADR-0176) —
  // admin_write needs cross-tenant SELECT on it to reject a comp/adjust to a nonexistent id. This
  // mutation surface never writes account_member, so it gets the SELECT-only policy variant, not
  // the INSERT/UPDATE write grant every table it actually mutates carries.
  buildAdminSelectPolicySql("account_member"),
  // Read-only edge-deny-set source (ADR-0225 Fork R-4 = B): `revokePurchaseAdmin` reads the target
  // account's `license_grant` rows cross-tenant to learn which signed `license_id`s to deny at the
  // edge. It NEVER writes license_grant (the reissue proxy persists it), so it gets the SELECT-only
  // variant — the paid-revoke blast radius stops at a cross-tenant read of the license index.
  buildAdminSelectPolicySql("license_grant"),
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
  /**
   * The built registry index (ADR-0071/0278 F1) — the SAME membership truth
   * `expandEntitlements`/`resolveAccountEntitlements` read at every entitlement expansion. The
   * comp-grant boundary (`grantEntitlementAdmin`) validates every operator-supplied id against it
   * BEFORE writing a row: `expandEntitlements` is fail-closed-THROWS on an unknown purchased id, so
   * an un-vetted typo written to `entitlement_grant` would brick every future `/issue` and dashboard
   * read for the WHOLE target account (TM-E, account-wide — not just the bad id). Loaded the same
   * way `services/license/src/server.ts` loads it for `/issue`'s own pre-sign validation.
   */
  index: RegistryIndex;
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
  /**
   * Publish the FULL current edge deny-set to the artifact the registry Worker reads (ADR-0225
   * R-4 = B) — the WRITE side of `deploy-entry.ts`'s R2 read. Called POST-COMMIT + BEST-EFFORT by
   * `revokePurchaseAdmin` after a `revokeEdgeAccess` revoke, with every revoked `license_id` across
   * all tenants (republish-whole, not delta). Injected (prod: an R2-object writer; tests: a double),
   * so this module holds no bucket credential. OPTIONAL — absent = the edge publisher is not yet
   * provisioned (operator-gated DEPLOY): the publish is reported `"skipped"`, the DB
   * `license_revocation` table stays the truth, and the Worker fails OPEN, so installs never break.
   * The caller CATCHES a throw and surfaces it as `"failed"` — it NEVER rethrows, because the revoke
   * + the DB deny-set already committed and a retry would double-apply the money/entitlement change.
   */
  publishDenySet?: ((revokedLicenseIds: string[]) => Promise<void>) | undefined;
}

// The real platform account-id shape (better-auth 32-char [A-Za-z0-9], ADR-0176) — NOT a UUID.
// Trimmed, bounded 1..256, and no whitespace/control chars (a WORM key segment must be clean). We
// validate the REAL id shape here, not a pretend UUID; the UUID is derived downstream.
const accountId = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine(
    // eslint-disable-next-line no-control-regex -- reject C0/C1 control chars + any whitespace (hyphens stay legal, so UUIDs pass).
    (s) => !/[\u0000-\u001f\u007f-\u009f\s]/.test(s),
    "account id has whitespace or control characters",
  );

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map an operator-supplied account id onto the UUID-shaped tenant segment the WORM artifact-key
 * contract requires (`@caisson/audit-worm` `buildArtifactKey`/`assertSafeKey` enforce `UUID_RE` on
 * the first key segment, ADR-0054) — WITHOUT changing that package. Real account ids are 32-char
 * better-auth ids (ADR-0176), not UUIDs, so we deterministically derive a stable RFC-4122-shaped
 * UUID: SHA-256 of the id, first 16 bytes, with the version nibble set to 8 (RFC-9562 v8, custom /
 * hash-derived) and the RFC-4122 variant nibble set. An id that is ALREADY a UUID passes through
 * unchanged (back-compat). The mapping is 1:1 in practice (SHA-256 collision-resistant); the RAW
 * account id is always stored inside the logged WORM payload (`targetAccountId`), so remapping the
 * KEY loses no auditability. Deterministic + pure, so the same account always anchors the same chain.
 */
export function wormAnchorAccount(id: string): string {
  if (UUID_RE.test(id)) return id.toLowerCase();
  const hex = createHash("sha256").update(id).digest("hex");
  // Force RFC-4122 well-formedness on two nibbles (UUID_RE would accept the raw hex either way):
  // hex[12] := version 8; hex[16] := variant (top two bits 10 → one of 8/9/a/b).
  const variant = (
    (Number.parseInt(hex.slice(16, 17), 16) & 0x3) |
    0x8
  ).toString(16);
  const raw =
    hex.slice(0, 12) + "8" + hex.slice(13, 16) + variant + hex.slice(17, 32);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`;
}

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
    // Bounded to ±1e8 so it can never overflow the int4 `amount` column (int4 tops out ~2.1e9); the
    // positive branch passes the delta straight to `grant`, so an unbounded value would 500 late.
    deltaCredits: z
      .number()
      .int()
      .min(-100_000_000)
      .max(100_000_000)
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

// ADR-0225 (Fork R-2/R-3 = A). The v2 paid-revoke boundary: the operator targets ONE one-time
// purchase (R-2 source-scoped) by its `purchaseId` (the PaymentIntent / Paddle transaction id).
// Subscriptions are NOT revocable in v2 (R-3): there is deliberately no subscription-id field — a
// still-billing subscription's grants are re-created next `invoice.paid`, so the correct lever is
// cancelling it in Paddle. Both effects are explicit per-action operator choices (default ON in the
// UI): `clawUnspentCredits` (R-1 = A — claw the purchase's still-outstanding credits, NEVER refund via
// Paddle) and `revokeEdgeAccess` (R-4 = B — write the edge deny-set so the buyer's offline license is
// killed at the registry Worker). `reason` is the WORM-evidence "why" for a chargeback dispute.
export const RevokePurchaseBody = z
  .object({
    targetAccountId: accountId,
    purchaseId: z.string().trim().min(1).max(256),
    clawUnspentCredits: z.boolean(),
    revokeEdgeAccess: z.boolean(),
    reason: z.string().trim().min(1).max(500).optional(),
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
export type PurchaseRevokeInput = z.infer<typeof RevokePurchaseBody> & {
  actorEmail: string;
};

/**
 * The tamper-evident WORM half's outcome. `"ok"` = anchored; `"failed"` = the mutation + the
 * queryable `admin_action_log` row already COMMITTED (an earlier, separate tx) but the post-commit
 * WORM append threw. That distinction is load-bearing: the caller must surface `"failed"` as a
 * DO-NOT-RETRY result, never a generic mutation failure — a retry would double-apply the money /
 * entitlement change. The action is still queryable in `admin_action_log`; re-anchor out of band.
 */
export type WormStatus = "ok" | "failed";

/**
 * The edge deny-set publish outcome (ADR-0225 R-4 = B), decided POST-COMMIT + best-effort:
 *   - `"skipped"` — no edge revoke was requested (`revokeEdgeAccess` off) OR no publisher is
 *     provisioned yet (operator-gated DEPLOY). The DB `license_revocation` table is the sole truth
 *     and the Worker fails OPEN (nothing denied at the edge) — safe, not broken.
 *   - `"ok"` — the FULL deny-set was republished to the Worker's artifact.
 *   - `"failed"` — the publisher threw. The revoke + DB deny-set are ALREADY durable, so this is a
 *     DO-NOT-RETRY signal (re-publish the artifact out of band); it is NOT a mutation failure.
 */
export type EdgePublishStatus = "ok" | "failed" | "skipped";

/** Append the tamper-evident WORM half AFTER the mutation+log tx commits (both are separate roles).
 *  A mutation that throws never reaches here → neither half is written (Fork AM-4 atomicity). The
 *  anchor's tenant segment is the DERIVED UUID (`wormAnchorAccount`) — the audit-worm key contract
 *  requires a UUID and real account ids are not — while the RAW `targetAccountId` rides the payload.
 *  A post-commit failure is CAUGHT and returned as `"failed"`, never rethrown: the state change is
 *  already durable, so throwing here would read as a retryable mutation failure (the double-apply). */
async function appendWorm(
  deps: AdminMutationDeps,
  targetAccountId: string,
  action: AdminAction,
  actorEmail: string,
  before: JsonValue,
  after: JsonValue,
): Promise<WormStatus> {
  try {
    await deps.worm.append(wormAnchorAccount(targetAccountId), {
      source: "admin_action",
      action,
      actorEmail,
      targetAccountId,
      before,
      after,
      at: new Date().toISOString(),
    });
    return "ok";
  } catch {
    return "failed";
  }
}

/**
 * Fail closed on a nonexistent target account (CAISSON-9). `account_member` always carries at least
 * one row for a real account (the personal `account_id == user_id` row `ensurePersonalAccount` writes
 * at first sign-in, ADR-0176) — an id with no row is a typo or an account that never signed up. Runs
 * INSIDE the caller's `withAdminWrite` transaction, so the thrown `NotFoundError` rolls back the WHOLE
 * mutation before any entitlement/credit row is written — never a ghost grant to nobody.
 */
async function assertAccountExists(
  tx: TenantExecutor,
  accountId: string,
): Promise<void> {
  const r = await tx.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM account_member WHERE account_id = $1) AS exists`,
    [accountId],
  );
  if (r.rows[0]?.exists !== true) {
    throw new NotFoundError("target account does not exist", {
      targetAccountId: accountId,
    });
  }
}

/**
 * Fail closed on an entitlement id the comp-grant boundary cannot resolve (ADR-0278 F1). Reuses
 * `expandEntitlements` itself, one id at a time, rather than a hand-maintained allowlist: the
 * accepted set is always exactly what the index/alias/reserved-id truth would later resolve — a
 * bundle id (`isBundleId`), an indexed module (`@caisson/<slug>` or the bare slug), a reserved
 * sold-not-yet-published slug (`RESERVED_MODULE_ENTITLEMENT_IDS`), or a legacy alias that
 * `normalizeEntitlementId` maps to one of those — with zero risk of drifting from the expansion it
 * gates, because it IS that expansion. Runs BEFORE `withAdminWrite` opens, so a bad id never reaches
 * the transaction (never even a rolled-back write attempt) and the error names the offending id.
 */
const UNKNOWN_ENTITLEMENT_ID_PREFIX = "unknown purchased entitlement id";

function assertGrantableEntitlementIds(
  index: RegistryIndex,
  entitlementIds: readonly string[],
): void {
  for (const id of entitlementIds) {
    try {
      expandEntitlements(index, [id]);
    } catch (err) {
      // ADR-0278 I-2: only expandEntitlements' OWN fail-closed rejection (TM-E, the message this
      // module throws for an id that is not a bundle/module/reserved/alias) is the expected "bad
      // operator input" case — map it to a clean 400 naming the id. Anything else (a malformed/
      // corrupt built index, e.g. `latestManifest`'s "carries no versions") is an INDEX-INTEGRITY
      // bug, not an operator typo; re-throw it as-is so it surfaces honestly instead of being
      // mislabeled "unknown entitlement id" and hiding the real failure.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.startsWith(UNKNOWN_ENTITLEMENT_ID_PREFIX)) throw err;
      throw new ValidationError(`unknown entitlement id: ${id}`, {
        entitlementId: id,
      });
    }
  }
}

export interface EntitlementMutationResult {
  targetAccountId: string;
  before: string[];
  after: string[];
  changed: number;
  /** WORM audit half's outcome — `"failed"` means DO-NOT-RETRY (the mutation already committed). */
  worm: WormStatus;
}

/** Action 1 — comp a set of entitlements to one account (source_kind `admin_comp`). */
export async function grantEntitlementAdmin(
  deps: AdminMutationDeps,
  input: GrantEntitlementInput,
): Promise<EntitlementMutationResult> {
  // Reject an unresolvable id BEFORE the transaction opens (ADR-0278 F1) — never write a grant that
  // would fail-closed-throw the target account's ENTIRE entitlement expansion on its next read.
  assertGrantableEntitlementIds(deps.index, input.entitlementIds);
  const result = await withAdminWrite(deps.db, async (tx) => {
    await assertAccountExists(tx, input.targetAccountId);
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
  const worm = await appendWorm(
    deps,
    input.targetAccountId,
    "entitlement_grant",
    input.actorEmail,
    { entitlements: result.before },
    { entitlements: result.after },
  );
  return { targetAccountId: input.targetAccountId, ...result, worm };
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
  const worm = await appendWorm(
    deps,
    input.targetAccountId,
    "entitlement_revoke",
    input.actorEmail,
    { entitlements: result.before },
    { entitlements: result.after },
  );
  return { targetAccountId: input.targetAccountId, ...result, worm };
}

export interface CreditAdjustResult {
  targetAccountId: string;
  balanceBefore: number;
  balanceAfter: number;
  /** Credits actually applied — for a negative adjust this is clamped to the prior balance. */
  applied: number;
  /** WORM audit half's outcome — `"failed"` means DO-NOT-RETRY (the wallet change already committed). */
  worm: WormStatus;
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
    await assertAccountExists(tx, input.targetAccountId);
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
      // Burn any expired-grant residue FIRST (idempotent, per-grant `expiry:<id>` keys): after the
      // sweep the wallet aggregate equals the unexpired-spendable total, so the clamp below can
      // never exceed what `debit`'s FIFO floor will cover (an unswept residue would otherwise make
      // the whole adjustment throw fail-closed on an amount the aggregate said was available).
      await sweepExpiredGrants(tx, input.targetAccountId);
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
  const worm = await appendWorm(
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
  return { targetAccountId: input.targetAccountId, ...result, worm };
}

export interface ReissueResult {
  targetAccountId: string;
  major: number;
  licenseId: string;
  token: string;
  /** WORM audit half's outcome — `"failed"` means DO-NOT-RETRY (the reissue + log already committed). */
  worm: WormStatus;
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
  const worm = await appendWorm(
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
    worm,
  };
}

export interface PurchaseRevokeResult {
  targetAccountId: string;
  purchaseId: string;
  /** ACTIVE entitlements before the revoke. */
  before: string[];
  /** ACTIVE entitlements after — an entitlement backed by a SIBLING source (refcount) survives. */
  after: string[];
  /** Grant rows soft-revoked by this purchase's revoke (0 on an idempotent re-run — never an error). */
  revoked: number;
  /** Credits actually reclaimed — bounded to `granted − alreadyClawed` AND to the wallet balance; 0
   *  when `clawUnspentCredits` was off, the buyer already spent them, or a prior claw netted it out. */
  clawedBack: number;
  balanceBefore: number;
  balanceAfter: number;
  /** The license ids added to the edge deny-set for THIS account (ADR-0225 R-4); `[]` when
   *  `revokeEdgeAccess` was off. The whole cross-tenant set — not just these — is what gets published. */
  deniedLicenseIds: string[];
  /** Edge deny-set publish outcome (ADR-0225 R-4 = B) — see `EdgePublishStatus`. `"skipped"` when no
   *  edge revoke was requested or the publisher is unprovisioned; the DB stays the truth either way. */
  edgePublish: EdgePublishStatus;
  /** WORM audit half's outcome — `"failed"` means DO-NOT-RETRY (the revoke + log already committed). */
  worm: WormStatus;
}

/**
 * Action 5 (ADR-0225) — revoke a REAL paid ONE-TIME purchase: the fraud / chargeback-received /
 * ToS-ban lever that strips access WITHOUT a Paddle refund (Fork R-1 = A: DB-only, never calls
 * Paddle). One `withAdminWrite` transaction ties four effects together atomically:
 *
 *   1. `assertAccountExists` (CAISSON-9) — a nonexistent target rolls the whole tx back, no ghost rows.
 *   2. `revokePurchaseGrants` (R-2/R-3 = A) — soft-revoke every ACTIVE grant backed by this ONE-TIME
 *      purchase, and ONLY it. A subscription grant (source_kind='subscription') can never match a
 *      `purchase_id` filter, so subscriptions are structurally un-revocable here (R-3 = A), and an
 *      entitlement a SIBLING source still backs survives (refcount). Idempotent: a re-run finds no
 *      active rows and revokes 0 — NOT an error (so the caller must not treat 0 as a rejection).
 *   3. Bounded claw (R-1 = A, opt-in via `clawUnspentCredits`) — `outstandingClaw` computes
 *      `max(0, granted − alreadyClawed)` UNDER an account+purchase advisory lock, then
 *      `clawback` further bounds to the wallet balance and never goes negative. This is the EXACT
 *      arithmetic the full-refund webhook runs (apply-billing-event.ts) keyed on the SAME
 *      `sourceEventId = purchaseId`, so an operator revoke and a later Paddle refund of the same
 *      purchase are mutually idempotent — whichever lands second reads `remaining = 0` (and its
 *      compensating debit collides on the (paymentId, refund_clawback) idempotency index) → claws 0.
 *      The SAME lock also closes the race against a DIFFERENTLY-keyed concurrent claw on this
 *      purchase (e.g. the refund webhook's per-line branch, `${adjustmentId}:${itemId}` keys the
 *      unique index does not dedupe against this action's key) — without it, two racing readers can
 *      each see a stale `alreadyClawed=0` and the second's clamp-to-balance write can drain an
 *      UNRELATED purchase's unspent credits out of the same fungible wallet. Netting out
 *      `alreadyClawed` (not the raw `granted`) is load-bearing: the wallet is a fungible pool, so
 *      clawing the raw grant after a prior partial claw would drain OTHER purchases' credits
 *      (CAISSON-5).
 *   4. Edge deny-set truth (R-4 = B, opt-in via `revokeEdgeAccess`) — `recordLicenseRevocations`
 *      writes one `license_revocation` row per license the account holds, in the SAME transaction, so
 *      the DB truth commits atomically with the revoke. Publishing it to the Worker's artifact is a
 *      separate, fail-open slice (not here).
 *
 * Dual-logged like every ADR-0220 action: one `admin_action_log` row IN the tx (the action id is
 * pinned up front so the `license_revocation` rows can FK-by-value to it), THEN a post-commit WORM
 * chain entry whose outcome is surfaced as `worm` (`"failed"` = DO-NOT-RETRY, the mutation already
 * committed). A revoke that throws writes NEITHER log (atomicity).
 */
export async function revokePurchaseAdmin(
  deps: AdminMutationDeps,
  input: PurchaseRevokeInput,
): Promise<PurchaseRevokeResult> {
  // The FULL cross-tenant deny-set as of THIS revoke's commit, captured inside the tx and published
  // post-commit (below). Assigned from the closure so the atomic post-revoke truth escapes.
  let fullDenySet: string[] = [];
  const result = await withAdminWrite(deps.db, async (tx) => {
    await assertAccountExists(tx, input.targetAccountId);
    // Canonical lock order (see acquireAccountBillingLock): account billing lock FIRST, before
    // the row revokes and the claw lock — this path previously took coverage (inside the
    // reconcile) then claw, the reverse of the per-line refund branch: an ABBA deadlock when an
    // operator revoke raced a refund adjustment for the same purchase.
    await acquireAccountBillingLock(tx, input.targetAccountId);
    const before = await readEntitlements(tx, input.targetAccountId);
    const balanceBefore = await balance(tx, input.targetAccountId);

    // R-2/R-3 = A: source-scoped, one-time-only. A subscription's grants never match a purchase_id.
    const revoked = await revokePurchaseGrants(tx, {
      accountId: input.targetAccountId,
      purchaseId: input.purchaseId,
    });
    // ADR-0269 coverage reconcile (audit P1 1, same sweep as the refund webhook): an operator
    // revoke must also fell any coverage MIRROR the revoked purchase was backing — scoped to
    // `line_item_id='covered'` rows only, so R-3's "subscriptions are structurally un-revocable
    // here" still holds for every STATIC subscription grant.
    await reconcileCoverageGrants(tx, input.targetAccountId);

    // R-1 = A: claw the purchase's STILL-OUTSTANDING credits, bounded two ways, never Paddle.
    let clawedBack = 0;
    if (input.clawUnspentCredits) {
      const remaining = await outstandingClaw(
        tx,
        input.targetAccountId,
        input.purchaseId,
      );
      if (remaining > 0) {
        const clawed = await clawback(tx, {
          accountId: input.targetAccountId,
          amount: remaining, // clawback further bounds to balance (never negative)
          sourceEventId: input.purchaseId, // idempotent with the full-refund webhook's same-key claw
        });
        clawedBack = clawed.clawedBack;
      }
    }

    // Pin the action id up front so the R-4 deny-set rows FK-by-value to this exact audit event.
    const adminActionId = randomUUID();

    // R-4 = B: write the edge deny-set truth in the SAME transaction (opt-in).
    // ponytail: the edge deny is ACCOUNT-scoped (every held license_id) and runs whenever
    // `revokeEdgeAccess` is on — even when this `purchaseId` matched 0 grants. A mistyped purchaseId
    // against the RIGHT account therefore still denies that account's licenses at the edge. That is
    // the deliberate R-4 = B posture (kill the fraud/ToS account's edge access, not one purchase's):
    // gating on `revoked > 0` would instead break a legitimate idempotent re-run. The mandatory
    // impact preview + type-to-confirm (Fork R-6) are the guard against a mis-targeted deny; the
    // per-action checkbox keeps it an explicit choice.
    let deniedLicenseIds: string[] = [];
    if (input.revokeEdgeAccess) {
      deniedLicenseIds = await recordLicenseRevocations(tx, {
        accountId: input.targetAccountId,
        adminActionId,
        reason: input.reason ?? null,
      });
      // The whole cross-tenant set (not just this account's) — republish-whole is what the Worker's
      // artifact carries, so publishing only `deniedLicenseIds` would wipe every prior revoke's denials.
      fullDenySet = await readDenySet(tx);
    }

    const after = await readEntitlements(tx, input.targetAccountId);
    const balanceAfter = await balance(tx, input.targetAccountId);
    await insertAdminActionLog(tx, {
      id: adminActionId,
      actorEmail: input.actorEmail,
      targetAccountId: input.targetAccountId,
      action: "purchase_revoke",
      before: { entitlements: before, balance: balanceBefore },
      after: {
        entitlements: after,
        balance: balanceAfter,
        purchaseId: input.purchaseId,
        revoked,
        clawedBack,
        deniedLicenseIds,
        reason: input.reason ?? null,
      },
    });
    return {
      before,
      after,
      revoked,
      clawedBack,
      balanceBefore,
      balanceAfter,
      deniedLicenseIds,
    };
  });
  const worm = await appendWorm(
    deps,
    input.targetAccountId,
    "purchase_revoke",
    input.actorEmail,
    { entitlements: result.before, balance: result.balanceBefore },
    {
      entitlements: result.after,
      balance: result.balanceAfter,
      purchaseId: input.purchaseId,
      revoked: result.revoked,
      clawedBack: result.clawedBack,
      deniedLicenseIds: result.deniedLicenseIds,
      reason: input.reason ?? null,
    },
  );

  // R-4 = B edge publish — POST-COMMIT + BEST-EFFORT. The revoke + the DB `license_revocation` truth
  // already committed; republishing the FULL set to the Worker's artifact is what finally cuts a held
  // offline token's edge access. `"skipped"` when no edge revoke was asked for OR no publisher is
  // provisioned (operator-gated DEPLOY — the Worker fails open, so the absence is safe, not broken).
  // A publisher throw is CAUGHT → `"failed"` (do-not-retry: the mutation is durable), never rethrown.
  let edgePublish: EdgePublishStatus = "skipped";
  if (input.revokeEdgeAccess && deps.publishDenySet !== undefined) {
    try {
      await deps.publishDenySet(fullDenySet);
      edgePublish = "ok";
    } catch {
      edgePublish = "failed";
    }
  }

  return {
    targetAccountId: input.targetAccountId,
    purchaseId: input.purchaseId,
    ...result,
    edgePublish,
    worm,
  };
}
