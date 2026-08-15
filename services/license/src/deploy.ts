// src/deploy.ts — the production deploy entrypoint (Stage-2, ADR-0110/0139). server.ts's
// `import.meta.main` is a deliberate hard stop: `startServer(db)` takes the tenant Transactor as an
// injected argument and the repo has no in-tree production Postgres pool. This file supplies one — a
// node-postgres Pool over DATABASE_URL wrapped in a Transactor — and calls startServer(db).
//
// The Pool→Transactor factory is INLINED, not imported from apps/site/lib/db.ts (that module is
// Next-coupled: a globalThis HMR singleton + a PGlite dev double + an eager drizzle handle). It is a
// ~15-line twin of that factory; the security-critical `SET LOCAL ROLE app` runs inside the SHARED
// `withTenant` (@caisson/tenancy-rls), NOT here — so the two copies can only ever diverge on
// transaction plumbing, never on tenant isolation.
// ponytail: two consumers, one Next-specific — lift into @caisson/tenancy-rls only if a THIRD
// headless service needs the same Pool→Transactor adapter.
import { S3Client } from "@aws-sdk/client-s3";
import {
  AnchorOutbox,
  AuditChainStore,
  S3ArtifactStore,
  TsaAnchorLog,
  type AnchorCheckpointDeps,
} from "@caisson/audit-worm";
import { createPgTransactor } from "@caisson/tenancy-rls";
import { Pool } from "pg";
import {
  loadAbandonedCheckoutScheduleConfig,
  startAbandonedCheckoutScheduler,
} from "./abandoned-checkout-scheduler.ts";
import { createJobAlertingDeps, loadOpsAlertChannels } from "./alerting.ts";
import {
  loadAnchorCheckpointScheduleConfig,
  startAnchorCheckpointScheduler,
} from "./anchoring-scheduler.ts";
import {
  loadCreditExpiryScheduleConfig,
  startCreditExpiryScheduler,
} from "./credit-expiry-scheduler.ts";
import { recipientFor, resolveEmailer } from "./email-notify.ts";
import { loadPostHogCaptureConfig } from "./posthog-capture.ts";
import { startServer } from "./server.ts";

