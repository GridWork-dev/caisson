// Polar billing seam (ADR-0175) — a buyer-facing Merchant-of-Record `BillingProvider` driver. A NEW
// sibling file (the operator-decided split — NOT co-located in provider.ts), single-file like
// lemonsqueezy.ts: raw-body Standard Webhooks verification + Polar->domain event mapping + REST checkout
// creation. NO new dependency — hand-rolled over Polar's REST API + the Standard Webhooks scheme
// (https://www.standardwebhooks.com), mirroring the Stripe/Paddle drivers' no-SDK posture. Dormant: only
// constructed when the buyer supplies credentials. Platform MoR stays Paddle (ADR-0116).
import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  AuthnError,
  ConfigError,
  InternalError,
  fetchWithTimeout,
  parseStrict,
  safeEqualFixed,
  strictObject,
} from "@caisson/kernel";
import type { BillingProvider } from "./provider.ts";
import type { VerifyOptions } from "./webhook.ts";
import type { DomainBillingEvent } from "./events.ts";

export interface PolarConfig {
  accessToken: string;
  webhookSecret: string;
  /** Selects the Polar API base url. Defaults to `production`. */
  env?: "sandbox" | "production";
}

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

/**
 * Parses the ONE `signatureHeader` string the shared `BillingProvider` port passes into the three
 * separate headers the Standard Webhooks spec requires (`webhook-id`, `webhook-timestamp`,
 * `webhook-signature`) — unlike Stripe/Paddle, which carry the timestamp inline in their one signature
 * header, Polar/Standard-Webhooks splits it across three. The caller joins them in the SAME order the
 * spec signs them in: `${webhook-id}.${webhook-timestamp}.${webhook-signature}` (period-joined — the
 * signature value itself is base64 and never contains a period, so splitting on the first two periods
 * unambiguously recovers all three fields).
 */
function parsePolarSignatureHeader(header: string): {
  id: string;
  timestamp: string;
  signatures: string[];
} {
  const firstDot = header.indexOf(".");
  const secondDot = firstDot === -1 ? -1 : header.indexOf(".", firstDot + 1);
  if (firstDot === -1 || secondDot === -1) {
    return { id: "", timestamp: "", signatures: [] };
  }
  const id = header.slice(0, firstDot);
  const timestamp = header.slice(firstDot + 1, secondDot);
  const signatures = header
    .slice(secondDot + 1)
    .split(" ")
    .map((token) => token.split(","))
    .filter((parts) => parts.length === 2 && parts[0] === "v1")
    .map((parts) => parts[1] ?? "");
  return { id, timestamp, signatures };
}

/** Standard Webhooks secrets are base64 (optionally `whsec_`-prefixed — strip before decoding). */
function decodeStandardWebhooksSecret(secret: string): Buffer {
  const stripped = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  return Buffer.from(stripped, "base64");
}

/** Throws `AuthnError` unless `signatureHeader` (the joined `id.timestamp.signature` — see
 * `parsePolarSignatureHeader`) is a valid, in-tolerance Standard Webhooks signature. */
export function verifyPolarWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  {
    toleranceSec = 300,
    now = Math.floor(Date.now() / 1000),
  }: VerifyOptions = {},
): void {
  const { id, timestamp, signatures } =
    parsePolarSignatureHeader(signatureHeader);
  const ts = Number(timestamp);
  if (id === "" || !Number.isFinite(ts) || signatures.length === 0) {
    throw new AuthnError("Malformed Polar signature header");
  }
  if (Math.abs(now - ts) > toleranceSec) {
    throw new AuthnError("Polar signature timestamp outside tolerance");
  }
  const key = decodeStandardWebhooksSecret(secret);
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  let ok = false;
  for (const candidate of signatures) {
    if (safeEqualFixed(expected, candidate)) ok = true;
  }
  if (!ok) throw new AuthnError("Invalid Polar signature");
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readIdString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function readInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

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
      `createPolarBilling requires \`${name}\` (fail-closed — the driver is dormant until the buyer supplies credentials)`,
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
