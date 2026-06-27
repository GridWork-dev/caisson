// The provider-agnostic domain event (ADR-0017). No Stripe type escapes the package: the rest of
// the base consumes only DomainBillingEvent. `sourceEventId` is the provider event id — it flows
// straight into the credit wallet's idempotency key (ADR-0007/0023) so a replayed webhook grants
// exactly once. `accountId` comes from checkout metadata set at session creation.
import { z } from "zod";
import { strictObject } from "@stack/kernel";

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

function readAccountId(object: Record<string, unknown>): string {
  const metadata = object.metadata;
  if (typeof metadata === "object" && metadata !== null) {
    return readString((metadata as Record<string, unknown>).account_id);
  }
  return readString(object.client_reference_id);
}

function readInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
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
      };
    default:
      return null;
  }
}
