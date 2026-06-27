// The BillingProvider port (ADR-0017). Stripe lives behind it; a future MoR swap (Paddle/LS) is a
// new driver, not a rewrite. P1 ships verify+parse (the seam that feeds the credit grant); the
// full purchase→entitlement→license→grant orchestration is P6 (services/license).
import { fetchWithTimeout, InternalError } from "@stack/kernel";
import { verifyStripeWebhook, type VerifyOptions } from "./webhook.ts";
import {
  parseStripeEvent,
  type DomainBillingEvent,
  type StripeEvent,
} from "./events.ts";

export interface CheckoutInput {
  accountId: string;
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProvider {
  /** Verify the raw webhook (throws on bad signature) then map it to a domain event (or null). */
  verifyAndParse(
    rawBody: string,
    signatureHeader: string,
    opts?: VerifyOptions,
  ): DomainBillingEvent | null;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
}

export interface StripeConfig {
  webhookSecret: string;
  apiKey: string;
}

export function createStripeBilling(config: StripeConfig): BillingProvider {
  return {
    verifyAndParse(rawBody, signatureHeader, opts) {
      verifyStripeWebhook(rawBody, signatureHeader, config.webhookSecret, opts);
      const event = JSON.parse(rawBody) as StripeEvent;
      return parseStripeEvent(event);
    },

    async createCheckout(input) {
      // Stripe Checkout Session over the REST API (Stripe Tax on; account id in metadata so the
      // webhook can resolve the tenant). Documented path — not exercised in tests.
      const res = await fetchWithTimeout(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            mode: input.mode,
            "line_items[0][price]": input.priceId,
            "line_items[0][quantity]": "1",
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            client_reference_id: input.accountId,
            "metadata[account_id]": input.accountId,
            "automatic_tax[enabled]": "true",
          }).toString(),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) throw new InternalError("Stripe checkout creation failed");
      const data = (await res.json()) as { url?: string };
      if (data.url === undefined)
        throw new InternalError("Stripe returned no checkout url");
      return { url: data.url };
    },
  };
}
