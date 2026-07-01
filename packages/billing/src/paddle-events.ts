// The Paddle->domain event mapper (ADR-0108). Maps a verified Paddle Billing webhook payload to the
// SAME provider-agnostic DomainBillingEvent union the Stripe driver produces (./events.ts) — no Paddle
// type escapes the package; services/license consumes only DomainBillingEvent either way.
//
// Paddle's `transaction.completed` is the ONE event Paddle fires for BOTH a one-time purchase AND every
// subscription charge (the initial automatic charge AND each renewal) — there is no Stripe-style split
// across checkout.session.completed / invoice.paid (ADR-0108 mechanics: "this single event drives both
// the one-time edition/bundle grant and the X-2 annual cycle->grant"). A transaction carrying a
// `subscription_id` is therefore NEVER a one-time purchase.completed — mirroring the Stripe driver's
// checkout.session.completed subscription-mode guard — it routes instead through the cycle/
// invoice-equivalent path (mapped onto the existing `invoice.paid` union member, which is what the
// services/license cycle->grant mapper already reads regardless of provider).
//
// The tenant resolves from `custom_data.account_id`, stamped at checkout and propagated NATIVELY by
// Paddle onto the transaction + subscription — this removes the Stripe driver's
// subscription_data[metadata]-stamping workaround (ADR-0089 §worked-around by ADR-0108).
//
// The envelope (event_id/event_type/data) is Zod-`.strict()`-validated at the boundary
// (services-hardening MED finding): the raw webhook body used to be trusted via a bare
// `JSON.parse(rawBody) as PaddleEvent` cast — a type-level assertion with no runtime check, so a
// malformed or field-injected delivery would flow straight into the mapper below. `PaddleEventSchema`
// rejects any envelope that is missing `event_id`/`event_type`, has the wrong top-level shape, or
// carries an extra/unknown top-level key; `provider.ts`'s `verifyAndParse` parses through it
// (`parseStrict`, throwing a `ValidationError`) BEFORE this file's mapper ever sees the event. `data`
// itself stays a loose `Record<string, unknown>` — Paddle's per-event-type payload shape varies, and
// the `read*` helpers below are ALREADY the defensive/fail-closed-to-safe-default layer for it; this
// schema only closes the envelope-level gap, it does not re-validate every event type's inner fields.
import { z } from "zod";
import { strictObject } from "@caisson/kernel";
import type { DomainBillingEvent } from "./events.ts";

