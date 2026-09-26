// src/store.pg.ts — PG-backed, append-only `TrajectoryStore` (ADR-0360 U-3). Mirrors ai-meter's
// `usage_event` and audit-worm's `audit_chain_entry`: a `(run_id, seq)` UNIQUE append-only log,
// tenant-isolated via hand-authored RLS (byte-identical to `buildTenantPolicySql('trajectory_event')`
// minus its UPDATE/DELETE grant — see `migrations/0001_trajectory_event.sql`; the correspondence is
// pinned by `store.pg.integration.test.ts`, the same drift-guard field-crypto/audit-worm use).
//
// PER-CALL TENANT SCOPING (deliberately NOT field-crypto's pre-scoped-executor pattern): a
// `TrajectoryStore` is constructed ONCE and held for a run's ENTIRE lifetime — `RunToolLoopOptions.
// store` is called dozens of times across many steps, each interleaved with the loop's OWN separate
// ai-meter `withTenant` calls (reserve/reconcile). A store bound to one PRE-OPENED `withTenant`
// transaction held open across that whole span would nest a second transaction inside the first on
// every meter call — PGlite (a single connection) deadlocks on this (proven by the S3 integration
// test before this fix). So this store takes the RAW `Transactor` + `accountId` and opens its OWN
// short-lived `withTenant` transaction PER `append`/`read` call — exactly mirroring how
// `agent-loop.ts` wraps each `reserve`/`reconcile` call individually. This is the SAME shape
// ai-meter's own `reserve`/`reconcile` take (a pre-scoped `TenantExecutor`, wrapped fresh by the
// CALLER on every invocation) — `store.append(event)`'s port signature has no per-call slot for that
// wrapping, so the store does it internally instead. `@caisson-sh/tenancy-rls` is therefore a REAL
// runtime dependency here (unlike field-crypto's ADR-0043-locked kernel-only constraint, which this
// package carries no equivalent lock against).
//
// DUAL-WRITE RESIDUAL (documented, mirrors audit-worm's own "KNOWN BOUND" note): because each
// append is its own transaction, a crash between two related appends (e.g. `approveToolCall`'s
// run-state CAS commit and its `tool.approved` trajectory append) is not atomic. This store's own
// append-only semantics (idempotent byte-identical re-append, gap/rewrite rejection) prevent a
// silent DOUBLE-write on any retry, but — corrected claim (security audit F2, this was previously
// overstated here): a bare retry of the CAS alone does NOT recover a missing append by itself,
// because `RunStateStore.approve`'s `wasNoop` on a retry means "already decided", so a caller that
// only re-runs the CAS and gates its append on `!wasNoop` would skip the append FOREVER — the
// crash window would otherwise be a silently lost audit record, not a recoverable one. The actual
// recovery is the CALLER's job: `@caisson-sh/ai-kit`'s `approveToolCall` reads the log tail on a
// `wasNoop` retry and re-appends `tool.approved` if it's missing (self-heal), and
// `@caisson-sh/cli`'s `run.ts` avoids the window entirely by running the CAS and the append in ONE
// transaction. This store provides the idempotency primitive; it does not itself guarantee
// recovery — a caller composing raw appends around a CAS must do one of those two things.
//
// Semantics mirror the in-memory store exactly (its tests are the contract, per the PLAN): a
// byte-identical re-append at an already-recorded seq is idempotent (safe retry after a dropped
// ack); a rewrite (same seq, different content) or a gap (seq beyond the next free slot) throws
// `ConflictError`. A `pg_advisory_xact_lock` on `(namespace, runId)` serializes concurrent appends
// for the SAME run so two racers can't both compute the same "next free slot" — the `(run_id, seq)`
// UNIQUE constraint is the hard belt underneath even if the lock were ever bypassed.
import {
  ConflictError,
  isUniqueViolation,
  parseStrict,
} from "@caisson-sh/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import { TrajectoryEvent } from "./schema.ts";
import type { TrajectoryStore } from "./store.ts";

const LOCK_NAMESPACE = "caisson.agent-trajectory";

interface EventRow {
  readonly event: unknown;
}

function stableEqual(a: TrajectoryEvent, b: TrajectoryEvent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function appendScoped(
  exec: TenantExecutor,
  accountId: string,
  event: TrajectoryEvent,
): Promise<void> {
  const parsed = parseStrict(TrajectoryEvent, event);

  // Serialize appends for THIS run for the txn's life — two concurrent appends can't both read
  // the same "next free slot" and insert two different rows at it.
  await exec.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
    LOCK_NAMESPACE,
    parsed.runId,
  ]);

  const countRes = await exec.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM trajectory_event WHERE run_id = $1`,
    [parsed.runId],
  );
  const expected = countRes.rows[0]?.n ?? 0;

  if (parsed.seq === expected) {
    try {
      await exec.query(
        `INSERT INTO trajectory_event (id, account_id, run_id, seq, event)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          parsed.eventId,
          accountId,
          parsed.runId,
          parsed.seq,
          JSON.stringify(parsed),
        ],
      );
    } catch (err) {
      // A concurrent writer won the race between the count and the insert — the UNIQUE belt fires
      // (23505). Fail closed rather than silently coexist.
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          "append-only: seq already recorded with different content",
          { runId: parsed.runId, seq: parsed.seq },
        );
      }
      throw err;
    }
    return;
  }

  if (parsed.seq < expected) {
    // Already-recorded slot: idempotent iff byte-identical, else a rewrite.
    const existing = await exec.query<EventRow>(
      `SELECT event FROM trajectory_event WHERE run_id = $1 AND seq = $2`,
      [parsed.runId, parsed.seq],
    );
    const row = existing.rows[0];
    const existingEvent =
      row === undefined ? undefined : parseStrict(TrajectoryEvent, row.event);
    if (existingEvent !== undefined && stableEqual(existingEvent, parsed)) {
      return;
    }
    throw new ConflictError(
      "append-only: seq already recorded with different content",
      { runId: parsed.runId, seq: parsed.seq },
    );
  }

  // parsed.seq > expected — a gap; append-only forbids skipping a slot.
  throw new ConflictError("append-only: seq gap", {
    runId: parsed.runId,
    seq: parsed.seq,
    expected,
  });
}

/**
 * Build a PG-backed `TrajectoryStore` bound to one tenant. `tx` is the RAW `Transactor` (e.g. the
 * same `RunToolLoopOptions.tx` the loop already threads through) — every `append`/`read` call opens
 * its OWN short-lived `withTenant` transaction (see the file header for why this store cannot hold
 * one transaction open across a run's whole life). `accountId` is stamped on every insert and must
 * equal the bound GUC or the RLS `WITH CHECK` clause rejects it.
 */
export function createPgTrajectoryStore(
  tx: Transactor,
  accountId: string,
): TrajectoryStore {
  return {
    append(event: TrajectoryEvent): Promise<void> {
      return withTenant(tx, accountId, (exec) =>
        appendScoped(exec, accountId, event),
      );
    },

    async read(runId: string): Promise<TrajectoryEvent[]> {
      return withTenant(tx, accountId, async (exec) => {
        const res = await exec.query<EventRow>(
          `SELECT event FROM trajectory_event WHERE run_id = $1 ORDER BY seq ASC`,
          [runId],
        );
        return res.rows.map((r) => parseStrict(TrajectoryEvent, r.event));
      });
    },
  };
}
