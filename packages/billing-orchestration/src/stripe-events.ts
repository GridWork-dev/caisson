// The Stripe->domain event mapper + envelope schema (ADR-0017). Maps a verified Stripe webhook payload
// to the provider-agnostic DomainBillingEvent union (the open contract in @caisson-sh/billing) — no Stripe
// type escapes this package: the rest of the base consumes only DomainBillingEvent. `sourceEventId` is
// the provider event id — it flows straight into the credit wallet's idempotency key (ADR-0007/0023) so
// a replayed webhook grants exactly once. `accountId` is resolved from the subscription's metadata on a
// cycle invoice (or the Checkout Session's metadata on a one-time purchase) — both stamped at checkout
// (ADR-0089). This file (parse + envelope) is the commercial half of the billing carve (ADR-0249 G3);
// the DomainBillingEvent contract itself stays open in @caisson-sh/billing.
import { z } from "zod";
import { readInt, readString } from "./event-readers.ts";
import type { DomainBillingEvent } from "@caisson-sh/billing";

// The envelope (id/type/data.object) is Zod-validated at the boundary (mirrors PaddleEventSchema /
// services-hardening MED finding): the raw webhook body used to be trusted via a bare
// `JSON.parse(rawBody) as StripeEvent` cast — a type-level assertion with no runtime check, so a
// validly-signed but malformed delivery would flow straight into parseStripeEvent below.
// The driver's verifyAndParse parses through this schema (`parseStrict`, throwing a
// ValidationError) BEFORE the mapper ever sees the event.
//
// Deliberately NOT `.strict()` (2026-07-04, same finding as the Paddle envelope): a real Stripe
// event carries `object`, `api_version`, `created`, `livemode`, `pending_webhooks`, `request` (and
// `data.previous_attributes` on update events) alongside id/type/data — a strict envelope rejects
// every real delivery. Authenticity is the signature's job (verifyStripeWebhook runs first); this
// schema guarantees only the shape of the fields the mapper consumes, and the default `z.object`
// parse strips the rest. The driver is dormant (ADR-0200: Paddle is the sole live mount) but must
// not carry a known real-delivery rejection into any future activation. `data.object` itself stays
// a loose `Record<string, unknown>` — this file's `read*` helpers are already the
// defensive/fail-closed-to-safe-default layer for it.
export const StripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

export type StripeEvent = z.infer<typeof StripeEventSchema>;

/** Read `metadata.<key>` from a `{ metadata: { … } }` shape, or "" if absent. */
function readMetadataString(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null) return "";
  const metadata = (value as Record<string, unknown>).metadata;
  if (typeof metadata !== "object" || metadata === null) return "";
  return readString((metadata as Record<string, unknown>)[key]);
}

/** Read `account_id` from a `{ metadata: { account_id } }` shape, or "" if absent. */
function readMetadataAccountId(value: unknown): string {
  return readMetadataString(value, "account_id");
}

// Resolve the tenant account. A subscription invoice carries it on
// `subscription_details.metadata.account_id` — Stripe reflects the subscription's metadata there, and
// that is the ONLY stable source on a cycle invoice (it does NOT copy Checkout-Session metadata or
// `client_reference_id` onto invoices). A one-time Checkout Session instead carries it top-level on
// `metadata.account_id` / `client_reference_id`. Subscription-first so the recurring grant resolves
// (ADR-0089); "" when none is present (handleBillingWebhook no-ops rather than grant blind).
function readAccountId(object: Record<string, unknown>): string {
  const fromSubscription = readMetadataAccountId(object.subscription_details);
  if (fromSubscription !== "") return fromSubscription;
  const fromTopLevel = readMetadataAccountId(object);
  if (fromTopLevel !== "") return fromTopLevel;
  return readString(object.client_reference_id);
}