if (import.meta.main) {
  // Fail closed: a production issuer must NEVER fall back to an in-memory PGlite double the way
  // apps/site's dev-only getDb does. An unset DATABASE_URL aborts startup before the socket binds,
  // matching server.ts's fail-closed posture on the token + signing key. Never log the URL.
  const url = process.env.DATABASE_URL ?? "";
  if (url.length === 0) {
    throw new Error(
      "DATABASE_URL is required (the license issuer needs a Postgres Transactor) — refusing to start.",
    );
  }
  const pool = new Pool({ connectionString: url });
  const db = createPgTransactor(pool);
  // Bun.serve inside startServer holds the event loop open — the process stays up serving.
  startServer(db);

  // ADR-0256: inert until armed — CREDIT_EXPIRY_SCHEDULE unset resolves immediately with zero
  // pg-boss connection ever opened. Fire-and-forget (never awaited): a slow or failed scheduler
  // start must never delay or block the webhook/issuer socket already bound above, and the
  // function's own try/catch means this can never become an unhandled rejection.
  void startCreditExpiryScheduler({
    db,
    connectionString: url,
    schedule: loadCreditExpiryScheduleConfig(),
    // The real @caisson/email transport (email-notify.ts) — Resend when RESEND_API_KEY is set, the
    // capture driver otherwise. `recipientFor` resolves the buyer's address the same way the
    // post-purchase confirmation does (account_member → better-auth's user table).
    emailer: resolveEmailer(),
    recipientFor: (accountId) => recipientFor(db, accountId),
    dashboardUrl: "https://caisson.sh/dashboard/credits",
    // G24: the updates-window expiry notice's own CTA — a different dashboard page than credits.
    updatesWindowDashboardUrl: "https://caisson.sh/dashboard/license",
    // Alerts on a sweep/notice/tick task failure or a pg-boss infra error. Empty when
    // DISCORD_OPS_WEBHOOK_URL is unset — the same fail-safe-absent posture as every other env-gated
    // notifier in this file.
    alerting: createJobAlertingDeps(loadOpsAlertChannels()),
  });

  // Abandoned-checkout email (SPEC-abandoned-checkout-email.md, 2026-07-10 lock): inert until
  // armed — ABANDONED_CHECKOUT_SCHEDULE unset resolves immediately with zero pg-boss connection
  // ever opened. Fire-and-forget, same posture as the credit-expiry scheduler above.
  void startAbandonedCheckoutScheduler({
    db,
    connectionString: url,
    schedule: loadAbandonedCheckoutScheduleConfig(),
    emailer: resolveEmailer(),
    posthog: loadPostHogCaptureConfig(),
    alerting: createJobAlertingDeps(loadOpsAlertChannels()),
  });

  // External-anchoring checkpoint sweep (services/license host): inert until
  // ANCHOR_CHECKPOINT_SCHEDULE is armed. Unset → construct NOTHING (no S3 client, no TSA client) and
  // nothing runs, byte-for-byte today's behavior — so we gate the whole construction on the schedule
  // rather than eagerly build the (env-requiring, throwing) deps just to pass `schedule: null`.
  // Armed but missing the WORM bucket or TSA url follows the scheduler's fail-safe-absent posture:
  // one stderr line, skip the sweep, NEVER crash the issuer (commerce/webhook outranks the
  // checkpoint). Fire-and-forget, same posture as the schedulers above.
  const anchorSchedule = loadAnchorCheckpointScheduleConfig();
  if (anchorSchedule !== null) {
    // Target selection (inert-until-armed): TSA is the default and the ONLY grade wired at this deploy.
    // The public-log `externally-transparent` grade (Rekor v2 / OpenTimestamps) is a SEPARATE,
    // operator-gated DEPLOY step — it additionally needs a deployment SigningConfig + TrustedRoot, the
    // CAISSON_REKOR_ANCHORING_KEY, and the typed irreversible-publicity opt-in (docs/security/
    // external-anchoring.md). Unset CAISSON_ANCHOR_TARGET → "tsa" → byte-identical to today. A non-TSA
    // selection FAILS SAFE (skip, never silently anchor to TSA under a public-log label; commerce
    // outranks the sweep either way).
    const anchorTarget = (
      process.env.CAISSON_ANCHOR_TARGET?.trim() || "tsa"
    ).toLowerCase();
    const wormBucket = process.env.CAISSON_WORM_BUCKET?.trim() ?? "";
    const tsaUrl = process.env.CAISSON_TSA_URL?.trim() ?? "";
    if (anchorTarget !== "tsa") {
      process.stderr.write(
        `[service-license] CAISSON_ANCHOR_TARGET=${anchorTarget} selects public-log (externally-transparent) anchoring, an operator-gated DEPLOY step not wired at this deploy — skipping the anchor-checkpoint sweep. See docs/security/external-anchoring.md.\n`,
      );
    } else if (wormBucket === "" || tsaUrl === "") {
      process.stderr.write(
        "[service-license] ANCHOR_CHECKPOINT_SCHEDULE is set but CAISSON_WORM_BUCKET and/or CAISSON_TSA_URL is missing — skipping the anchor-checkpoint sweep (commerce outranks it).\n",
      );
    } else {
      // ONE S3 WORM store, shared by the reader (reads each tenant's current anchor) and the handler
      // (writes the receipt): both MUST target the bucket the audit chain anchored into. Region via
      // the standard AWS env chain, mirroring apps/admin's wormStore().
      const store = new S3ArtifactStore({
        client: new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" }),
        bucket: wormBucket,
      });
      const checkpoint: AnchorCheckpointDeps = {
        store,
        outbox: new AnchorOutbox(db),
        // TsaAnchorLog owns its own fetchWithTimeout egress (20s default) — never double-wrapped.
        log: new TsaAnchorLog({ url: tsaUrl }),
        // AuditChainStore satisfies CurrentAnchorReader via readCurrentAnchor; SAME store as above.
        reader: new AuditChainStore({ db, store }),
        target: { kind: "tsa", url: tsaUrl, grade: "trusted-timestamped" },
      };
      void startAnchorCheckpointScheduler({
        db,
        connectionString: url,
        schedule: anchorSchedule,
        checkpoint,
        alerting: createJobAlertingDeps(loadOpsAlertChannels()),
      });
    }
  }
}