export const PaddleEventSchema = strictObject({
  event_id: z.string(),
  event_type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export type PaddleEvent = z.infer<typeof PaddleEventSchema>;

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Paddle money fields are decimal STRINGS of the smallest currency unit (e.g. "4900" = $49.00). */
function readMoneyMinorUnits(value: unknown): number {
  if (typeof value !== "string" || value.trim() === "") return 0;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : 0;
}

/** Read `custom_data.account_id` — Paddle's native checkout->transaction/subscription propagation. */
function readAccountId(obj: Record<string, unknown>): string {
  const customData = obj.custom_data;
  if (typeof customData !== "object" || customData === null) return "";
  return readString((customData as Record<string, unknown>).account_id);
}

/** The transaction's first line item's price id, from `items[0].price.id`. */
function readItemPriceId(obj: Record<string, unknown>): string {
  const items = obj.items;
  if (!Array.isArray(items) || items.length === 0) return "";
  const first: unknown = items[0];
  if (typeof first !== "object" || first === null) return "";
  const price = (first as Record<string, unknown>).price;
  if (typeof price !== "object" || price === null) return "";
  return readString((price as Record<string, unknown>).id);
}

/** `details.totals.grand_total` — the transaction's charged total, minor units. */
function readGrandTotal(obj: Record<string, unknown>): number {
  const details = obj.details;
  if (typeof details !== "object" || details === null) return 0;
  const totals = (details as Record<string, unknown>).totals;
  if (typeof totals !== "object" || totals === null) return 0;
  return readMoneyMinorUnits((totals as Record<string, unknown>).grand_total);
}

/** An adjustment's `totals.total` — the refunded amount, minor units. */
function readAdjustmentTotal(obj: Record<string, unknown>): number {
  const totals = obj.totals;
  if (typeof totals !== "object" || totals === null) return 0;
  return readMoneyMinorUnits((totals as Record<string, unknown>).total);
}

/** Map a verified Paddle event to a DomainBillingEvent, or null for events we don't act on. */
export function parsePaddleEvent(
  event: PaddleEvent,
): DomainBillingEvent | null {
  const obj = event.data;
  const accountId = readAccountId(obj);
  switch (event.event_type) {
    case "transaction.completed": {
      const subscriptionId = readString(obj.subscription_id);
      const txnId = readString(obj.id);
      if (subscriptionId === "") {
        // One-time (non-subscription) purchase — the transaction id IS the one-off payment id: the
        // same id a later refund's adjustment.transaction_id joins back on (ADR-0108/0113). A
        // degenerate event missing it has nothing to anchor a grant's idempotency key on — never a
        // guessed grant.
        if (txnId === "") return null;
        return {
          type: "purchase.completed",
          sourceEventId: event.event_id,
          accountId,
          amountTotal: readGrandTotal(obj),
          currency: readString(obj.currency_code, "usd"),
          priceId: readItemPriceId(obj),
          paymentId: txnId,
        };
      }
      // Subscription-linked transaction (the subscription's first automatic charge OR a renewal —
      // Paddle fires this SAME event for both; there is no separate per-cycle webhook). This must NEVER
      // map to purchase.completed (mirrors the Stripe driver's checkout.session.completed
      // subscription-mode guard, ADR-0108) — the grant instead routes through the cycle/
      // invoice-equivalent path below. A degenerate event with no transaction id to anchor the grant's
      // idempotency key on returns null rather than risk a malformed grant.
      if (txnId === "") return null;
      return {
        type: "invoice.paid",
        sourceEventId: event.event_id,
        accountId,
        amountTotal: readGrandTotal(obj),
        currency: readString(obj.currency_code, "usd"),
        subscriptionId,
        priceId: readItemPriceId(obj),
        // Paddle's `origin` distinguishes the subscription's first automatic charge
        // ("subscription_charge") from a renewal ("subscription_recurring"/other subscription-context
        // origins); mapped onto the SAME billingReason vocabulary the cycle->grant gate
        // (services/license GRANTING_REASONS) already recognizes, so that gate is unchanged by this
        // provider swap.
        billingReason:
          readString(obj.origin) === "subscription_charge"
            ? "subscription_create"
            : "subscription_cycle",
        // Paddle only stamps `invoice_id` on manually-collected (invoiced) transactions; this product
        // is automatically-collected, so fall back to the transaction id as the idempotency anchor.
        invoiceId: readString(obj.invoice_id) || txnId,
      };
    }
    case "subscription.created":
      return {
        type: "subscription.created",
        sourceEventId: event.event_id,
        accountId,
      };
    case "subscription.updated":
      return {
        type: "subscription.updated",
        sourceEventId: event.event_id,
        accountId,
      };
    case "subscription.canceled":
      return {
        type: "subscription.canceled",
        sourceEventId: event.event_id,
        accountId,
        // The canceled object IS the subscription, so its own `id` is the subscription id.
        subscriptionId: readString(obj.id),
      };
    case "adjustment.updated": {
      // A refund settles via adjustment.updated: created as `pending_approval`, then Paddle moves it to
      // `approved`/`rejected` (ADR-0108/0113). Act ONLY on an approved refund — a pending or rejected
      // adjustment is a no-op (mirrors the Stripe driver's full-vs-partial refund discipline).
      if (readString(obj.action) !== "refund") return null;
      if (readString(obj.status) !== "approved") return null;
      return {
        type: "refund.completed",
        sourceEventId: event.event_id,
        accountId,
        // The original transaction id — the same id the purchase grant keyed `sourceEventId` on
        // (ADR-0108/0113 join key, Paddle's equivalent of Stripe's PaymentIntent id).
        paymentId: readString(obj.transaction_id),
        amountRefunded: readAdjustmentTotal(obj),
        currency: readString(obj.currency_code, "usd"),
        // `type: "full"` adjusts the transaction's grand total; "partial" must not revoke all access or
        // claw back the whole grant (mirrors the Stripe driver's `refunded` guard, ADR-0113).
        fullyRefunded: readString(obj.type) === "full",
      };
    }
    default:
      return null;
  }
}
