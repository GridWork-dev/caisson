import { describe, expect, test } from "bun:test";
import { auditWormMigrationSql } from "./provision-admin-mutation-surface.ts";

describe("admin audit-WORM provisioning", () => {
  test("installs both the audit chain and its exact artifact-version ledger", () => {
    const sql = auditWormMigrationSql();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS audit_chain_entry");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS worm_artifact_version");
  });
});
