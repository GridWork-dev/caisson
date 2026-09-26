#!/usr/bin/env bun
/**
 * Caisson WORM bucket provisioner (ADR-0201, executes the editions-go-live lock).
 *
 * Idempotent: safe to re-run; every step converges. Creates the S3 Object-Lock bucket the
 * `@caisson-sh/audit-worm` S3ArtifactStore live proof (and later production evidence) writes to:
 *   • CreateBucket with ObjectLockEnabledForBucket (versioning implied) — us-east-1 per ADR-0201
 *   • Public-access block (all four gates on)
 *   • A lifecycle reaper on the live-proof tenant prefix (expired GOVERNANCE test versions get
 *     permanently deleted ~1 day after their retention lapses; lifecycle never touches a version
 *     still under lock, so this is a lagged reaper, never a bypass)
 *   • Prints (does NOT create) the scoped prover IAM policy — prover creds stay separate from
 *     product creds; BypassGovernanceRetention is confined to the proof prefix for cleanup only.
 *
 * NO default bucket retention is configured: the adapter sets ObjectLockMode + RetainUntilDate on
 * every PUT (ADR-0054), and a default would silently lock non-adapter writes. COMPLIANCE mode is
 * never provisioned or tested here (ADR-0051 typed opt-in + production gate).
 *
 * Usage: set -a; . ~/.gridwork/env; set +a; bun infra/worm/provision.ts
 * Env:   CAISSON_WORM_BUCKET (default caisson-worm) · AWS_REGION (default us-east-1) · AWS creds
 * Not product code — an operational one-shot (infra/ is outside the package gates).
 */
import {
  CreateBucketCommand,
  GetObjectLockConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.CAISSON_WORM_BUCKET ?? "caisson-worm";
const REGION = process.env.AWS_REGION ?? "us-east-1";

/**
 * The reserved live-proof tenant prefix — a fixed UUID that passes audit-worm's assertSafeKey
 * (`{account_id}/…`) but can never collide with a real account (crypto.randomUUID is v4; this id
 * is outside any real tenant space by convention and recorded in ADR-0201).
 */
export const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";

const s3 = new S3Client({ region: REGION });

function errName(err: unknown): string {
  return typeof err === "object" && err !== null && "name" in err
    ? String((err as { name: unknown }).name)
    : "";
}

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(
      new CreateBucketCommand({
        Bucket: BUCKET,
        ObjectLockEnabledForBucket: true,
        // us-east-1 rejects a LocationConstraint; other regions require one.
        ...(REGION !== "us-east-1"
          ? {
              CreateBucketConfiguration: {
                LocationConstraint: REGION as never,
              },
            }
          : {}),
      }),
    );
    console.log(`created bucket ${BUCKET} (${REGION}, Object Lock enabled)`);
  } catch (err) {
    const name = errName(err);
    if (name === "BucketAlreadyOwnedByYou") {
      console.log(`bucket ${BUCKET} already exists (owned by this account)`);
      return;
    }
    if (name === "BucketAlreadyExists") {
      console.error(
        `bucket name ${BUCKET} is taken globally by another account — set CAISSON_WORM_BUCKET and re-run`,
      );
      process.exit(1);
    }
    throw err;
  }
}

async function assertObjectLock(): Promise<void> {
  const cfg = await s3.send(
    new GetObjectLockConfigurationCommand({ Bucket: BUCKET }),
  );
  const enabled = cfg.ObjectLockConfiguration?.ObjectLockEnabled === "Enabled";
  if (!enabled) {
    console.error(
      `bucket ${BUCKET} exists WITHOUT Object Lock — it cannot serve WORM; pick a fresh CAISSON_WORM_BUCKET`,
    );
    process.exit(1);
  }
  const rule = cfg.ObjectLockConfiguration?.Rule;
  console.log(
    `object lock: Enabled${rule ? ` (default retention present: ${JSON.stringify(rule)})` : " (no default retention — per-object, as designed)"}`,
  );
}

async function ensurePublicAccessBlock(): Promise<void> {
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: BUCKET,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    }),
  );
  console.log("public access block: all four gates on");
}

async function ensureLifecycleReaper(): Promise<void> {
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: BUCKET,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "reap-live-proof",
            Status: "Enabled",
            Filter: { Prefix: `${PROOF_ACCOUNT_ID}/` },
            // Lifecycle never deletes a version still under Object Lock; these fire only after
            // the proof objects' minutes-long GOVERNANCE retention has lapsed (lagged reaper).
            Expiration: { Days: 1 },
            NoncurrentVersionExpiration: { NoncurrentDays: 1 },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          },
        ],
      },
    }),
  );
  console.log(
    `lifecycle reaper on ${PROOF_ACCOUNT_ID}/ (1-day expiry after retention lapses)`,
  );
}

function printProverPolicy(): void {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "WormProverReadWrite",
        Effect: "Allow",
        Action: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObjectRetention",
          "s3:GetObjectRetention",
          "s3:ListBucketVersions",
        ],
        Resource: [
          `arn:aws:s3:::${BUCKET}`,
          `arn:aws:s3:::${BUCKET}/${PROOF_ACCOUNT_ID}/*`,
        ],
      },
      {
        Sid: "WormProverGovernanceCleanupProofPrefixOnly",
        Effect: "Allow",
        Action: ["s3:DeleteObjectVersion", "s3:BypassGovernanceRetention"],
        Resource: [`arn:aws:s3:::${BUCKET}/${PROOF_ACCOUNT_ID}/*`],
      },
    ],
  };
  console.log(
    "\nScoped prover IAM policy (create a dedicated prover user/role with EXACTLY this — ADR-0201):",
  );
  console.log(JSON.stringify(policy, null, 2));
}

await ensureBucket();
await assertObjectLock();
await ensurePublicAccessBlock();
await ensureLifecycleReaper();
printProverPolicy();
console.log(
  `\ndone. live proof: CAISSON_WORM_LIVE_BUCKET=${BUCKET} bun run --cwd packages/audit-worm test:live`,
);
