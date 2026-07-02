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
import { strictObject, ValidationError } from "@caisson/kernel";
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

/** The transaction's first line item's price id, from `items[0].price.id`. Used only for the
 * subscription (invoice.paid) path — a subscription transaction is single-line by design. */
function readItemPriceId(obj: Record<string, unknown>): string {
  const items = obj.items;
  if (!Array.isArray(items) || items.length === 0) return "";
  const first: unknown = items[0];
  if (typeof first !== "object" || first === null) return "";
  const price = (first as Record<string, unknown>).price;
  if (typeof price !== "object" || price === null) return "";
  return readString((price as Record<string, unknown>).id);
}

/** Read a positive integer `quantity` from a Paddle line item, defaulting to 1 when absent/invalid. */
function readQuantity(item: Record<string, unknown>): number {
  const q = item.quantity;
  return typeof q === "number" && Number.isInteger(q) && q > 0 ? q : 1;
}

/** The transaction's `details.line_items[]` — the array carrying each line's `txnitm_…` id and its
 * per-line `totals` (the request-echo `items[]` carries neither). Read best-effort and correlated BY
 * ORDER with `items[]` (Paddle emits the two arrays in the same order): a missing/short array yields
 * the empty sentinels, never a throw HERE. On a MULTI-line transaction the "" itemId sentinel is NOT
 * benign — it collides on the credit ledger's per-line uniqueness key and silently under-grants — so
 * `readLineItems` fails the whole event closed when it sees one across 2+ lines (see there). On a
 * single-line transaction the sentinel cannot collide, so it stays a permitted best-effort default. */
function readDetailLine(
  obj: Record<string, unknown>,
  index: number,
): { itemId: string; chargedAmount: number } {
  const details = obj.details;
  if (typeof details !== "object" || details === null)
    return { itemId: "", chargedAmount: 0 };
  const lines = (details as Record<string, unknown>).line_items;
  if (!Array.isArray(lines) || index >= lines.length)
    return { itemId: "", chargedAmount: 0 };
  const line: unknown = lines[index];
  if (typeof line !== "object" || line === null)
    return { itemId: "", chargedAmount: 0 };
  const rec = line as Record<string, unknown>;
  const totals = rec.totals;
  const chargedAmount =
    typeof totals === "object" && totals !== null
      ? readMoneyMinorUnits((totals as Record<string, unknown>).total)
      : 0;
  return { itemId: readString(rec.id), chargedAmount };
}

/** EVERY line of a one-time transaction: `items[].price.id` + `items[].quantity` (Strix vuln-0005 —
 * a multi-item cart is ONE transaction carrying N lines; fulfilling only `items[0]` under-grants a
 * cart the buyer paid for in full), enriched per line with its `details.line_items[].id` (`txnitm_…`)
 * join key + charged total for ADR-0218 per-line refunds. FAILS CLOSED on any unreadable line in a
 * non-empty `items` (money path): throwing makes `verifyAndParse` return a non-2xx so Paddle RETRIES,
 * versus silently skipping the line — which would ack the delivery and under-grant a buyer who paid for
 * it, permanently (Greptile P1). An absent / empty `items` returns [] (the caller maps that to null:
 * nothing to grant — a genuinely itemless event, NOT a dropped paid line). */
function readLineItems(obj: Record<string, unknown>): {
  priceId: string;
  quantity: number;
  itemId: string;
  chargedAmount: number;
}[] {
  const items = obj.items;
  if (!Array.isArray(items)) return [];
  const lines = items.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ValidationError("Paddle line item is not an object");
    }
    const item = raw as Record<string, unknown>;
    const price = item.price;
    if (typeof price !== "object" || price === null) {
      throw new ValidationError("Paddle line item is missing its price object");
    }
    const priceId = readString((price as Record<string, unknown>).id);
    if (priceId === "") {
      throw new ValidationError("Paddle line item is missing its price id");
    }
    const detail = readDetailLine(obj, index);
    return {
      priceId,
      quantity: readQuantity(item),
      itemId: detail.itemId,
      chargedAmount: detail.chargedAmount,
    };
  });
  // Fail closed on a MULTI-line transaction whose per-line join id is missing (details.line_items
  // absent/short/idless → the "" sentinel). Two credit-bearing lines with itemId "" collide on the
  // credit ledger's (source_event_id, event_type, COALESCE(line_item_id,'')) uniqueness key, so every
  // credit-bearing line past the first hits ON CONFLICT DO NOTHING and is SILENTLY dropped while the
  // webhook acks 200 — the buyer pays for the whole cart and receives only the first line's credits.
  // Throwing returns a non-2xx so Paddle redelivers (same fail-closed money-path contract as the
  // missing-price-id throw above). A single-line transaction with the "" sentinel cannot collide, so
  // it stays allowed — the common no-details.line_items case for a one-SKU buy.
  if (lines.length > 1 && lines.some((line) => line.itemId === "")) {
    throw new ValidationError(
      "Paddle multi-line transaction is missing a per-line join id (details.line_items)",
    );
  }
  return lines;
}

