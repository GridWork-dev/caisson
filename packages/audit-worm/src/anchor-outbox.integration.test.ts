// Integration proof for the durable anchor outbox (CR-02, ADR-0346 P4) on PGlite — real FORCE RLS,
// SET ROLE, the CHECK constraint, and the guarded admin_write policy. The load-bearing test is the
// crash window: a submitted-but-receipt-lost row resolves to needs_reconcile and can never be
// re-submitted (no duplicate irrevocable public entry).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { createHash, randomUUID } from "node:crypto";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { ConflictError } from "@caisson-sh/kernel";
import { ANCHOR_OUTBOX_SCHEMA_SQL, AnchorOutbox } from "./anchor-outbox.ts";
import type { AnchorOutboxKey } from "./anchor-transparency.ts";

let tp: TestPg;
let outbox: AnchorOutbox;

const digest = (s: string): string =>
  createHash("sha256").update(s).digest("hex");

function keyFor(accountId: string, length: number): AnchorOutboxKey {
  return {
    accountId,
    target: "tsa",
    anchorLength: length,
    anchorDigest: digest(`${accountId}:${String(length)}`),
  };
}

beforeAll(async () => {
  tp = await newTestPg();
  // admin_write must exist BEFORE the schema SQL so its guarded policy block fires (mirrors the
  // service DEPLOY order); newTestPg already provisions `app`.
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_write') THEN
      CREATE ROLE admin_write NOLOGIN;
    END IF;
  END $$;`);
  await tp.exec(ANCHOR_OUTBOX_SCHEMA_SQL);
  outbox = new AnchorOutbox(tp.pg);
}, 120_000);

afterAll(async () => {
  if (tp) await tp.close();
});

describe("state machine — happy path", () => {
  test("enqueue → submit → receipt walks pending to receipted", async () => {
    const acct = randomUUID();
    const key = keyFor(acct, 1);

    const enq = await outbox.enqueuePending(key);
    expect(enq.state).toBe("pending");
    expect(enq.anchorDigest).toBe(key.anchorDigest);

    await outbox.markSubmitted(key);
    expect((await outbox.get(key))?.state).toBe("submitted");

    await outbox.markReceipted(key, "receipt-version-1");
    expect(await outbox.get(key)).toMatchObject({
      state: "receipted",
      receiptVersionId: "receipt-version-1",
    });
  });

  test("enqueuePending is idempotent — a second call never resurrects or duplicates", async () => {
    const acct = randomUUID();
    const key = keyFor(acct, 2);
    const first = await outbox.enqueuePending(key);
    await outbox.markSubmitted(key);
    // a re-enqueue of an already-submitted key returns the SAME row, still submitted (not reset)
    const again = await outbox.enqueuePending(key);
    expect(again.id).toBe(first.id);
    expect(again.state).toBe("submitted");
  });
});

describe("CR-02 crash window — no second submit", () => {
  test("a submitted-but-receipt-lost row resolves to needs_reconcile, never re-submits", async () => {
    const acct = randomUUID();
    const key = keyFor(acct, 3);
    await outbox.enqueuePending(key);
    await outbox.markSubmitted(key); // persisted BEFORE the (crashed) network call

    // The reconcile decision: the row is stuck at submitted → needs_reconcile, NOT a blind resubmit.
    await outbox.markNeedsReconcile(key, "receipt lost after submit");
    expect((await outbox.get(key))?.state).toBe("needs_reconcile");

    // A blind re-submit is structurally impossible: markSubmitted only fires from `pending`.
    await expect(outbox.markSubmitted(key)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("markSubmitted twice is refused (the second is a would-be duplicate submit)", async () => {
    const acct = randomUUID();
    const key = keyFor(acct, 4);
    await outbox.enqueuePending(key);
    await outbox.markSubmitted(key);
    await expect(outbox.markSubmitted(key)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("state machine — illegal transitions fail closed", () => {
  test("markReceipted from pending is refused", async () => {
    const acct = randomUUID();
    const key = keyFor(acct, 5);
    await outbox.enqueuePending(key);
    await expect(outbox.markReceipted(key)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("markFailed carries a last_error and is terminal from pending", async () => {
    const acct = randomUUID();
    const key = keyFor(acct, 6);
    await outbox.enqueuePending(key);
    await outbox.markFailed(key, "tsa 500");
    const row = await outbox.get(key);
    expect(row?.state).toBe("failed");
    expect(row?.lastError).toBe("tsa 500");
  });
});

describe("tenant isolation + admin_write reconcile (ADR-0005, ADR-0346 P4)", () => {
  test("one tenant's outbox row never bleeds into another; admin_write reads cross-tenant", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await outbox.enqueuePending(keyFor(a, 7));
    await outbox.enqueuePending(keyFor(b, 7));

    // The buyer app role under tenant B cannot see tenant A's row even naming it explicitly (RLS).
    const cross = await tp.asTenant(b, async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM anchor_outbox WHERE account_id = $1`,
        [a],
      );
      return r.rows[0]?.n;
    });
    expect(cross).toBe(0);

    // The operator reconcile role sees every tenant's rows (admin_write USING (true)).
    const total = await tp.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE admin_write`);
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM anchor_outbox WHERE anchor_length = 7`,
      );
      return r.rows[0]?.n;
    });
    expect(total).toBe(2);
  });
});
