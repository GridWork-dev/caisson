// The post-webhook operator alert for a Paddle chargeback/dispute (ADR-0294). Alert-only by
// design: no automated revocation — an operator reviews the case and, if warranted, acts through
// the existing admin `purchase_revoke` lever (ADR-0225). Same never-throw, detached, post-commit
// contract as discord-notify.ts / posthog-capture.ts: the money path (Paddle's 2xx) must never
// depend on this succeeding, and the grant/revoke path is untouched either way (a chargeback
// grants/revokes/claws NOTHING — see apply-billing-event.ts).
//
// The PRIMARY channel is the stderr ALERT line every operator-attention event in this service
// already uses (webhook.ts's unattributed-account alert, provider.ts's `onWarn`) — operator-visible,
// scraped by the platform's log alerting, zero extra configuration required. A Discord "Incoming
// Webhook" (a bare capability URL — no bot/bearer needed, unlike SUPPORT_BOT_URL's role-grant
// proxy) layers on top when configured, posting directly rather than round-tripping the
// support-bot (which has no generic alert route today, only the entitlement-shaped
// `/billing-grant`). ALWAYS wired by server.ts (never `null`, mirroring `purchaseEmailNotify`) so
// the stderr floor fires unconditionally — the ADR's "alert the operator" guarantee never
// silently degrades to nothing just because Discord is unconfigured.
import { fetchWithTimeout } from "@caisson/kernel";

export interface ChargebackAlertConfig {
  /** A Discord "Incoming Webhook" URL (capability URL — carries its own auth, no bearer needed). */
  webhookUrl: string;
}

/** Resolve the Discord layer's config from env; `null` (Discord posting disabled — the stderr
 *  ALERT still fires) unless `DISCORD_CHARGEBACK_ALERT_WEBHOOK_URL` is set. */
export function loadChargebackAlertConfig(
  env: Record<string, string | undefined> = process.env,
): ChargebackAlertConfig | null {
  const webhookUrl = env.DISCORD_CHARGEBACK_ALERT_WEBHOOK_URL?.trim() ?? "";
  return webhookUrl === "" ? null : { webhookUrl };
}

export interface ChargebackAlert {
  accountId: string;
  /** The disputed transaction id, for support/Paddle-dashboard cross-reference. */
  paymentId: string;
  /** Disputed amount, minor units (integer cents, ADR-0007). */
  amountDisputed: number;
  /** ISO currency code, e.g. "usd". */
  currency: string;
}

function formatAlert(alert: ChargebackAlert): string {
  return (
    `chargeback/dispute detected — account ${alert.accountId}, transaction ${alert.paymentId}, ` +
    `${(alert.amountDisputed / 100).toFixed(2)} ${alert.currency.toUpperCase()}. Paddle absorbs ` +
    "the dispute; no entitlement was touched automatically (ADR-0294) — review and act via the " +
    "admin purchase-revoke action if warranted."
  );
}

/**
 * Fire the chargeback operator alert. NEVER throws. Always logs the stderr ALERT line (the
 * guaranteed floor, even with no Discord layer configured); additionally posts to the Discord
 * Incoming Webhook when `config` is set — a failure of that OPTIONAL layer never masks the
 * stderr line already written.
 */
export async function notifyChargebackAlert(
  config: ChargebackAlertConfig | null,
  alert: ChargebackAlert,
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<void> {
  process.stderr.write(`[service-license] ALERT: ${formatAlert(alert)}\n`);
  if (config === null) return;
  try {
    const res = await fetchImpl(
      config.webhookUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: `:rotating_light: ${formatAlert(alert)}`,
        }),
      },
      { timeoutMs: 10_000 },
    );
    if (!res.ok) {
      process.stderr.write(
        `[service-license] chargeback discord alert non-2xx (${String(res.status)}) for account ${alert.accountId}\n`,
      );
    }
  } catch {
    process.stderr.write(
      `[service-license] chargeback discord alert failed for account ${alert.accountId}\n`,
    );
  }
}
