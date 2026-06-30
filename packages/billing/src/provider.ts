// The BillingProvider port (ADR-0017). Stripe lives behind it; a future MoR swap (Paddle/LS) is a
// new driver, not a rewrite. P1 ships verify+parse (the seam that feeds the credit grant); the
// full purchase→entitlement→license→grant orchestration is P6 (services/license).
import { fetchWithTimeout, InternalError } from "@caisson/kernel";
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
      // account id on BOTH the session (for the one-time checkout.session.completed path) AND, for a
      // subscription, on subscription_data[metadata] — Stripe reflects that onto every cycle invoice's
      // subscription_details.metadata, the only stable place the recurring-grant webhook can read it
      // (session metadata / client_reference_id do NOT propagate to invoices) — ADR-0089.
      const params: Record<string, string> = {
        mode: input.mode,
        "line_items[0][price]": input.priceId,
        "line_items[0][quantity]": "1",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.accountId,
        "metadata[account_id]": input.accountId,
        "automatic_tax[enabled]": "true",
      };
      if (input.mode === "subscription") {
        params["subscription_data[metadata][account_id]"] = input.accountId;
      } else {
        // One-time (payment) checkout (ADR-0109). The session carries no webhook-readable line items
        // without expansion, so stamp the price id on the SESSION metadata for the purchase->grant
        // resolution. Stamp account id (and price id) on `payment_intent_data[metadata]` too: Stripe
        // copies PaymentIntent metadata onto the Charge, so a later `charge.refunded` can resolve the
        // tenant + join back to this purchase by the PaymentIntent id (the refund clawback path).
        params["metadata[price_id]"] = input.priceId;
        params["payment_intent_data[metadata][account_id]"] = input.accountId;
        params["payment_intent_data[metadata][price_id]"] = input.priceId;
      }
      const res = await fetchWithTimeout(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(params).toString(),
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