/** The subscription line's price id from `invoice.lines.data[0].price.id`, or "" if absent. */
function readInvoicePriceId(object: Record<string, unknown>): string {
  const lines = object.lines;
  if (typeof lines !== "object" || lines === null) return "";
  const data = (lines as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0) return "";
  const first = data[0];
  if (typeof first !== "object" || first === null) return "";
  const price = (first as Record<string, unknown>).price;
  if (typeof price !== "object" || price === null) return "";
  return readString((price as Record<string, unknown>).id);
}

/** Map a verified Stripe event to a DomainBillingEvent, or null for events we don't act on. */
export function parseStripeEvent(
  event: StripeEvent,
): DomainBillingEvent | null {
  const obj = event.data.object;
  const accountId = readAccountId(obj);
  switch (event.type) {
    case "checkout.session.completed":
      // A subscription-mode Checkout Session also fires this event, but it has no PaymentIntent and is
      // NOT a one-time purchase — the subscription's first grant arrives via invoice.paid
      // (subscription_create). Mapping it to purchase.completed would throw on the empty paymentId
      // (apply-billing-event) and storm Stripe with retries. Only the payment (one-time) mode is a
      // purchase here (ADR-0113).
      if (readString(obj.mode) === "subscription") return null;
      return {
        type: "purchase.completed",
        sourceEventId: event.id,
        accountId,
        amountTotal: readInt(obj.amount_total),
        currency: readString(obj.currency, "usd"),
        // The one-time PURCHASE_BOOK key — stamped at checkout on `metadata.price_id` (a session
        // carries no webhook-readable line items without expansion). Stripe checkout here only ever
        // creates a single line (drivers.ts `line_items[0]`), so this is a one-entry wrap of the
        // shared multi-line shape, quantity 1. The PaymentIntent id is the refund join key (ADR-0113).
        // Single line, quantity 1 (Stripe checkout creates one line). No per-line refund data — Stripe
        // keeps the scalar `fullyRefunded` path (ADR-0218 D-1), so `itemId`/`chargedAmount` are the
        // empty sentinels; `chargedAmount` carries the session total for completeness (one line).
        lineItems: [
          {
            priceId: readMetadataString(obj, "price_id"),
            quantity: 1,
            itemId: "",
            chargedAmount: readInt(obj.amount_total),
          },
        ],
        paymentId: readString(obj.payment_intent),
      };
    case "customer.subscription.created":
      return {
        type: "subscription.created",
        sourceEventId: event.id,
        accountId,
      };
    case "customer.subscription.updated":
      return {
        type: "subscription.updated",
        sourceEventId: event.id,
        accountId,
      };
    case "customer.subscription.deleted":
      return {
        type: "subscription.canceled",
        sourceEventId: event.id,
        accountId,
        // The deleted object IS the subscription, so its own `id` is the subscription id (ADR-0113).
        subscriptionId: readString(obj.id),
      };
    case "charge.refunded":
      return {
        type: "refund.completed",
        sourceEventId: event.id,
        accountId,
        // The charge's PaymentIntent id — the same id the original purchase grant keyed on (ADR-0113).
        paymentId: readString(obj.payment_intent),
        amountRefunded: readInt(obj.amount_refunded),
        currency: readString(obj.currency, "usd"),
        // Stripe sets `refunded` true ONLY when the charge is fully refunded; a partial refund leaves
        // it false. Stripe emits no real per-line refund data (ADR-0218 D-1), so `adjustmentId` is ""
        // and `items` is empty — a partial Stripe refund stays a scalar no-op (ADR-0113), only the
        // Paddle driver drives per-line revoke/clawback.
        fullyRefunded: obj.refunded === true,
        adjustmentId: "",
        items: [],
      };
    case "invoice.paid":
      return {
        type: "invoice.paid",
        sourceEventId: event.id,
        accountId,
        amountTotal: readInt(obj.amount_paid),
        currency: readString(obj.currency, "usd"),
        subscriptionId: readString(obj.subscription),
        priceId: readInvoicePriceId(obj),
        billingReason: readString(obj.billing_reason),
        invoiceId: readString(obj.id),
      };
    default:
      return null;
  }
}
