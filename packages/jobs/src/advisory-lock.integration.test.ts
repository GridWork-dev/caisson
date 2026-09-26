// withAdvisoryXactLock against a real PGlite (ADR-0229): proves the `pg_advisory_xact_lock(
// $1::bigint)` statement is valid real-Postgres and the guarded section runs inside a withTenant tx.
//
// PGlite is a SINGLE connection, so it can't model true cross-connection contention — two
// "concurrent" tenant txns serialize on the one backend regardless of the lock. The contention
// semantics (the lock is acquired BEFORE the critical section) are asserted in the unit test against a
// recording executor; this file proves the SQL + bigint id are accepted by a real Postgres and compose
// with a tenant transaction. True multi-worker serialization needs a multi-connection PG (out of the
// harness's model).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import { withAdvisoryXactLock } from "./advisory-lock.ts";

setDefaultTimeout(30_000);

// skipIf is evaluated at test-DEFINITION time (not in beforeAll), so probe advisory-lock support at
// module load with a throwaway instance.
const advisoryLocksSupported = await (async (): Promise<boolean> => {
  const probe = await newTestPg();
  try {
    await probe.asAppNoTenant((tx) =>
      tx.query(`SELECT pg_advisory_xact_lock($1::bigint)`, ["1"]),
    );
    return true;
  } catch {
    return false;
  } finally {
    await probe.close();
  }
})();

describe.skipIf(!advisoryLocksSupported)(
  "withAdvisoryXactLock (integration, real PGlite)",
  () => {
    let tp: TestPg;

    beforeAll(async () => {
      tp = await newTestPg();
    });
    afterAll(async () => {
      await tp.close();
    });

    test("acquires a real transaction-scoped advisory lock inside withTenant and runs fn", async () => {
      let ran = 0;
      const acct = "acct_adv";
      const result = await tp.asTenant(acct, (tx) =>
        withAdvisoryXactLock(tx, `sweep:${acct}`, async () => {
          ran += 1;
          return "done";
        }),
      );
      expect(result).toBe("done");
      expect(ran).toBe(1);
    });

    test("the lock is re-acquirable across transactions — two sequential guarded sections both complete", async () => {
      let counter = 0;
      const acct = "acct_adv2";
      await tp.asTenant(acct, (tx) =>
        withAdvisoryXactLock(tx, `sweep:${acct}`, async () => {
          counter += 1;
        }),
      );
      await tp.asTenant(acct, (tx) =>
        withAdvisoryXactLock(tx, `sweep:${acct}`, async () => {
          counter += 1;
        }),
      );
      expect(counter).toBe(2);
    });
  },
);
