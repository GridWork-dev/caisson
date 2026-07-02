// src/impersonation/session.ts — the support-impersonation kernel with dual audit trail (ADR-0187).
//
// Support staff acting on behalf of a tenant is the recurring enterprise ask; SOC2/HIPAA auditors
// want a PROVABLE dual trail — who the acting operator was AND whose data they touched, recorded on
// both sides. Every lifecycle step (begin / recorded action / end) appends TWO linked records to the
// TARGET tenant's existing audit chain (`AuditChainStore`, ADR-0052) — the operator-identity record,
// then the acting-as-tenant record, linked by `sessionId` — so `verifyChain` covers the trail and a
// dropped/patched record is tamper-evident, never a plain log.
//
// Three load-bearing boundaries:
//   1. FAIL-CLOSED ENTRY — the begin input is a Zod `.strict()` boundary: a reason under 8 chars
//      (auditors reject empty justification) or a TTL of 0 / over 8h is refused BEFORE any I/O.
//      8h is one support shift — an "until someone remembers" session is exactly what the dual
//      trail exists to forbid.
//   2. SCOPE, NEVER ROLE (ADR-0005) — impersonated data access runs through
//      `withTenant(targetAccountId)`: the GUC/RLS boundary still gates every row. `withImpersonation`
//      only re-checks the session (unexpired, unended, present in the target's OWN
//      `impersonation_session` table) and then opens the ordinary tenant scope.
//   3. TORN-BEGIN SEMANTICS — the session row lands first (its own `withTenant` transaction), THEN
//      the dual records append. `chain.append` opens its OWN tenant transaction (advisory lock +
//      WORM anchor put), so it can NOT run nested inside ours — two `db.transaction`s on one PGlite/
//      pool connection deadlock or interleave. A failed append after the insert therefore SURFACES
//      (the caller sees the throw) and leaves a session row with a missing dual pair — precisely the
//      deficiency the impersonation evidence collector flags. Fail-visible, never fail-silent.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AuthzError,
  ConflictError,
  parseStrict,
  strictObject,
  type AuditChainEntry,
  type JsonValue,
} from "@caisson/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";

/** The chain-payload discriminator for the operator-identity side of a dual pair. */
export const IMPERSONATION_OPERATOR_RECORD = "impersonation.operator";
/** The chain-payload discriminator for the acting-as-tenant side of a dual pair. */
export const IMPERSONATION_TENANT_RECORD = "impersonation.tenant";

/** TTL ceiling: one support shift (8h). An unbounded session defeats the audit story outright. */
export const MAX_IMPERSONATION_TTL_MS = 8 * 60 * 60 * 1000;

/** Fail-closed begin boundary (ADR-0187): reason-required (min 8 — auditors reject empty
 *  justification), TTL strictly positive and shift-bounded, target account a UUID. */
export const beginImpersonationSchema = strictObject({
  operatorId: z.string().trim().min(1).max(256),
  operatorEmail: z.string().trim().email().max(320).optional(),
  targetAccountId: z.string().uuid(),
  reason: z.string().trim().min(8).max(2000),
  ttlMs: z.number().int().positive().max(MAX_IMPERSONATION_TTL_MS),
});

export type BeginImpersonationInput = z.input<typeof beginImpersonationSchema>;

/** Bounded action label recorded with each impersonated action's dual pair. */
const actionSchema = z.string().trim().min(1).max(256);

/** The one seam this kernel needs from the audit chain — structurally satisfied by the real
 *  `AuditChainStore` (ADR-0052). Kept as a port so this module (and its unit tests) never hard-bind
 *  the WORM store wiring; `append` manages its OWN tenant scope + transaction. */
export interface ImpersonationChainStore {
  append(
    accountId: string,
    payload: JsonValue,
  ): Promise<{ readonly entry: AuditChainEntry }>;
}

export interface ImpersonationDeps {
  /** The tenant DB (the same `Transactor` every compliance seam uses). */
  readonly db: Transactor;
  /** The TARGET tenant's audit chain — the dual records land here (ADR-0052). */
  readonly chain: ImpersonationChainStore;
  /** Clock injected at the edge (determinism — goldens). Default: wall clock. */
  readonly now?: () => Date;
  /** Session-id source injected at the edge (determinism — goldens). Default: `randomUUID`. */
  readonly newId?: () => string;
}

