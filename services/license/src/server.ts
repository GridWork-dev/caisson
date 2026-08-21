// src/server.ts — the runnable license-issuer entrypoint (ADR-0110). Mirrors services/docs/src/server.ts:
// build deps ONCE at boot, serve the router over Bun.serve, and FAIL CLOSED before binding a socket.
// The issuer refuses to start without BOTH (1) the `LICENSE_ISSUE_TOKEN` Bearer (POST /issue is gated)
// and (2) the signing key (`Ed25519Signer.fromEnv` throws a ConfigError on a missing/malformed/
// non-Ed25519 `CAISSON_LICENSE_SIGNING_KEY`) — an unconfigured issuer must never serve an open or
// unsigned /issue.
//
// The tenant Transactor is INJECTED (the repo wires `db: Transactor` at each billing/runtime seam and
// uses PGlite in tests; there is no in-repo production Postgres pool). The deploy entrypoint
// supplies a Neon-backed Transactor; the signing key → KMS swap (un-wired Signer seam) is the same
// operator-gated DEPLOY concern as the docs-service real-embedder seam.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BillingProvider } from "@caisson/billing";
import { createPaddleBilling } from "@caisson/billing-orchestration";
import { loadOriginGateConfig } from "@caisson/kernel/node";
import { Ed25519Signer } from "@caisson/license-issue";
import { initObservability } from "@caisson/observability";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import { createApp } from "./app.ts";
import { createRateLimiterAlert, loadOpsAlertChannels } from "./alerting.ts";
import { hasRecentAbandonedCheckoutNotice } from "./checkout-abandonment-store.ts";
import {
  type ChargebackAlert,
  loadChargebackAlertConfig,
  notifyChargebackAlert,
} from "./chargeback-notify.ts";
import {
  type DiscordGrantPush,
  loadDiscordNotifyConfig,
  notifyDiscordGrant,
} from "./discord-notify.ts";
import { loadEvalSignalsConfig, resolveDomainSignals } from "./eval-signals.ts";
import { loadEvalConfig } from "./eval-verification.ts";
import {
  notifyPurchaseEmail,
  notifyRenewalEmail,
  notifyRevokeEmail,
  resolveEmailer,
  type PurchaseEmailNotice,
  type RenewalEmailNotice,
  type RevokeEmailNotice,
} from "./email-notify.ts";
import {
  capturePostHogAbandonedCheckoutConverted,
  capturePostHogPurchase,
  loadPostHogCaptureConfig,
  type PurchaseCapture,
} from "./posthog-capture.ts";
import { loadRateLimitConfig, TokenBucketLimiter } from "./rate-limit.ts";

const DEFAULT_PORT = 8789;

/** Resolve the built registry index baked into the repo (the same file the registry Worker serves). */
function defaultIndexPath(): string {
  // turbopackIgnore: the dynamic import.meta.dir resolve would otherwise make Next's NFT tracing
  // (apps/site → dist/server.js) treat the whole project as traced.
  return resolve(
    /* turbopackIgnore: true */ import.meta.dir,
    "../../../registry/index.json",
  );
}

export interface StartServerOptions {
  /** Override the registry index path (defaults to the repo's built `registry/index.json`). */
  indexPath?: string;
}

/**
 * Start the issuer. Fails closed: a missing `LICENSE_ISSUE_TOKEN` OR a missing/invalid signing seed
 * aborts startup BEFORE the socket binds. The `db` Transactor is injected by the deploy entrypoint.
 */
