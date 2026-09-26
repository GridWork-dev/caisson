import type { JobAlertingDeps } from "@caisson/jobs";

export function requireJobDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const url = env.DATABASE_URL?.trim() ?? "";
  if (url === "") {
    throw new Error(
      "DATABASE_URL is required for the finite license job — refusing to start.",
    );
  }
  return url;
}

/** Report a finite-job failure without changing Cloud Run Job failure semantics. */
export async function runAlertedFiniteJob(
  taskName: string,
  alerting: JobAlertingDeps,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    await alerting.reportTaskFailure(taskName, error).catch(() => undefined);
    throw error;
  }
}
