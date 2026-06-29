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

/** Read `account_id` from a `{ metadata: { account_id } }` shape, or "" if absent. */
function readMetadataAccountId(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const metadata = (value as Record<string, unknown>).metadata;
  if (typeof metadata !== "object" || metadata === null) return "";
  return readString((metadata as Record<string, unknown>).account_id);
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
      return {
        type: "purchase.completed",
        sourceEventId: event.id,
        accountId,
        amountTotal: readInt(obj.amount_total),
        currency: readString(obj.currency, "usd"),
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
