// CAISSON-21 — the real parity gate, superseding the CAISSON-11 spot-check below. admin-db.ts's
// PGlite bootstrap now applies the SAME shared migration chain (@caisson/platform-migrations) that
// apps/site/lib/deploy-migrate.ts applies to a live Postgres, so a migration that lands in the
// shared chain lands here automatically — no more hand-mirrored SQL-constant list to drift (the
// CAISSON-11 class, which bit again on credit_event, caught in PR #176's review). The first two
// tests below are the actual gate: they boot the double and assert every `ADMIN_READ_TABLES` entry
// exists with FORCE row-level security and its cross-tenant admin-read policy, so a future table
// rename/removal in the shared chain fails a test instead of 500ing prod. The chain-equality digest
// proof itself lives in packages/platform-migrations/src/index.test.ts (the shared package both
// consumers import).
import { expect, test } from "bun:test";
import { getAdminDb } from "./admin-db.ts";

/** Mirrors admin-db.ts's own (unexported) ADMIN_READ_TABLES — kept in sync manually since a test
 *  file importing a module-private const would need it exported for no other reason. */
const ADMIN_READ_TABLES = [
  "credit_wallet",
  "credit_event",
  "entitlement_grant",
  "license_grant",
  "account_member",
] as const;

interface ColumnRow {
  column_name: string;
  data_type: string;
}

interface RlsRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

test("every ADMIN_READ_TABLES entry exists with FORCE row-level security after the shared-chain bootstrap", async () => {
  const db = await getAdminDb();
  const rows = await db.transaction(async (tx) => {
    const res = await tx.query<RlsRow>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = ANY($1) AND relkind = 'r'`,
      [ADMIN_READ_TABLES as unknown as string[]],
    );
    return res.rows;
  });

  expect(rows.map((r) => r.relname).sort()).toEqual(
    [...ADMIN_READ_TABLES].sort(),
  );
  for (const row of rows) {
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  }
});

test("every ADMIN_READ_TABLES entry carries the admin-role cross-tenant SELECT policy (buildAdminReadPolicySql)", async () => {
  const db = await getAdminDb();
  const rows = await db.transaction(async (tx) => {
    const res = await tx.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies
       WHERE tablename = ANY($1) AND policyname LIKE '%_admin_read'`,
      [ADMIN_READ_TABLES as unknown as string[]],
    );
    return res.rows;
  });

  expect(rows.map((r) => r.tablename).sort()).toEqual(
    [...ADMIN_READ_TABLES].sort(),
  );
});

test("admin bootstrap carries the ADR-0218 line-item columns (kept for its role/direct-connection framing; the parity gate above is the real coverage now)", async () => {
  // Queries information_schema directly on the bootstrap connection (NOT through readAdmin/the
  // `admin` role) — information_schema.columns only lists columns a role has some privilege on, so a
  // role-scoped read could hide a column; the owner connection sees the true table shape.
  const db = await getAdminDb();
  const [entitlementCols, creditCols] = await db.transaction(async (tx) => {
    const ent = await tx.query<ColumnRow>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'entitlement_grant' AND column_name = 'line_item_id'`,
    );
    const credit = await tx.query<ColumnRow>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'credit_event' AND column_name IN ('line_item_id', 'line_charged_amount')
       ORDER BY column_name`,
    );
    return [ent.rows, credit.rows];
  });

  expect(entitlementCols).toEqual([
    { column_name: "line_item_id", data_type: "text" },
  ]);
  expect(creditCols).toEqual([
    { column_name: "line_charged_amount", data_type: "integer" },
    { column_name: "line_item_id", data_type: "text" },
  ]);
});
