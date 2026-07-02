// The provider-agnostic domain event (ADR-0017). No Stripe type escapes the package: the rest of
// the base consumes only DomainBillingEvent. `sourceEventId` is the provider event id — it flows
// straight into the credit wallet's idempotency key (ADR-0007/0023) so a replayed webhook grants
// exactly once. `accountId` is resolved from the subscription's metadata on a cycle invoice (or the
// Checkout Session's metadata on a one-time purchase) — both stamped at checkout (ADR-0089).
import { z } from "zod";
import { strictObject } from "@caisson/kernel";

export const DomainBillingEventSchema = z.discriminatedUnion("type", [
  strictObject({
    type: z.literal("purchase.completed"),
    sourceEventId: z.string(),
    accountId: z.string(),
    amountTotal: z.number().int().nonnegative(),
    currency: z.string(),
    // ADR-0113 one-time enrichment. `lineItems` is EVERY paid line of the purchase (Strix vuln-0005: a
    // multi-item cart is ONE provider transaction carrying N lines — the mapper must fulfill all of
    // them, not just `items[0]`). Each line's `priceId` the one-time PURCHASE_BOOK resolves to
    // {credits, entitlements}; `quantity` scales the credits (an entitlement is binary). `paymentId`
    // (`payment_intent`) is the STABLE join key a later `charge.refunded` carries, keying the whole
    // transaction's grants, so a refund still revokes every line's grants + claws back its credits.
    lineItems: z
      .array(
        strictObject({
          priceId: z.string(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1),
    paymentId: z.string(),
  }),
  strictObject({
    type: z.literal("subscription.created"),
    sourceEventId: z.string(),
    accountId: z.string(),
  }),
  strictObject({
    type: z.literal("subscription.updated"),
    sourceEventId: z.string(),
    accountId: z.string(),
  }),
  strictObject({
    type: z.literal("subscription.canceled"),
    sourceEventId: z.string(),
    accountId: z.string(),
    // ADR-0113: the deleted subscription's id (the `customer.subscription.deleted` object IS the
    // subscription, so its `id`). The revoke path soft-revokes exactly the grants whose
    // source_kind=subscription AND subscription_id = this id — never another subscription's grants.
    subscriptionId: z.string(),
  }),
  // ADR-0113 refund: a `charge.refunded` on a one-time purchase. `paymentId` (the charge's
  // `payment_intent`) joins back to the original purchase's entitlement grant + credit grant. The
  // account is read from the charge metadata (copied from the PaymentIntent metadata stamped at
  // checkout). The clawback amount is the GRANTED credits (looked up by paymentId), NOT amountRefunded.
  strictObject({
    type: z.literal("refund.completed"),
    sourceEventId: z.string(),
    accountId: z.string(),
    paymentId: z.string(),
    amountRefunded: z.number().int().nonnegative(),
    currency: z.string(),
    // Whether the charge was FULLY refunded (Stripe `charge.refunded === true`). The mapper acts only
    // on a full refund — a PARTIAL refund must not revoke all access or claw the whole grant (ADR-0113).
    fullyRefunded: z.boolean(),
  }),
  strictObject({
    type: z.literal("invoice.paid"),
    sourceEventId: z.string(),
    accountId: z.string(),
    amountTotal: z.number().int().nonnegative(),
    currency: z.string(),
    // ADR-0089 enrichment — still P1 parse-only (no Stripe type escapes the package): just enough for
    // the services/license cycle->grant mapper to resolve WHICH plan + WHICH cycle, and to key the
    // allotment idempotently on the invoice id. `subscriptionId`/`priceId` are "" for a non-subscription
    // invoice; the mapper gates on `billingReason` so a non-cycle invoice grants nothing regardless.
    subscriptionId: z.string(),
    priceId: z.string(),
    billingReason: z.string(),
    invoiceId: z.string(),
  }),
]);

export type DomainBillingEvent = z.infer<typeof DomainBillingEventSchema>;

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

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

function readInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
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
        // creates a single line (provider.ts `line_items[0]`), so this is a one-entry wrap of the
        // shared multi-line shape, quantity 1. The PaymentIntent id is the refund join key (ADR-0113).
        lineItems: [
          { priceId: readMetadataString(obj, "price_id"), quantity: 1 },
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
        // it false. The mapper no-ops on a partial refund (never a full revoke/clawback) — ADR-0113.
        fullyRefunded: obj.refunded === true,
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
