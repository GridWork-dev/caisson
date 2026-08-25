import { runAdminDeployMigration } from "../apps/admin/src/lib/admin-deploy-migrate.ts";
import { runSiteDeployMigration } from "../apps/site/lib/deploy-migrate.ts";

export interface MigrationRunners {
  site(): Promise<void>;
  admin(): Promise<void>;
}

const defaultRunners: MigrationRunners = {
  site: runSiteDeployMigration,
  admin: runAdminDeployMigration,
};

/** Run both idempotent schema owners inside the one locked `caisson-migrate` Cloud Run Job. */
export async function runCaissonMigrations(
  runners: MigrationRunners = defaultRunners,
): Promise<void> {
  await runners.site();
  await runners.admin();
}

if (import.meta.main) await runCaissonMigrations();
