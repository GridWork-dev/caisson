// Polar billing driver + event mapper (ADR-0175) — a customer-facing Merchant-of-Record `BillingProvider`
// driver. Polar->domain event mapping + REST checkout creation. The raw-body Standard Webhooks signature
// verifier (`verifyPolarWebhook`) stays OPEN in @caisson-sh/billing (uniform rule: signature-verify open
// for all four providers); this file composes it (ADR-0249 G3). NO new dependency —
// hand-rolled over Polar's REST API, mirroring the Stripe/Paddle drivers' no-SDK posture. Dormant: only
// constructed when the adopter supplies credentials. Platform MoR stays Paddle (ADR-0116).
import { z } from "zod";
import { readIdString, readInt, readString } from "./event-readers.ts";
import {
  ConfigError,
  InternalError,
  fetchWithTimeout,
  parseStrict,
  strictObject,
} from "@caisson-sh/kernel";
import {
  verifyPolarWebhook,
  type BillingProvider,
  type PolarConfig,
  type DomainBillingEvent,
} from "@caisson-sh/billing";

function polarApiBase(env: PolarConfig["env"]): string {
  return env === "sandbox"
    ? "https://sandbox-api.polar.sh"
    : "https://api.polar.sh";
}

// Polar's webhook envelope is exactly `{ type, data }` (confirmed against both the official SDK's
// webhook-payload wrapper types and a captured `refund.created` delivery) — `.strict()` here rejects an
// envelope-level injection (services-hardening MED pattern, mirrors PaddleEventSchema). `data` stays a
// loose record — Polar's per-event-type resource shape (Order/Subscription/Refund) varies, and the
// `read*` helpers below are the defensive layer for it, exactly like paddle-events.ts.
export const PolarEventSchema = strictObject({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export type PolarEvent = z.infer<typeof PolarEventSchema>;

/** `data.metadata.account_id` — the ONLY field Polar natively propagates from checkout onto the
 * resulting order/subscription (ADR-0175, "Metadata set on the checkout will be copied to the
 * resulting order and/or subscription" — Polar's Checkout Create docs). */
function readAccountId(data: Record<string, unknown>): string {
  const metadata = data.metadata;
  if (typeof metadata !== "object" || metadata === null) return "";
  return readString((metadata as Record<string, unknown>).account_id);
}

/** Polar's webhook envelope carries no dedicated per-delivery event id (unlike Stripe's `id`/Paddle's
 * `event_id`) — fall back to a `type:id` composite of the resource itself, stable and unique enough per
 * delivery for the credit grant's idempotency key (mirrors the LemonSqueezy driver's same gap). */
function readSourceEventId(event: PolarEvent): string {
  return `${event.type}:${readIdString(event.data.id)}`;
}

/** Map a verified Polar event to a DomainBillingEvent, or null for events we don't act on. */
export function parsePolarEvent(event: PolarEvent): DomainBillingEvent | null {
  const sourceEventId = readSourceEventId(event);
  const accountId = readAccountId(event.data);
  switch (event.type) {
    case "order.paid": {
      // order.created can fire before payment settles (Polar's own migration note: switch to
      // order.paid to know an order is actually collected) — order.paid is this driver's equivalent of
      // Stripe's checkout.session.completed / Paddle's transaction.completed. Polar's `billing_reason`
      // already uses the SAME vocabulary Stripe's own billing_reason enum does
      // ("purchase"/"subscription_create"/"subscription_cycle"/"subscription_update"), so a
      // subscription-linked order (any reason other than "purchase") maps to invoice.paid — mirrors
      // the Stripe/Paddle drivers' one-time-vs-cycle guard.
      const orderId = readIdString(event.data.id);
      if (orderId === "") return null;
      const billingReason = readString(event.data.billing_reason);
      const amountTotal = readInt(event.data.total_amount);
      const currency = readString(event.data.currency, "usd").toLowerCase();
      const priceId = readIdString(event.data.product_id);
      if (billingReason === "purchase") {
        return {
          type: "purchase.completed",
          sourceEventId,
          accountId,
          amountTotal,
          currency,
          // Polar order webhooks carry a single product per order here — a one-entry wrap of the
          // shared multi-line shape, quantity 1. No per-line refund data (Paddle-only population), so
          // the join fields are the empty sentinels; `chargedAmount` carries the order total for the
          // single line.
          lineItems: [
            { priceId, quantity: 1, itemId: "", chargedAmount: amountTotal },
          ],
          paymentId: orderId,
        };
      }
      const subscriptionId = readIdString(event.data.subscription_id);
      if (subscriptionId === "") return null;
      return {
        type: "invoice.paid",
        sourceEventId,
        accountId,
        amountTotal,
        currency,
        subscriptionId,
        priceId,
        billingReason,
        invoiceId: orderId,
      };
    }
    case "subscription.created":
      return { type: "subscription.created", sourceEventId, accountId };
    case "subscription.updated":
      return { type: "subscription.updated", sourceEventId, accountId };
    case "subscription.canceled":
      return {
        type: "subscription.canceled",
        sourceEventId,
        accountId,
        // The canceled object IS the subscription, so its own `id` is the subscription id.
        subscriptionId: readIdString(event.data.id),
      };
    case "order.refunded":
      return {
        type: "refund.completed",
        sourceEventId,
        accountId,
        paymentId: readIdString(event.data.id),
        amountRefunded: readInt(event.data.refunded_amount),
        currency: readString(event.data.currency, "usd").toLowerCase(),
        // Polar's order `status` is `"refunded"` (fully) vs `"partially_refunded"` — an explicit
        // signal (unlike LemonSqueezy's order-level boolean), mirrors the Paddle driver's full-vs-
        // partial refund discipline (ADR-0113: a partial refund must never revoke all access).
        fullyRefunded: readString(event.data.status) === "refunded",
        // No per-line refund data (ADR-0218 D-1 — Paddle-only); a partial Polar refund stays a
        // scalar no-op downstream, same as the Stripe driver.
        adjustmentId: "",
        items: [],
      };
    default:
      return null;
  }
}

function requireConfigValue(name: string, value: string): void {
  if (value.length === 0) {
    throw new ConfigError(
      `createPolarBilling requires \`${name}\` (fail-closed — the driver is dormant until the adopter supplies credentials)`,
    );
  }
}

export function createPolarBilling(config: PolarConfig): BillingProvider {
  requireConfigValue("accessToken", config.accessToken);
  requireConfigValue("webhookSecret", config.webhookSecret);

  return {
    verifyAndParse(rawBody, signatureHeader, opts) {
      verifyPolarWebhook(rawBody, signatureHeader, config.webhookSecret, opts);
      const event = parseStrict(PolarEventSchema, JSON.parse(rawBody));
      return parsePolarEvent(event);
    },

    async createCheckout(input) {
      // Polar's checkout API takes a `products` array (their "price"/variant equivalent) + `metadata`
      // copied onto the resulting order/subscription (ADR-0175, mirrors Stripe's `metadata` / Paddle's
      // `custom_data`). `input.mode`/`cancelUrl` have no Polar equivalent (a product's own catalog
      // config decides one-time vs. recurring, and there is no checkout-level cancel redirect) — kept
      // on the shared port for Stripe parity only, same posture as the Paddle driver.
      const baseUrl = polarApiBase(config.env);
      const body = {
        products: [input.priceId],
        success_url: input.successUrl,
        metadata: { account_id: input.accountId },
      };
      const res = await fetchWithTimeout(
        `${baseUrl}/v1/checkouts/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) throw new InternalError("Polar checkout creation failed");
      const data = (await res.json()) as { url?: string };
      if (data.url === undefined)
        throw new InternalError("Polar returned no checkout url");
      return { url: data.url };
    },
  };
}
