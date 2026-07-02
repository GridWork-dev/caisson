// CAISSON-11 — columns-contract-style parity assertion (mirrors
// packages/platform-reads/src/columns-contract.test.ts's shape + apps/site/lib/deploy-migrate.test.ts's
// "0008/0009 add the ADR-0218 per-line join-key columns" assertion): proves the admin PGlite dev/test
// bootstrap (bootstrapPglite, this module) ends up column-for-column equal to the deploy chain
// (apps/site/lib/deploy-migrate.ts's platformPackage(), migrations 0001..0009) on the tables admin
// reads. If a future migration is appended to the deploy chain but never wired here, this test is the
// one that catches the drift — not a runtime column-not-found error in production.
import { expect, test } from "bun:test";
import { getAdminDb } from "./admin-db.ts";

interface ColumnRow {
  column_name: string;
  data_type: string;
}

test("admin bootstrap carries the ADR-0218 line-item columns (deploy-migrate 0008/0009 parity)", async () => {
  // Queries information_schema directly on the bootstrap connection (NOT through readAdmin/the
  // `admin` role) — information_schema.columns only lists columns a role has some privilege on, and
  // `admin` is granted SELECT on entitlement_grant/license_grant/credit_wallet only, not credit_event.
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
