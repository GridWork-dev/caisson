import { describe, expect, test } from "bun:test";
import { newTestPg } from "@caisson/testing";
import { auditWormMigrationSteps } from "./provision-admin-mutation-surface.ts";

describe("admin audit-WORM provisioning", () => {
  test("an existing audit-chain install still advances to the artifact-version ledger", async () => {
    const tp = await newTestPg();
    try {
      const steps = auditWormMigrationSteps();
      expect(steps).toHaveLength(2);
      expect(steps[0]?.[1]).toContain(
        "CREATE TABLE IF NOT EXISTS audit_chain_entry",
      );
      expect(steps[1]?.[1]).toContain(
        "CREATE TABLE IF NOT EXISTS worm_artifact_version",
      );

      // Simulate the live upgrade: 0001 is already present and its duplicate policy aborts that
      // migration step. Provisioning must still run 0004 as a separate query.
      await tp.exec(steps[0]![1]);
      for (const [, sql] of steps) {
        try {
          await tp.exec(sql);
        } catch (error) {
          const code =
            typeof error === "object" && error !== null
              ? Reflect.get(error, "code")
              : undefined;
          if (code !== "42710" && code !== "42P07") throw error;
        }
      }

      const tables = await tp.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_name IN ('audit_chain_entry','worm_artifact_version') ORDER BY table_name",
      );
      expect(tables.map((row) => row.table_name)).toEqual([
        "audit_chain_entry",
        "worm_artifact_version",
      ]);
    } finally {
      await tp.close();
    }
  });
});
