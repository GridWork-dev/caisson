// The BillingProvider port + provider config-type contracts (ADR-0017) — the OPEN billing seam. Stripe
// was the original driver; ADR-0108 switches the live merchant-of-record to Paddle — both (plus the
// LemonSqueezy/Polar MoR drivers, ADR-0175) implement THIS one port, so a provider swap is a new driver,
// not a rewrite. The port + `CheckoutInput` + every provider's config TYPE stay OPEN here (registry-schema
// precedent) so generated buyer hosts typecheck against open code only; the driver FACTORIES that
// construct them (createStripeBilling/…/createPolarBilling) live in the commercial
// @caisson/billing-orchestration (ADR-0249 G3). The raw-body signature verifiers also stay open (webhook.ts,
// paddle-webhook.ts, lemonsqueezy-webhook.ts, polar-webhook.ts).
import type { VerifyOptions } from "./webhook.ts";
import type { DomainBillingEvent } from "./events.ts";

export interface CheckoutInput {
  accountId: string;
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
}

/** Input for minting an affiliate discount code (ADR-0315). Provider-neutral shape; only the Paddle
 *  driver implements `createDiscount` today (Paddle is the live merchant of record). */
export interface CreateDiscountInput {
  /** The redeemable code (Paddle format: letters + numbers, ≤32 chars, not case-sensitive). */
  code: string;
  /** Internal description (not shown to customers) — the affiliate's name/reference. */
  description: string;
}

export interface BillingProvider {
  /** Verify the raw webhook (throws on bad signature) then map it to a domain event (or null). */
  verifyAndParse(
    rawBody: string,
    signatureHeader: string,
    opts?: VerifyOptions,
  ): DomainBillingEvent | null;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /**
   * Mint a fixed-percentage, checkout-enabled, recurring affiliate discount (ADR-0315) and return
   * its provider discount id + code. OPTIONAL on the port: affiliate minting is Paddle-only (the
   * other MoR drivers — Stripe/LemonSqueezy/Polar — do not implement it), so a caller checks for it
   * before use. Keeps the port provider-neutral without forcing every driver to implement it.
   */
  createDiscount?(
    input: CreateDiscountInput,
  ): Promise<{ discountId: string; code: string }>;
}

export interface StripeConfig {
  webhookSecret: string;
  apiKey: string;
}

export interface PaddleConfig {
  webhookSecret: string;
  apiKey: string;
  /** Selects the Paddle API base url (ADR-0108 `PADDLE_ENV`). Defaults to `production`. */
  env?: "sandbox" | "production";
  /**
   * Optional non-fatal-anomaly signal, threaded through to `parsePaddleEvent`: fired
   * when a partial-refund adjustment's `items[]` carries a malformed or idless entry that gets
   * skipped. `console.log` is banned in product code, so a production caller wires this to its own
   * telemetry/log surface (for example `process.stderr.write`). Unset means the skip
   * stays silent, as before this config existed.
   */
  onWarn?: (message: string) => void;
}

export interface LemonSqueezyConfig {
  apiKey: string;
  webhookSecret: string;
  /** The LemonSqueezy store id — required on every checkout's `relationships.store`. */
  storeId: string;
}

export interface PolarConfig {
  accessToken: string;
  webhookSecret: string;
  /** Selects the Polar API base url. Defaults to `production`. */
  env?: "sandbox" | "production";
}
