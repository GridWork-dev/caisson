// src/advisory-lock.ts — producer-side dedup via a Postgres transaction-scoped advisory lock (ADR-0229
// row 57), composing the SKIP-LOCKED consumer of ADR-0211. `deriveIdempotentJobId` + ON CONFLICT DO
// NOTHING makes the INSERT atomic, but a CHECK-THEN-ENQUEUE decision ("enqueue a digest only if none is
// pending AND the last was > 1h ago") is a read-then-write TOCTOU two workers can both pass. A
// transaction-scoped advisory lock serializes that critical section: SKIP LOCKED protects the consumer
// claim; this protects the producer's conditional enqueue.
import { createHash } from "node:crypto";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";

/**
 * Derive a STABLE signed-64-bit advisory-lock id from `key`: sha256(key) → first 8 bytes as an unsigned
 * 64-bit int → folded into the signed range `pg_advisory_xact_lock(bigint)` expects. Returned as a
 * decimal string (bound as `$1::bigint`), so no JS Number precision is ever involved. Hashing the whole
 * key means there is no separator/concatenation ambiguity; distinct keys collide only at the ~2^-64
 * birthday rate.
 */
export function advisoryLockId(key: string): string {
  const digest = createHash("sha256").update(key).digest();
  return BigInt.asIntN(64, digest.readBigUInt64BE(0)).toString();
}

/**
 * Run `fn` holding a Postgres transaction-scoped advisory lock keyed by `key`. Issues
 * `SELECT pg_advisory_xact_lock($1::bigint)` (blocking until the lock is free) BEFORE `fn`; the lock
 * AUTO-RELEASES at transaction end — no manual unlock, no leak on a throw. Serializes a
 * check-then-enqueue critical section across workers — the TOCTOU a plain UNIQUE + SELECT-then-INSERT
 * still has. Run inside `withTenant` (the lock is global to the DB, but the surrounding tenant tx owns
 * the release).
 */
export async function withAdvisoryXactLock<T>(
  tx: TenantExecutor,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  await tx.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [
    advisoryLockId(key),
  ]);
  return fn();
}
