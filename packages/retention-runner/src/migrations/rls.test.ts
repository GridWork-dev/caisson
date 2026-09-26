// No PGlite/pg driver ships in this package (audit-sink.ts is in-memory only; the pg table is a
// documented seam), so there's no DB harness to run a live cross-tenant SELECT against. This is the
// minimum fail-closed check: 0002 exists alongside 0001, and it actually enables + forces RLS with
// a tenant_id-keyed policy bound to the same GUC the rest of the tenant-scoped surface uses
// (@caisson-sh/tenancy-rls TENANT_GUC) — the ADR-0005 finding this migration closes.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MIGRATIONS_DIR = join(import.meta.dir);

describe("retention_audit RLS migration", () => {
  test("0002 ships alongside 0001 and is picked up by the assembler's naming contract", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    expect(files.sort()).toEqual([
      "0001_retention_audit.sql",
      "0002_retention_audit_rls.sql",
      "0003_retention_audit_rls_nullif.sql",
    ]);
  });

  test("0002 enables fail-closed tenant isolation on retention_audit", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "0002_retention_audit_rls.sql"),
      "utf8",
    );
    expect(sql).toContain(
      "ALTER TABLE retention_audit ENABLE ROW LEVEL SECURITY;",
    );
    expect(sql).toContain(
      "ALTER TABLE retention_audit FORCE ROW LEVEL SECURITY;",
    );
    expect(sql).toContain("GRANT SELECT, INSERT ON retention_audit TO app;");
    expect(sql).toContain(
      "USING (tenant_id = current_setting('app.current_account', true))",
    );
    expect(sql).toContain(
      "WITH CHECK (tenant_id = current_setting('app.current_account', true))",
    );
  });

  test("0003 hardens the 0002 policy with NULLIF (append-only follow-up, not an edit)", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "0003_retention_audit_rls_nullif.sql"),
      "utf8",
    );
    expect(sql).toContain(
      "DROP POLICY retention_audit_tenant_isolation ON retention_audit;",
    );
    expect(sql).toContain(
      "USING (tenant_id = NULLIF(current_setting('app.current_account', true), ''))",
    );
    expect(sql).toContain(
      "WITH CHECK (tenant_id = NULLIF(current_setting('app.current_account', true), ''))",
    );
  });
});
