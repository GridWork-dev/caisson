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
import { isBundleId } from "@caisson/registry-schema";

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

/** One granting line of a purchase/cycle — the SKU attribution for the `purchase` event.
 *  `productSlug` is the CANONICAL catalog id (a bundle id from `BUNDLE_IDS`, a
 *  `<slug>_module`, or a bare tag like `credit_pack`) — apply-billing-event normalizes the
 *  pricebook's legacy tag through `normalizeEntitlementId` before it lands here, so a legacy
 *  edition tag (`ai-kit`, `local-ai`, …) is stamped as its bundle id (`ai-production`, …) and a
 *  price-id rotation never breaks revenue-by-SKU breakdowns. Renewal lines grant nothing and carry
 *  no SkuLine (their charge still rides in `amountTotalMinor`). */
export interface SkuLine {
  /** The provider price id charged for this line. */
  priceId: string;
  /** Canonical catalog slug — already bundle-normalized (see above). */
  productSlug: string;
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
  /** Per-line SKU attribution, threaded from `applyBillingEvent`. `[]` only for a
   *  lineless grant (defensive — a real money capture always fires on a granting line). */
  skuLines: readonly SkuLine[];
}

/** Cart-composition bucket for a set of canonical SKU slugs. `"mixed"` when the cart spans more
 *  than one bucket (e.g. an edition line plus an à-la-carte module in one checkout); `undefined`
 *  for a lineless grant. Reads the same catalog vocabulary the pricebook attributes with — a bundle
 *  id (`BUNDLE_IDS`) is a bundle, a `_module` suffix is a module, everything else is other. */
function cartComposition(
  lines: readonly SkuLine[],
): "bundle" | "modules" | "other" | "mixed" | undefined {
  if (lines.length === 0) return undefined;
  const buckets = new Set(
    lines.map((line) =>
      isBundleId(line.productSlug)
        ? "bundle"
        : line.productSlug.endsWith("_module")
          ? "modules"
          : "other",
    ),
  );
  return buckets.size === 1 ? [...buckets][0] : "mixed";
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
            // SKU attribution — revenue broken down by price id / canonical product /
            // bundle-vs-à-la-carte in PostHog. `cart_composition` is `undefined` (JSON.stringify
            // drops the key) for a lineless grant.
            price_ids: capture.skuLines.map((line) => line.priceId),
            product_slugs: capture.skuLines.map((line) => line.productSlug),
            cart_composition: cartComposition(capture.skuLines),
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
