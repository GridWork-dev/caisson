// LemonSqueezy billing driver + event mapper (ADR-0175) — a customer-facing Merchant-of-Record
// `BillingProvider` driver. LemonSqueezy->domain event mapping + REST checkout creation. The raw-body
// HMAC signature verifier (`verifyLemonSqueezyWebhook`) stays OPEN in @caisson-sh/billing (uniform rule:
// signature-verify open for all four providers); this file composes it (ADR-0249 G3). NO new
// dependency — hand-rolled over LemonSqueezy's plain REST API, mirroring the Stripe/Paddle drivers'
// no-SDK posture. Dormant: only constructed when the adopter supplies credentials (call-site env-gating,
// same discipline as every other driver) — the platform MoR stays Paddle (ADR-0116).
import { z } from "zod";
import { readIdString, readString } from "./event-readers.ts";
import {
  ConfigError,
  InternalError,
  fetchWithTimeout,
  parseStrict,
  strictObject,
} from "@caisson-sh/kernel";
import {
  verifyLemonSqueezyWebhook,
  type BillingProvider,
  type LemonSqueezyConfig,
  type DomainBillingEvent,
} from "@caisson-sh/billing";

// The webhook envelope is exactly `{ meta, data }` (LemonSqueezy's example payloads + a captured
// real `subscription_payment_success` delivery both show only these two top-level keys) — `.strict()`
// here rejects an envelope-level injection the same way PaddleEventSchema does (services-hardening MED
// pattern). `meta` and `data` themselves stay loose (`data` carries `relationships`/`links` LemonSqueezy
// adds per resource type, and `meta` carries `test_mode`/`webhook_id` alongside `event_name`/
// `custom_data`) — only `meta.event_name` is required, everything else is read defensively in the
// mapper below, exactly like paddle-events.ts's `read*` helpers.
export const LemonSqueezyEventSchema = strictObject({
  meta: z.object({ event_name: z.string() }).passthrough(),
  data: z.record(z.string(), z.unknown()),
});

export type LemonSqueezyEvent = z.infer<typeof LemonSqueezyEventSchema>;

/** LemonSqueezy money fields are numeric MINOR units but can carry sub-cent fractional artifacts from
 * currency-rate conversion (e.g. `1499.985`) — round to the nearest integer minor unit (ADR-0007:
 * credits/money are integer units, never floats). */
function readMoneyMinorUnits(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : 0;
}

function readAccountId(event: LemonSqueezyEvent): string {
  const customData = (event.meta as Record<string, unknown>).custom_data;
  if (typeof customData !== "object" || customData === null) return "";
  return readString((customData as Record<string, unknown>).account_id);
}

/** LemonSqueezy's envelope carries no dependable per-delivery event id: `meta.webhook_id` is present on
 * real deliveries but VARIES per delivery/retry, so keying the credit-grant idempotency on it would
 * double-grant on a retry (ADR-0007: grants are exactly-once). Derive the STABLE `type:id` composite of
 * the resource itself instead — identical across a delivery and its retries (mirrors the Polar driver's
 * same gap); `meta.webhook_id` is intentionally ignored. */
function readSourceEventId(event: LemonSqueezyEvent): string {
  return `${readString(event.data.type)}:${readIdString(event.data.id)}`;
}

function readAttributes(event: LemonSqueezyEvent): Record<string, unknown> {
  const attributes = event.data.attributes;
  return typeof attributes === "object" && attributes !== null
    ? (attributes as Record<string, unknown>)
    : {};
}

/** The order's `first_order_item.variant_id` — the purchased SKU (LemonSqueezy's "price"). */
function readFirstOrderItemVariantId(attrs: Record<string, unknown>): string {
  const item = attrs.first_order_item;
  if (typeof item !== "object" || item === null) return "";
  return readIdString((item as Record<string, unknown>).variant_id);
}

