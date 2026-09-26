// `outstandingClaw` must acquire its advisory lock BEFORE reading
// `creditsGrantedBySource`/`creditsClawedForSource` — that ordering is what closes the
// read-then-claw TOCTOU (see credits.ts's doc comment for the full race). PGlite is a single
// connection and cannot model true cross-transaction contention (the same documented limitation
// as advisory-lock.integration.test.ts), so — mirroring that file's own split — the ORDERING
// guarantee is proven here against a recording executor; `outstanding-claw.integration.test.ts`
// proves the arithmetic + the sequential "second racer sees the first's committed claw" behavior
// against real PGlite.
import { describe, expect, test } from "bun:test";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { outstandingClaw } from "./credits.ts";

/** A `TenantExecutor` that records every query instead of touching Postgres (mirrors
 *  `@caisson-sh/jobs`'s `advisory-lock.test.ts` recording double). */
function recordingTx(): TenantExecutor & {
  readonly queries: ReadonlyArray<{
    sql: string;
    params: unknown[] | undefined;
  }>;
} {
  const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
  return {
    queries,
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      return { rows: [] as T[] };
    },
    async exec() {
      return undefined;
    },
  };
}

describe("outstandingClaw (read-then-claw guard)", () => {
  test("acquires the advisory lock BEFORE reading granted/clawed", async () => {
    const tx = recordingTx();
    await outstandingClaw(tx, "acct_1", "pi_1");

    const lockIdx = tx.queries.findIndex((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    );
    expect(lockIdx).toBe(0);
    const readIdxs = tx.queries
      .map((q, i) => (q.sql.includes("credit_event") ? i : -1))
      .filter((i) => i >= 0);
    // Both the granted-read and the clawed-read happen strictly after the lock.
    expect(readIdxs).toHaveLength(2);
    expect(readIdxs.every((i) => i > lockIdx)).toBe(true);
  });

  test("locks a key scoped to BOTH the account and the purchase — distinct purchases never contend", async () => {
    const txSame1 = recordingTx();
    await outstandingClaw(txSame1, "acct_1", "pi_1");
    const txSame2 = recordingTx();
    await outstandingClaw(txSame2, "acct_1", "pi_1");
    const lockParams1 = txSame1.queries[0]?.params;
    const lockParams2 = txSame2.queries[0]?.params;
    // Same (account, purchase) → same derived lock id, so two racers for the SAME purchase
    // actually contend on the SAME Postgres advisory lock.
    expect(lockParams1).toEqual(lockParams2);

    const txOther = recordingTx();
    await outstandingClaw(txOther, "acct_1", "pi_2");
    expect(txOther.queries[0]?.params).not.toEqual(lockParams1);
  });

  test("with no ledger rows, the outstanding amount is 0 (never negative)", async () => {
    const tx = recordingTx();
    const remaining = await outstandingClaw(tx, "acct_1", "pi_1");
    expect(remaining).toBe(0);
  });
});