/** A live impersonation session as returned by `beginImpersonation`. */
export interface ImpersonationSession {
  readonly id: string;
  readonly targetAccountId: string;
  readonly operatorId: string;
  readonly reason: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
}

/** The closed session `endImpersonation` returns. */
export interface EndedImpersonationSession extends ImpersonationSession {
  readonly endedAt: Date;
}

/** The chain seqs of one appended dual pair (operator record first, then tenant record). */
export interface DualRecordSeqs {
  readonly operatorSeq: number;
  readonly tenantSeq: number;
}

function nowOf(deps: ImpersonationDeps): Date {
  return deps.now?.() ?? new Date();
}

/**
 * Append the dual pair for one lifecycle step — DETERMINISTIC ORDER: the operator-identity record,
 * then the acting-as-tenant record, both linked by `sessionId`. Runs OUTSIDE any caller transaction
 * (see the torn-begin header note): a failure between the two leaves a lone operator record, which
 * the evidence collector flags as a missing tenant-side record.
 */
async function appendDual(
  deps: ImpersonationDeps,
  session: ImpersonationSession,
  action: string,
): Promise<DualRecordSeqs> {
  const operator = await deps.chain.append(session.targetAccountId, {
    kind: IMPERSONATION_OPERATOR_RECORD,
    sessionId: session.id,
    operatorId: session.operatorId,
    action,
    reason: session.reason,
    expiresAt: session.expiresAt.toISOString(),
  });
  const tenant = await deps.chain.append(session.targetAccountId, {
    kind: IMPERSONATION_TENANT_RECORD,
    sessionId: session.id,
    targetAccountId: session.targetAccountId,
    action,
  });
  return { operatorSeq: operator.entry.seq, tenantSeq: tenant.entry.seq };
}

/**
 * Fail-closed liveness gate, evaluated against the DB row (the source of truth — the session object
 * a caller holds could be stale or forged). Comparison runs IN SQL against the injected `now`, so
 * there is no Date-parsing ambiguity across drivers. No row / ended / expired → `AuthzError`.
 */
async function requireActive(
  tx: TenantExecutor,
  sessionId: string,
  now: Date,
): Promise<void> {
  const res = await tx.query<{ ended: boolean; expired: boolean }>(
    `SELECT (ended_at IS NOT NULL) AS ended, (expires_at < $2::timestamptz) AS expired
       FROM impersonation_session
      WHERE id = $1`,
    [sessionId, now.toISOString()],
  );
  const row = res.rows[0];
  if (row === undefined) {
    throw new AuthzError(
      "impersonation session not found in the target tenant scope",
      { sessionId },
    );
  }
  if (row.ended) {
    throw new AuthzError("impersonation session has ended", { sessionId });
  }
  if (row.expired) {
    throw new AuthzError("impersonation session has expired", { sessionId });
  }
}

/**
 * Begin a time-bounded, reason-required impersonation session against `targetAccountId`: validate
 * fail-closed, INSERT the session row under the target's OWN tenant scope, then append the
 * `session.begin` dual pair to the target's chain. See the header for the torn-begin semantics —
 * an append failure after the insert surfaces and leaves an evidence-flagged partial trail.
 */