/** Parse a PARTIAL adjustment's `data.items[]` into per-line refund entries (ADR-0218). Skips Paddle-
 * generated `tax`/`proration` items (not operator-initiated line refunds); each `full`/`partial` item
 * maps to `{itemId: item.item_id (txnitm_), amountRefunded: totals.total, fullyRefunded: type==='full'}`.
 * A malformed/idless item is skipped (best-effort enrichment — the whole-adjustment `amountRefunded`
 * still records the money movement). An absent `items` yields []. */
function readAdjustmentItems(obj: Record<string, unknown>): {
  itemId: string;
  amountRefunded: number;
  fullyRefunded: boolean;
}[] {
  const items = obj.items;
  if (!Array.isArray(items)) return [];
  const out: {
    itemId: string;
    amountRefunded: number;
    fullyRefunded: boolean;
  }[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const type = readString(item.type);
    if (type !== "full" && type !== "partial") continue; // skip tax/proration
    const itemId = readString(item.item_id);
    if (itemId === "") continue;
    const totals = item.totals;
    const amountRefunded =
      typeof totals === "object" && totals !== null
        ? readMoneyMinorUnits((totals as Record<string, unknown>).total)
        : 0;
    out.push({ itemId, amountRefunded, fullyRefunded: type === "full" });
  }
  return out;
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
        // Fulfill EVERY paid line, not just items[0] (Strix vuln-0005). A degenerate transaction with
        // no readable line item has nothing to grant — null rather than a guessed/empty grant.
        const lineItems = readLineItems(obj);
        if (lineItems.length === 0) return null;
        return {
          type: "purchase.completed",
          sourceEventId: event.event_id,
          accountId,
          amountTotal: readGrandTotal(obj),
          currency: readString(obj.currency_code, "usd"),
          lineItems,
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
        // Paddle's `origin` says HOW the charge arose (verified against developer.paddle.com's
        // transaction.completed reference + the subscription-created/renewed simulator scenarios,
        // 2026-07-01), mapped onto the billingReason vocabulary the cycle->grant gate
        // (services/license GRANTING_REASONS) recognizes:
        //   web | api                → the subscription's FIRST charge (Paddle.js checkout / an
        //                              API-created transaction, e.g. provider.ts createCheckout)
        //                              → "subscription_create" (grants)
        //   subscription_recurring   → a renewal cycle → "subscription_cycle" (grants)
        //   subscription_charge      → a MID-CYCLE one-time charge FOR the subscription
        //                              (addon/topup) — NOT the first charge (the earlier reading);
        //                              granting the plan's cycle allotment here would OVER-grant,
        //                              so it passes through as its own non-granting reason
        //   subscription_update / subscription_payment_method_change → proration / $0
        //                              method-change transactions — non-granting (the SD-1
        //                              next-cycle rule)
        // An absent origin passes through as "" — not in GRANTING_REASONS, so it grants nothing
        // (fail-closed; Paddle documents `origin` as always present on a transaction).
        billingReason: ((): string => {
          const origin = readString(obj.origin);
          if (origin === "subscription_recurring") return "subscription_cycle";
          if (origin === "web" || origin === "api")
            return "subscription_create";
          return origin;
        })(),
        // The idempotency anchor is the transaction id: unique per charge (each renewal is its own
        // transaction) and stable across event redeliveries. `invoice_id` — the earlier anchor —
        // IS populated on automatically-collected transactions at completion, but Paddle documents
        // it DEPRECATED (Invoice API compat, scheduled for removal in the next API version);
        // anchoring idempotency on a field the provider plans to drop would silently re-key
        // mid-life (corrected + verified 2026-07-01).
        invoiceId: txnId,
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
      const fullyRefunded = readString(obj.type) === "full";
      return {
        type: "refund.completed",
        sourceEventId: event.event_id,
        accountId,
        // The original transaction id — the same id the purchase grant keyed `sourceEventId` on
        // (ADR-0108/0113 join key, Paddle's equivalent of Stripe's PaymentIntent id).
        paymentId: readString(obj.transaction_id),
        amountRefunded: readAdjustmentTotal(obj),
        currency: readString(obj.currency_code, "usd"),
        // `type: "full"` adjusts the transaction's grand total → whole-transaction revoke + claw (the
        // ADR-0113 scalar path). `type: "partial"` carries `data.items[]` → per-line effect (ADR-0218).
        fullyRefunded,
        // The adjustment's own id (`adj_…`) — the per-line clawback idempotency anchor (stable across
        // a redelivery of this adjustment, distinct per adjustment so sequential partials both claw).
        adjustmentId: readString(obj.id),
        // Only a partial adjustment carries per-line items; a full one revokes/claws by transaction id.
        items: fullyRefunded ? [] : readAdjustmentItems(obj),
      };
    }
    default:
      return null;
  }
}
