// CAISSON-25a: `reconcileCoverageGrants` (the refund sweep) and `grantOwnedCoverageMirrors` (the
// ADR-0269 Developer-plan re-grant) must both acquire the SAME advisory lock key, scoped to the
// account, BEFORE their read-then-write critical section — that is what closes the "static-grant
// ordering race" (a mirror grant and a refund reconcile for the same account can no longer
// interleave out of order). PGlite is a single connection and cannot model true cross-transaction
// contention (see `@caisson/jobs`'s advisory-lock.integration.test.ts), so — mirroring that file's
// own split — the ORDERING + SAME-KEY guarantee is proven here against a recording executor;
// `entitlement-store.integration.test.ts` covers the real-PGlite read/write behavior.
import { describe, expect, test } from "bun:test";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import {
  grantOwnedCoverageMirrors,
  reconcileCoverageGrants,
} from "./entitlement-store.ts";

/** A `TenantExecutor` that records every query instead of touching Postgres (mirrors
 *  `@caisson/jobs`'s `advisory-lock.test.ts` recording double). */
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

describe("reconcileCoverageGrants / grantOwnedCoverageMirrors lock (CAISSON-25a)", () => {
  test("reconcileCoverageGrants acquires the advisory lock BEFORE its read/write", async () => {
    const tx = recordingTx();
    await reconcileCoverageGrants(tx, "acct_1");
    const lockIdx = tx.queries.findIndex((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    );
    expect(lockIdx).toBe(0);
    const laterIdxs = tx.queries
      .map((q, i) => (q.sql.includes("entitlement_grant") ? i : -1))
      .filter((i) => i >= 0);
    expect(laterIdxs.length).toBeGreaterThan(0);
    expect(laterIdxs.every((i) => i > lockIdx)).toBe(true);
  });

  test("grantOwnedCoverageMirrors acquires the advisory lock BEFORE its read (no owned ids -> no write)", async () => {
    const tx = recordingTx();
    const covered = await grantOwnedCoverageMirrors(tx, {
      accountId: "acct_1",
      subscriptionId: "sub_1",
      sourceEventId: "inv_1",
      cadence: "month",
    });
    expect(covered).toEqual([]); // recordingTx returns no rows -> nothing "owned" -> no upsert
    const lockIdx = tx.queries.findIndex((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    );
    expect(lockIdx).toBe(0);
  });

  test("both functions derive the SAME lock key for the SAME account — they actually contend", async () => {
    const txReconcile = recordingTx();
    await reconcileCoverageGrants(txReconcile, "acct_shared");
    const txGrant = recordingTx();
    await grantOwnedCoverageMirrors(txGrant, {
      accountId: "acct_shared",
      subscriptionId: "sub_1",
      sourceEventId: "inv_1",
      cadence: "year",
    });
    const reconcileLockParams = txReconcile.queries.find((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    )?.params;
    const grantLockParams = txGrant.queries.find((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    )?.params;
    expect(reconcileLockParams).toBeDefined();
    expect(reconcileLockParams).toEqual(grantLockParams);
  });

  test("distinct accounts derive distinct lock keys — they never contend with each other", async () => {
    const txA = recordingTx();
    await reconcileCoverageGrants(txA, "acct_a");
    const txB = recordingTx();
    await reconcileCoverageGrants(txB, "acct_b");
    const lockA = txA.queries.find((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    )?.params;
    const lockB = txB.queries.find((q) =>
      q.sql.includes("pg_advisory_xact_lock"),
    )?.params;
    expect(lockA).not.toEqual(lockB);
  });
});