export async function beginImpersonation(
  deps: ImpersonationDeps,
  input: BeginImpersonationInput,
): Promise<ImpersonationSession> {
  const parsed = parseStrict(beginImpersonationSchema, input);
  const startedAt = nowOf(deps);
  const expiresAt = new Date(startedAt.getTime() + parsed.ttlMs);
  const id = (deps.newId ?? randomUUID)();

  await withTenant(deps.db, parsed.targetAccountId, async (tx) => {
    await tx.query(
      `INSERT INTO impersonation_session
         (id, account_id, operator_id, operator_email, reason, started_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        parsed.targetAccountId,
        parsed.operatorId,
        parsed.operatorEmail ?? null,
        parsed.reason,
        startedAt.toISOString(),
        expiresAt.toISOString(),
      ],
    );
  });

  const session: ImpersonationSession = {
    id,
    targetAccountId: parsed.targetAccountId,
    operatorId: parsed.operatorId,
    reason: parsed.reason,
    startedAt,
    expiresAt,
  };
  await appendDual(deps, session, "session.begin");
  return session;
}

/**
 * Record one impersonated action: refuse (AuthzError, fail-closed) when the session is expired,
 * ended, or unknown, then append the action's dual pair.
 */
export async function recordImpersonatedAction(
  deps: ImpersonationDeps,
  session: ImpersonationSession,
  action: string,
): Promise<DualRecordSeqs> {
  const parsedAction = parseStrict(actionSchema, action);
  const now = nowOf(deps);
  await withTenant(deps.db, session.targetAccountId, (tx) =>
    requireActive(tx, session.id, now),
  );
  return appendDual(deps, session, parsedAction);
}

/**
 * End the session: set `ended_at` (the ONLY app-updatable column — the migration's column-scoped
 * GRANT makes begin/end the whole write surface, no history rewrite), then append the `session.end`
 * dual pair. Ending an already-ended (or unknown) session refuses with `ConflictError` — end is a
 * one-shot state transition, not an idempotent no-op, so a double-end bug stays visible. Ending an
 * EXPIRED-but-unended session is allowed: closing the record is hygiene, not access.
 */
export async function endImpersonation(
  deps: ImpersonationDeps,
  session: ImpersonationSession,
): Promise<EndedImpersonationSession> {
  const endedAt = nowOf(deps);
  await withTenant(deps.db, session.targetAccountId, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `UPDATE impersonation_session
          SET ended_at = $2
        WHERE id = $1 AND ended_at IS NULL
        RETURNING id`,
      [session.id, endedAt.toISOString()],
    );
    if (res.rows.length === 0) {
      throw new ConflictError(
        "impersonation session already ended or unknown",
        { sessionId: session.id },
      );
    }
  });
  await appendDual(deps, session, "session.end");
  return { ...session, endedAt };
}

/**
 * The scoped executor: refuse expired/ended/unknown sessions (AuthzError, fail-closed), then run
 * `fn` inside the ORDINARY `withTenant(targetAccountId)` transaction — RLS still gates everything
 * (ADR-0005). Impersonation grants scope, never role: there is no superuser path here, and a read
 * outside the target tenant returns zero rows exactly as it would for the tenant itself.
 */
export async function withImpersonation<T>(
  deps: ImpersonationDeps,
  session: ImpersonationSession,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  const now = nowOf(deps);
  return withTenant(deps.db, session.targetAccountId, async (tx) => {
    await requireActive(tx, session.id, now);
    return fn(tx);
  });
}

/** True when `payload` is one side of a dual pair for `sessionId` with the given `kind`. */
function isDualRecord(
  payload: JsonValue,
  kind: string,
  sessionId: string,
): boolean {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return false;
  }
  const record = payload as { readonly [key: string]: JsonValue };
  return record["kind"] === kind && record["sessionId"] === sessionId;
}

/**
 * Pure edge helper: locate a session's BEGIN dual pair in a loaded chain — the first
 * operator-identity record and the first acting-as-tenant record carrying `sessionId`. `null` on
 * either side means that half of the dual trail is missing (the collector flags it).
 */
export function findDualRecordSeqs(
  entries: readonly AuditChainEntry[],
  sessionId: string,
): { operatorRecordSeq: number | null; tenantRecordSeq: number | null } {
  let operatorRecordSeq: number | null = null;
  let tenantRecordSeq: number | null = null;
  for (const entry of entries) {
    if (
      operatorRecordSeq === null &&
      isDualRecord(entry.payload, IMPERSONATION_OPERATOR_RECORD, sessionId)
    ) {
      operatorRecordSeq = entry.seq;
    }
    if (
      tenantRecordSeq === null &&
      isDualRecord(entry.payload, IMPERSONATION_TENANT_RECORD, sessionId)
    ) {
      tenantRecordSeq = entry.seq;
    }
  }
  return { operatorRecordSeq, tenantRecordSeq };
}
