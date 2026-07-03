// Server-side PostHog `purchase` capture (ADR-0237 F8: purchase + revenue land server-side in the
// webhook grant path, project caisson-prod — PostHog JS stays dashboard-only, the marketing site
// stays cookieless Plausible per ADR-0118). Same binding contract as the Discord push (ADR-0203
// template):
//   • NEVER throws — the money path (Paddle's 2xx) must not depend on PostHog availability; every
//     failure collapses to one stderr line and the event is simply lost.
//   • Config-gated — `POSTHOG_CAPTURE_KEY` unset ⇒ server.ts injects no capturer and nothing runs.
//   • Post-commit + re-delivery-safe for free: the caller gates on grantedEntitlements.length > 0,
//     and a Paddle re-delivery short-circuits on the grant claim with an empty grant list, so a
//     purchase is captured exactly once per durable grant.
import { fetchWithTimeout } from "@caisson/kernel";

export interface PostHogCaptureConfig {
  /** The PostHog project API key (`phc_…`) — a write-only ingestion key, not a personal key. */
  key: string;
  /** Ingestion host, no trailing slash. */
  host: string;
}

/** Resolve the capture config from env; `null` (capture disabled) unless the key is set. */
export function loadPostHogCaptureConfig(
  env: Record<string, string | undefined> = process.env,
): PostHogCaptureConfig | null {
  const key = env.POSTHOG_CAPTURE_KEY?.trim() ?? "";
  if (key === "") return null;
  const host = env.POSTHOG_CAPTURE_HOST?.trim() || "https://us.i.posthog.com";
  return { key, host: host.replace(/\/+$/, "") };
}

export interface PurchaseCapture {
  /** The buyer account id — the PostHog distinct_id (matches the dashboard identify()). */
  accountId: string;
  /** The DISTINCT purchased entitlement ids this grant landed. */
  entitlements: readonly string[];
  /** Charged grand total in minor units (Paddle cents), integer (ADR-0007). */
  amountTotalMinor: number;
  /** ISO currency code, e.g. "usd". */
  currency: string;
  /** The provider event id — kept as a property for cross-referencing Paddle deliveries. */
  sourceEventId: string;
}

/**
 * Fire one `purchase` event at PostHog's capture endpoint. Never throws; a non-2xx or network
 * failure is one stderr line. `revenue` is a decimal for PostHog's revenue analytics — an
 * analytics REPORT of money already moved by Paddle, not money movement (the integer-money rule
 * governs ledgers; the integer source of truth rides along as amount_minor).
 */
export async function capturePostHogPurchase(
  config: PostHogCaptureConfig,
  capture: PurchaseCapture,
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<void> {
  try {
    const res = await fetchImpl(
      `${config.host}/capture/`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.key,
          event: "purchase",
          distinct_id: capture.accountId,
          properties: {
            revenue: capture.amountTotalMinor / 100,
            amount_minor: capture.amountTotalMinor,
            currency: capture.currency,
            entitlements: capture.entitlements,
            entitlement_count: capture.entitlements.length,
            source_event_id: capture.sourceEventId,
          },
        }),
      },
      { timeoutMs: 10_000 },
    );
    if (!res.ok) {
      process.stderr.write(
        `[service-license] posthog capture non-2xx: ${String(res.status)}\n`,
      );
    }
  } catch {
    process.stderr.write("[service-license] posthog capture failed\n");
  }
}
