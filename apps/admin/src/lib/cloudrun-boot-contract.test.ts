import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminRoot = resolve(import.meta.dir, "../..");

describe("admin Cloud Run boot contract", () => {
  test("instrumentation performs no schema migration at process boot", () => {
    const instrumentation = readFileSync(
      resolve(adminRoot, "src/instrumentation.ts"),
      "utf8",
    );

    expect(instrumentation).not.toContain("ensureAdminAuthTables");
    expect(instrumentation).not.toContain("ADMIN_AUTH_DATABASE_URL");
  });

  test("the migration job uses the full build tree, not Next standalone", () => {
    const dockerfile = readFileSync(resolve(adminRoot, "Dockerfile"), "utf8");

    expect(dockerfile).toContain("FROM build AS migrate");
    expect(dockerfile).toContain(
      'CMD ["bun", "apps/admin/src/lib/admin-deploy-migrate.ts"]',
    );
  });
});
