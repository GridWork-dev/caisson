// CAISSON-11 — a spot-check, not a full parity gate. It confirms the two ADR-0218 line-item columns
// (added by bootstrapPglite's CREDIT_LINE_ITEM_MIGRATION_SQL / ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL
// calls, mirroring apps/site/lib/deploy-migrate.ts's platformPackage() migrations 0008/0009) actually
// land on the admin PGlite dev/test bootstrap. It does NOT prove the bootstrap is column-for-column
// equal to the full deploy chain, and it will NOT catch some future migration appended to
// platformPackage() but never wired into bootstrapPglite: apps/admin cannot import platformPackage()
// to build that real diff (apps are top-level consumers here, not packages, and platformPackage is not
// exported through one) — that broader parity gate is left as a follow-up, not delivered by this test.
import { expect, test } from "bun:test";
import { getAdminDb } from "./admin-db.ts";

interface ColumnRow {
  column_name: string;
  data_type: string;
}

test("admin bootstrap carries the ADR-0218 line-item columns (spot-check, not a full deploy-migrate parity gate)", async () => {
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
