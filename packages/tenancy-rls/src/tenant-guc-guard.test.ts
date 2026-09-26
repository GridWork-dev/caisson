// The pgbouncer/pooler "reset custom GUCs to '' instead of unsetting them" gotcha.
// `buildTenantPolicySql`'s policy reads `app.current_account` via `current_setting(..., true)`; an
// unguarded read compares `column = ''` when a pooled backend is left in that reset state — a
// coincidental deny only for as long as no row's tenant column is ever literally the empty string.
// `NULLIF(..., '')` folds that '' to NULL first, so the comparison is always NULL (deny). This test
// proves the worst case directly: a row whose tenant column genuinely IS '' stays invisible even
// when the GUC is left at that same reset value.
import { expect, test } from "bun:test";
import { newTestPg } from "@caisson-sh/testing";
import { TENANT_GUC, buildTenantPolicySql, type Transactor } from "./rls.ts";

test("an empty-string GUC (the pooler reset-to-'' case) denies rather than matches — even a same-valued row", async () => {
  const tp = await newTestPg();
  await tp.exec(
    `CREATE TABLE thing (id text PRIMARY KEY, account_id text NOT NULL, val text);`,
  );
  await tp.exec(buildTenantPolicySql("thing"));
  // Worst-case seed: a row whose account_id IS the empty string, plus an ordinary tenant's row.
  await tp.exec(
    `INSERT INTO thing (id, account_id, val) VALUES
       ('empty-acct', '', 'must-never-be-visible'),
       ('real', 'acct_a', 'real-row');`,
  );
  const db = tp.pg as unknown as Transactor;
  const rows = await db.transaction(async (tx) => {
    // Bypass withTenant's normal bind and set the GUC directly to '' — the state a pooled backend
    // can be left in when no explicit bind happened on this leased connection.
    await tx.query(`SELECT set_config($1, $2, true)`, [TENANT_GUC, ""]);
    await tx.exec(`SET LOCAL ROLE app`);
    return tx.query<{ id: string }>(`SELECT id FROM thing`);
  });
  expect(rows.rows).toEqual([]);
  await tp.close();
});

test("buildTenantPolicySql's generated SQL wraps the GUC read in NULLIF(..., '')", () => {
  // A cheap text pin alongside the behavioral proof above — if this generator's shape ever drops
  // the guard, this fails before the behavioral test has to catch it.
  const sql = buildTenantPolicySql("thing");
  expect(sql).toContain(`NULLIF(current_setting('${TENANT_GUC}', true), '')`);
});