/** Map a verified LemonSqueezy event to a DomainBillingEvent, or null for events we don't act on. */
export function parseLemonSqueezyEvent(
  event: LemonSqueezyEvent,
): DomainBillingEvent | null {
  const sourceEventId = readSourceEventId(event);
  const accountId = readAccountId(event);
  const attrs = readAttributes(event);
  switch (event.meta.event_name) {
    case "order_created": {
      const orderId = readIdString(event.data.id);
      if (orderId === "") return null;
      // LemonSqueezy ALWAYS fires order_created alongside subscription_created for a subscription's
      // first charge too (per LemonSqueezy's own event-types doc) — unlike Paddle's
      // transaction.subscription_id, the order webhook payload carries no field distinguishing that
      // case, so this maps to purchase.completed unconditionally. Downstream's one-time PURCHASE_BOOK
      // is keyed by one-time variant ids only, so a subscription's variant id here no-ops there; the
      // real recurring grant flows through subscription_payment_success below (mirrors the invoice.paid
      // path the Stripe/Paddle drivers use). Upgrade path if a false-grant risk ever matters: resolve
      // via `GET /v1/orders/{id}?include=subscriptions` before mapping.
      return {
        type: "purchase.completed",
        sourceEventId,
        accountId,
        amountTotal: readMoneyMinorUnits(attrs.total),
        currency: readString(attrs.currency, "usd").toLowerCase(),
        // The first order item's variant — a one-entry wrap of the shared multi-line shape (Strix
        // vuln-0005), quantity 1. (Upgrade path if LS multi-item orders ever grant: map all items.)
        // No per-line refund data (ADR-0218 D-1: Paddle-only), so the join fields are the empty
        // sentinels; `chargedAmount` carries the order total for the single line.
        lineItems: [
          {
            priceId: readFirstOrderItemVariantId(attrs),
            quantity: 1,
            itemId: "",
            chargedAmount: readMoneyMinorUnits(attrs.total),
          },
        ],
        paymentId: orderId,
      };
    }
    case "subscription_created":
      return { type: "subscription.created", sourceEventId, accountId };
    case "subscription_updated":
      return { type: "subscription.updated", sourceEventId, accountId };
    case "subscription_cancelled":
      return {
        type: "subscription.canceled",
        sourceEventId,
        accountId,
        // The cancelled object IS the subscription, so its own `id` is the subscription id.
        subscriptionId: readIdString(event.data.id),
      };
    case "subscription_payment_success": {
      const invoiceId = readIdString(event.data.id);
      if (invoiceId === "") return null;
      return {
        type: "invoice.paid",
        sourceEventId,
        accountId,
        amountTotal: readMoneyMinorUnits(attrs.total),
        currency: readString(attrs.currency, "usd").toLowerCase(),
        subscriptionId: readIdString(attrs.subscription_id),
        priceId: "",
        // LemonSqueezy's `billing_reason` is "initial" for a subscription's first automatic charge or
        // "renewal" for every cycle after — mapped onto the SAME billingReason vocabulary the
        // cycle->grant gate already recognizes (mirrors the Paddle driver's `origin` mapping).
        billingReason:
          readString(attrs.billing_reason) === "initial"
            ? "subscription_create"
            : "subscription_cycle",
        invoiceId,
      };
    }
    case "order_refunded":
      return {
        type: "refund.completed",
        sourceEventId,
        accountId,
        paymentId: readIdString(event.data.id),
        amountRefunded: readMoneyMinorUnits(attrs.total),
        currency: readString(attrs.currency, "usd").toLowerCase(),
        // LemonSqueezy's order-level `refunded` is a boolean (full refund only at the order level) —
        // mirrors the Paddle driver's full-vs-partial refund discipline (ADR-0113: a partial refund must
        // never revoke all access or claw back the whole grant).
        fullyRefunded: attrs.refunded === true,
        // No per-line refund data (ADR-0218 D-1 — Paddle-only population).
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
      `createLemonSqueezyBilling requires \`${name}\` (fail-closed — the driver is dormant until the adopter supplies credentials)`,
    );
  }
}

export function createLemonSqueezyBilling(
  config: LemonSqueezyConfig,
): BillingProvider {
  requireConfigValue("apiKey", config.apiKey);
  requireConfigValue("webhookSecret", config.webhookSecret);
  requireConfigValue("storeId", config.storeId);

  return {
    verifyAndParse(rawBody, signatureHeader) {
      verifyLemonSqueezyWebhook(rawBody, signatureHeader, config.webhookSecret);
      const event = parseStrict(LemonSqueezyEventSchema, JSON.parse(rawBody));
      return parseLemonSqueezyEvent(event);
    },

    async createCheckout(input) {
      // LemonSqueezy's checkout API is JSON:API-shaped: a `checkouts` resource related to a `stores`
      // and a `variants` resource (their "price"). `custom.account_id` is the ONLY field LemonSqueezy
      // natively propagates onto the resulting order/subscription's `meta.custom_data` (ADR-0175,
      // mirrors Paddle's `custom_data` / Stripe's `metadata` stamping). `input.mode`/`cancelUrl` have no
      // LemonSqueezy equivalent (a variant's own catalog config decides one-time vs. subscription, and
      // there is no checkout-level cancel redirect) — kept on the shared port for Stripe parity only,
      // same posture as the Paddle driver.
      const body = {
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: { custom: { account_id: input.accountId } },
            product_options: { redirect_url: input.successUrl },
          },
          relationships: {
            store: { data: { type: "stores", id: config.storeId } },
            variant: { data: { type: "variants", id: input.priceId } },
          },
        },
      };
      const res = await fetchWithTimeout(
        "https://api.lemonsqueezy.com/v1/checkouts",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok)
        throw new InternalError("LemonSqueezy checkout creation failed");
      const data = (await res.json()) as {
        data?: { attributes?: { url?: string } };
      };
      const url = data.data?.attributes?.url;
      if (url === undefined)
        throw new InternalError("LemonSqueezy returned no checkout url");
      return { url };
    },
  };
}
