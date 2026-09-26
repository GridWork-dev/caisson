// The provider-agnostic domain event (ADR-0017) — the OPEN billing contract. No provider type escapes
// the seam: the rest of the base consumes only DomainBillingEvent, and generated hosts typecheck
// against this open schema alone. The provider->DomainBillingEvent mappers themselves live in the
// paired package (@caisson-sh/billing-orchestration, ADR-0249 G3); the CONTRACT stays here, open.
// `sourceEventId` is the provider event id — it flows straight into the credit wallet's idempotency key
// (ADR-0007/0023) so a replayed webhook grants exactly once. `accountId` is resolved from the
// subscription's metadata on a cycle invoice (or the Checkout Session's metadata on a one-time purchase)
// — both stamped at checkout (ADR-0089).
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";

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
          // ADR-0218 per-line refund enrichment. `itemId` is the provider's transaction-LINE id
          // (Paddle `txnitm_…`, from `details.line_items[].id`) — the join key a later per-line
          // adjustment refund carries. `chargedAmount` is the line's charged minor units, kept so a
          // dollar-partial refund can claw a PROPORTIONAL credit amount. Both are "" / 0 for a driver
          // that emits no per-line data (Stripe wraps a single line); Paddle populates them (D-1).
          itemId: z.string(),
          chargedAmount: z.number().int().nonnegative(),
        }),
      )
      .min(1),
    paymentId: z.string(),
    // ADR-0315 affiliate-attribution enrichment. The Paddle discount id (`dsc_…`) this transaction
    // redeemed, threaded from `transaction.completed.discount_id` — the join key the affiliate
    // commission report resolves against `affiliate_code`. `null` for an undiscounted purchase.
    // OPTIONAL because only the Paddle mapper populates it; the Stripe/LemonSqueezy/Polar mappers
    // emit these events without a discount id, and a strictObject would reject a missing key.
    discountId: z.string().nullable().optional(),
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
    // Whether the WHOLE transaction was fully refunded (Stripe `charge.refunded === true` / Paddle
    // adjustment `type: 'full'`). True → the mapper revokes every line + claws the whole grant, keyed
    // by `paymentId` (the ADR-0113 scalar path, unchanged). False → a per-line adjustment: act per
    // `items[]` below (ADR-0218).
    fullyRefunded: z.boolean(),
    // ADR-0218: a stable per-refund id (Paddle adjustment `data.id`, `adj_…`) used with each item id
    // as the per-line clawback idempotency key `${adjustmentId}:${itemId}` — stable across a
    // redelivery of the SAME adjustment, distinct across two sequential partial adjustments on one
    // line. "" for a driver with no adjustment concept (Stripe).
    adjustmentId: z.string(),
    // ADR-0218 per-line refund array (fork D-2 shape / D-1 population): one entry per refunded line of
    // a PARTIAL adjustment. `fullyRefunded` here is per ITEM — item `type: 'full'` (revoke the line +
    // claw its credits) vs `type: 'partial'` (proportional dollar claw, entitlement intact, fork A-1).
    // Empty for a whole-transaction full refund and for drivers that emit no per-line data.
    items: z.array(
      strictObject({
        itemId: z.string(),
        amountRefunded: z.number().int().nonnegative(),
        fullyRefunded: z.boolean(),
      }),
    ),
  }),
  // ADR-0294: a chargeback/dispute — Paddle's merchant-of-record bank-initiated event, distinct
  // from a refund (which the merchant/customer initiates). ALERT-ONLY: the mapper below never grants,
  // revokes, or claws from this event — Paddle absorbs the dispute financially, and an operator
  // reviews + acts manually via the existing admin revoke lever (ADR-0225). `paymentId` joins back
  // to the original transaction for the alert's context; no money/entitlement effect reads it.
  strictObject({
    type: z.literal("chargeback.detected"),
    sourceEventId: z.string(),
    accountId: z.string(),
    paymentId: z.string(),
    amountDisputed: z.number().int().nonnegative(),
    currency: z.string(),
  }),
  strictObject({
    type: z.literal("invoice.paid"),
    sourceEventId: z.string(),
    accountId: z.string(),
    amountTotal: z.number().int().nonnegative(),
    currency: z.string(),
    // ADR-0089 enrichment — still P1 parse-only (no provider type escapes the package): just enough for
    // a host's cycle->grant mapper to resolve WHICH plan + WHICH cycle, and to key the
    // allotment idempotently on the invoice id. `subscriptionId`/`priceId` are "" for a non-subscription
    // invoice; the mapper gates on `billingReason` so a non-cycle invoice grants nothing regardless.
    subscriptionId: z.string(),
    priceId: z.string(),
    billingReason: z.string(),
    invoiceId: z.string(),
    // ADR-0315 affiliate-attribution enrichment — the same `dsc_…` join key as on
    // purchase.completed above, captured on the subscription (invoice.paid) mapping too so a
    // discounted subscription's cycle invoices attribute to the affiliate. Optional for the same
    // provider-neutrality reason (only the Paddle mapper sets it).
    discountId: z.string().nullable().optional(),
  }),
]);

export type DomainBillingEvent = z.infer<typeof DomainBillingEventSchema>;
