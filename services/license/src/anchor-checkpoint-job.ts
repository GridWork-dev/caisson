// Replay-safe audit-anchor checkpoint pass. Cloud Tasks invokes this finite Cloud Run Job; the
// durable outbox/receipt state prevents a replay from publishing the same anchor twice.
import { S3Client } from "@aws-sdk/client-s3";
import {
  AnchorOutbox,
  AuditChainStore,
  defineAnchorCheckpointTask,
  S3ArtifactStore,
  TsaAnchorLog,
  type AnchorCheckpointDeps,
} from "@caisson/audit-worm";
import { createInMemoryQueue, type JobAlertingDeps } from "@caisson/jobs";
import {
  createPgPool,
  createPgTransactor,
  type Transactor,
} from "@caisson/tenancy-rls";
import {
  ANCHOR_CHECKPOINT_TICK_TASK,
  runAnchorCheckpointTick,
} from "./anchoring-scheduler.ts";
import { createJobAlertingDeps, loadOpsAlertChannels } from "./alerting.ts";
import { requireJobDatabaseUrl, runAlertedFiniteJob } from "./finite-job.ts";

export interface AnchorCheckpointJobDeps {
  db: Transactor;
  checkpoint: AnchorCheckpointDeps;
  alerting: JobAlertingDeps;
}

export async function runAnchorCheckpointJob(
  deps: AnchorCheckpointJobDeps,
): Promise<void> {
  const queue = createInMemoryQueue([
    defineAnchorCheckpointTask(deps.checkpoint),
  ]);
  await runAlertedFiniteJob(
    ANCHOR_CHECKPOINT_TICK_TASK,
    deps.alerting,
    async () => runAnchorCheckpointTick(deps.db, queue),
  );
}

function createCheckpointDeps(
  db: Transactor,
  env: Record<string, string | undefined>,
): AnchorCheckpointDeps {
  const target = (env.CAISSON_ANCHOR_TARGET?.trim() || "tsa").toLowerCase();
  if (target !== "tsa") {
    throw new Error(
      "CAISSON_ANCHOR_TARGET must be tsa until the public-log deployment gate is wired",
    );
  }
  const bucket = env.CAISSON_WORM_BUCKET?.trim() ?? "";
  const tsaUrl = env.CAISSON_TSA_URL?.trim() ?? "";
  if (bucket === "" || tsaUrl === "") {
    throw new Error(
      "CAISSON_WORM_BUCKET and CAISSON_TSA_URL are required for the anchor-checkpoint job",
    );
  }
  const store = new S3ArtifactStore({
    client: new S3Client({ region: env.AWS_REGION ?? "us-east-1" }),
    bucket,
  });
  return {
    store,
    outbox: new AnchorOutbox(db),
    log: new TsaAnchorLog({ url: tsaUrl }),
    reader: new AuditChainStore({ db, store }),
    target: { kind: "tsa", url: tsaUrl, grade: "trusted-timestamped" },
  };
}

export async function main(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const pool = createPgPool(requireJobDatabaseUrl(env));
  const db = createPgTransactor(pool);
  try {
    await runAnchorCheckpointJob({
      db,
      checkpoint: createCheckpointDeps(db, env),
      alerting: createJobAlertingDeps(loadOpsAlertChannels(env)),
    });
  } finally {
    await pool.end();
  }
}

if (import.meta.main) await main();