export function startServer(
  db: Transactor,
  options: StartServerOptions = {},
): { port: number; stop: () => void } {
  // ADR-0117: wired first, before any other boot work — instrumentation must be live before the
  // modules it patches (node:http, pg) are first required. Env-gated: a no-op when
  // OTEL_EXPORTER_OTLP_ENDPOINT is unset (CI / local / no OTLP sink configured).
  initObservability({ serviceName: "service-license" });

  // Parse the fail-closed origin gate before any credential or index work. An absent mode is armed,
  // so missing or malformed secret material aborts before Bun binds a socket.
  const originGate = loadOriginGateConfig(process.env);

  const token = process.env.LICENSE_ISSUE_TOKEN ?? "";
  if (token.length === 0) {
    throw new Error(
      "LICENSE_ISSUE_TOKEN is required (POST /issue is fail-closed) — refusing to start.",
    );
  }
  // The distinct admin-scoped issue credential (ADR-0220 Fork AM-5): when set, the apps/admin
  // reissue proxy may authorize POST /issue with it WITHOUT holding LICENSE_ISSUE_TOKEN. Optional —
  // unset ⇒ no admin path (a normal issuer deploy). Never defaults to the primary token.
  const adminToken = process.env.ADMIN_ISSUE_TOKEN ?? "";
  // Throws ConfigError if CAISSON_LICENSE_SIGNING_KEY is missing/malformed/non-Ed25519 (never echoes it).
  const signer = Ed25519Signer.fromEnv();
  // Read the index BYTES once so the /health parity digest (the F-1 index-parity residual) is over the exact bytes this
  // service loaded — the same file the registry Worker + admin bake, so a drifted copy shows as a
  // digest mismatch. sha256 first-12-hex matches `registry/scripts/index-parity-probe.ts#indexDigest12`.
  const indexPath = options.indexPath ?? defaultIndexPath();
  const indexBytes = readFileSync(indexPath);
  const index = loadRegistryIndex(JSON.parse(indexBytes.toString("utf8")));
  const indexDigest = createHash("sha256")
    .update(indexBytes)
    .digest("hex")
    .slice(0, 12);
  const indexEntries = index.modules.length;

  // Paddle Merchant-of-Record webhook provider (ADR-0108/0116). It verifies the `Paddle-Signature` HMAC
  // over the raw body; the apiKey is only used by the (unexercised) checkout path, so a webhook-only
  // deploy may leave it blank. Without PADDLE_WEBHOOK_SECRET we cannot verify any signature, so the
  // provider is null and POST /webhook fails closed (401) — /issue + /health still serve.
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  let provider: BillingProvider | null = null;
  if (webhookSecret.length > 0) {
    const paddleEnv =
      process.env.PADDLE_ENV === "sandbox" ? "sandbox" : "production";
    provider = createPaddleBilling({
      webhookSecret,
      apiKey: process.env.PADDLE_API_KEY ?? "",
      env: paddleEnv,
      // A malformed partial-refund adjustment item is a non-fatal anomaly, not a fatal
      // error — surface it on the same operator-visible stderr surface every other non-fatal signal
      // in this service uses (console.log is banned in product code).
      onWarn: (message) =>
        process.stderr.write(`[service-license] ${message}\n`),
    });
  } else {
    process.stderr.write(
      "[service-license] PADDLE_WEBHOOK_SECRET unset — POST /webhook is fail-closed (401)\n",
    );
  }

  // Per-IP token-bucket limiter (services-hardening #4) for POST /webhook + POST /issue. Config is
  // Zod-validated from env with safe defaults; a present-but-invalid limit fails startup closed rather
  // than serving with a silently-wrong budget.
  const limiter = new TokenBucketLimiter(loadRateLimitConfig());
  const rateLimiterAlert = createRateLimiterAlert(loadOpsAlertChannels());

  // Post-grant Discord role push (ADR-0203): wired only when SUPPORT_BOT_URL +
  // SUPPORT_BOT_GRANT_TOKEN are both set; otherwise the webhook grants exactly as before and the
  // push is skipped (config-gated, never a startup failure — Discord is not on the money path).
  const notifyConfig = loadDiscordNotifyConfig();
  const discordNotify =
    notifyConfig === null
      ? null
      : (push: DiscordGrantPush): Promise<void> =>
          notifyDiscordGrant(db, notifyConfig, push);
  if (notifyConfig === null) {
    process.stderr.write(
      "[service-license] SUPPORT_BOT_URL/SUPPORT_BOT_GRANT_TOKEN unset — discord role push disabled\n",
    );
  }

  // Server-side PostHog purchase capture (ADR-0237 F8): wired only when POSTHOG_CAPTURE_KEY is
  // set; otherwise the webhook grants exactly as before and the capture is skipped (config-gated,
  // never a startup failure — analytics is not on the money path).
  const posthogConfig = loadPostHogCaptureConfig();
  const posthogCapture =
    posthogConfig === null
      ? null
      : (capture: PurchaseCapture): Promise<void> =>
          capturePostHogPurchase(posthogConfig, capture);
  if (posthogConfig === null) {
    process.stderr.write(
      "[service-license] POSTHOG_CAPTURE_KEY unset — posthog purchase capture disabled\n",
    );
  }

  // Abandoned-checkout conversion capture (SPEC-abandoned-checkout-email.md §e, 2026-07-10 lock):
  // same config gate as posthogCapture — a granting purchase checks whether this account has a
  // RECENT abandoned-checkout notice before firing `abandoned_checkout_converted`, reading the
  // same marker table the scheduler's sweep writes. Never throws (both the tenant read and the
  // capture itself fail closed to a no-op).
  const abandonedCheckoutConverted =
    posthogConfig === null
      ? null
      : async (accountId: string): Promise<void> => {
          const recent = await withTenant(db, accountId, (tx) =>
            hasRecentAbandonedCheckoutNotice(tx, accountId),
          ).catch(() => false);
          if (recent) {
            await capturePostHogAbandonedCheckoutConverted(posthogConfig, {
              accountId,
            });
          }
        };

  // Post-grant purchase-confirmation email: ALWAYS wired, unlike discordNotify/posthogCapture —
  // resolveEmailer() falls back to the in-memory capture driver when RESEND_API_KEY is unset, so
  // an unconfigured deploy never crashes and never silently hits the network (mirrors
  // apps/site/lib/auth-server.ts's own resolveEmailer).
  const emailer = resolveEmailer();
  const purchaseEmailNotify = (notice: PurchaseEmailNotice): Promise<void> =>
    notifyPurchaseEmail(db, emailer, notice);
  // Post-grant renewal-confirmation email (ADR-0251): the SIBLING send for a RENEWAL_BOOK line,
  // sharing the SAME emailer instance (Resend or the capture driver) — no separate env gate.
  const renewalEmailNotify = (notice: RenewalEmailNotice): Promise<void> =>
    notifyRenewalEmail(db, emailer, notice);
  // G27: the post-revoke notice, same shared emailer instance.
  const revokeEmailNotify = (notice: RevokeEmailNotice): Promise<void> =>
    notifyRevokeEmail(db, emailer, notice);
  if ((process.env.RESEND_API_KEY?.trim() ?? "") === "") {
    process.stderr.write(
      "[service-license] RESEND_API_KEY unset — purchase confirmation emails are captured, not sent\n",
    );
  }

  // Chargeback/dispute operator alert (ADR-0294): ALWAYS wired, unlike discordNotify/posthogCapture
  // — notifyChargebackAlert itself always logs the stderr ALERT floor and additionally posts to a
  // Discord Incoming Webhook when DISCORD_CHARGEBACK_ALERT_WEBHOOK_URL is set.
  const chargebackAlertConfig = loadChargebackAlertConfig();
  const chargebackAlert = (alert: ChargebackAlert): Promise<void> =>
    notifyChargebackAlert(chargebackAlertConfig, alert);
  if (chargebackAlertConfig === null) {
    process.stderr.write(
      "[service-license] DISCORD_CHARGEBACK_ALERT_WEBHOOK_URL unset — chargeback alerts log to stderr only\n",
    );
  }

  // Evaluation-access surface (ADR-0274 §2 / ADR-0280). Config is Zod-validated from env with
  // fail-closed-safe defaults (a bad threshold fails startup closed). The signals resolver is
  // config-gated: with EVAL_RDAP_URL / EVAL_ENRICHMENT_URL unset there is NO outbound HTTP — the
  // scorer runs on MX (DNS) alone and every non-obvious applicant lands in the review queue
  // (fail-toward-manual). The eval tables are provisioned at the operator-gated admin DEPLOY; if
  // they are absent, /eval/* returns 500 on a DB miss (the routes are always wired here — the null
  // gate in app.ts exists for a deliberately eval-less deploy, which this default one is not).
  const evalConfig = loadEvalConfig();
  const evalSignalsConfig = loadEvalSignalsConfig();
  if (
    evalSignalsConfig.rdapBaseUrl.length === 0 &&
    evalSignalsConfig.enrichmentUrl.length === 0
  ) {
    process.stderr.write(
      "[service-license] EVAL_RDAP_URL/EVAL_ENRICHMENT_URL unset — eval scoring uses MX only (borderline → review queue)\n",
    );
  }

  // `||` not `??`: a blank PORT="" must fall back to the default, not coerce to Number("")=0 (ephemeral).
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const handler = createApp({
    token,
    adminToken,
    signer,
    index,
    db,
    provider,
    limiter,
    rateLimiterAlert,
    discordNotify,
    posthogCapture,
    abandonedCheckoutConverted,
    purchaseEmailNotify,
    renewalEmailNotify,
    revokeEmailNotify,
    chargebackAlert,
    indexDigest,
    indexEntries,
    eval: {
      config: evalConfig,
      resolveSignals: (domain: string) =>
        resolveDomainSignals(domain, evalSignalsConfig),
    },
    originGate,
  });
  // maxRequestBodySize caps every route BEFORE buffering (CWE-770, Kickoff-K): POST /webhook reads the
  // raw body for HMAC verification (the signature IS the auth), so the body is buffered pre-credential;
  // Bun's 128 MiB default is ~250x any real Paddle event. 512 KiB is generous for /webhook, /issue,
  // /eval/* while sitting far below the default — matches the repo's MAX_BODY_BYTES idiom.
  const server = Bun.serve({
    port,
    fetch: handler,
    maxRequestBodySize: 512 * 1024,
  });
  process.stderr.write(
    `[service-license] issuer serving on :${String(server.port)}\n`,
  );
  return { port: server.port ?? port, stop: () => server.stop(true) };
}

if (import.meta.main) {
  // The deploy entrypoint must inject a Neon-backed Postgres Transactor (the repo has no in-tree
  // production pool — `db: Transactor` is injected everywhere, PGlite in tests). Wiring it is the
  // operator-gated DEPLOY act, not a build concern.
  throw new Error(
    "service-license issuer: wire a Postgres Transactor and call startServer(db) from the deploy entrypoint.",
  );
}
