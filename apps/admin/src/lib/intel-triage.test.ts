// ADR-0316 F5 — intel triage write path on PGlite. Seeds a finding, flips it reviewed/dismissed as
// the `admin_write` role (the same seam the routes use), and asserts the status change + the
// queryable admin_action_log row + the WORM-status contract. The WORM store is a fake (only .append
// is called) so no audit_chain table is needed.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ADMIN_WRITE_ROLE_BOOTSTRAP_SQL } from "@caisson/org-controls";
import {
  ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL,
  ADMIN_ACTION_LOG_SCHEMA_SQL,
  type AdminMutationDeps,
} from "@caisson/service-license";
import type { Transactor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import { INTEL_ADMIN_READ_GRANT_SQL, INTEL_SCHEMA_SQL } from "./intel-read.ts";
import {
  dismissFindingAdmin,
  reviewFindingAdmin,
  type IntelTriageResult,
} from "./intel-triage.ts";

let tp: TestPg;
let db: Transactor;

type TriageDeps = Pick<AdminMutationDeps, "db" | "worm">;
const okWorm = {
  append: async () => {
    /* ok */
  },
} as unknown as AdminMutationDeps["worm"];
function deps(worm: AdminMutationDeps["worm"] = okWorm): TriageDeps {
  return { db, worm };
}

async function seedFinding(status?: string): Promise<string> {
  const id = randomUUID();
  await tp.query(
    `INSERT INTO intel.findings (id, source, kind, severity, title, body, dedup_key, run_id, status)
     VALUES ($1, 'github', 'test-kind', 'info', 'a title', 'body', $2, $3, COALESCE($4, 'open'))`,
    [id, randomUUID(), randomUUID(), status ?? null],
  );
  return id;
}

async function statusOf(id: string): Promise<string | undefined> {
  const rows = await tp.query<{ status: string; triaged_by: string | null }>(
    `SELECT status, triaged_by FROM intel.findings WHERE id = $1`,
    [id],
  );
  return rows[0]?.status;
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  await tp.exec(INTEL_SCHEMA_SQL);
  await tp.exec(INTEL_ADMIN_READ_GRANT_SQL);
  await tp.exec(ADMIN_ACTION_LOG_SCHEMA_SQL);
  await tp.exec(ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL); // admits intel_review / intel_dismiss
});

afterAll(async () => {
  await tp.close();
});

describe("intel triage (ADR-0316 F5)", () => {
  test("review flips status to reviewed + logs intel_review under the synthetic 'intel' target", async () => {
    const id = await seedFinding();
    const r: IntelTriageResult = await reviewFindingAdmin(deps(), {
      actorEmail: "admin@caisson.sh",
      findingId: id,
    });
    expect(r.before).toBe("open");
    expect(r.after).toBe("reviewed");
    expect(r.worm).toBe("ok");
    expect(await statusOf(id)).toBe("reviewed");

    const log = await tp.query<{ target_account_id: string; action: string }>(
      `SELECT target_account_id, action FROM admin_action_log WHERE action = 'intel_review'`,
    );
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]?.target_account_id).toBe("intel");
  });

  test("dismiss flips status to dismissed", async () => {
    const id = await seedFinding();
    const r = await dismissFindingAdmin(deps(), {
      actorEmail: "admin@caisson.sh",
      findingId: id,
    });
    expect(r.after).toBe("dismissed");
    expect(await statusOf(id)).toBe("dismissed");
  });

  test("a nonexistent finding id throws NotFound (rolls back — no log row)", async () => {
    await expect(
      reviewFindingAdmin(deps(), {
        actorEmail: "admin@caisson.sh",
        findingId: randomUUID(),
      }),
    ).rejects.toThrow(/does not exist/);
  });

  test("a WORM append that throws returns worm:'failed' while the status flip PERSISTS", async () => {
    const id = await seedFinding();
    const brokenWorm = {
      append: async () => {
        throw new Error("worm down");
      },
    } as unknown as AdminMutationDeps["worm"];
    const r = await reviewFindingAdmin(deps(brokenWorm), {
      actorEmail: "admin@caisson.sh",
      findingId: id,
    });
    expect(r.worm).toBe("failed");
    expect(await statusOf(id)).toBe("reviewed"); // durable regardless of WORM
  });
});
