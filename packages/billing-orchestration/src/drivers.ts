// The Stripe + Paddle BillingProvider drivers (ADR-0017). Stripe was the original driver; ADR-0108
// switches the live merchant-of-record to Paddle — both implementations satisfy the ONE open port
// (@caisson/billing `BillingProvider`), so a provider swap is a new driver, not a rewrite. Each driver
// composes the OPEN raw-body signature verifier (@caisson/billing) with this package's parser +
// checkout REST call; the purchase->grant orchestration lives in the host application.
import { z } from "zod";
import { fetchWithTimeout, InternalError, parseStrict } from "@caisson/kernel";
import {
  verifyStripeWebhook,
  verifyPaddleWebhook,
  type BillingProvider,
  type StripeConfig,
  type PaddleConfig,
} from "@caisson/billing";
import { parseStripeEvent, StripeEventSchema } from "./stripe-events.ts";
import { parsePaddleEvent, PaddleEventSchema } from "./paddle-events.ts";

// The subset of Paddle's POST /discounts response we read — the created discount's id (`dsc_…`) and
// its (possibly-normalized) code echo. Loose (never `.strict()`): Paddle's discount entity carries
// ~18 fields and adds more as a non-breaking change; we consume only these two.
const PaddleDiscountResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    code: z.string().optional(),
  }),
});

export function createStripeBilling(config: StripeConfig): BillingProvider {
  return {
    verifyAndParse(rawBody, signatureHeader, opts) {
      verifyStripeWebhook(rawBody, signatureHeader, config.webhookSecret, opts);
      // Envelope validation at the boundary (mirrors the Paddle driver): reject an envelope with a
      // missing/wrong-typed id/type/data.object BEFORE it reaches the mapper — a signature check
      // alone does not guarantee the payload SHAPE. Tolerant of provider-additive envelope fields
      // (a real Stripe event carries api_version/created/livemode/…; see StripeEventSchema).
      // parseStrict throws a redaction-safe ValidationError → the route layer maps it to non-2xx.
      const event = parseStrict(StripeEventSchema, JSON.parse(rawBody));
      return parseStripeEvent(event);
    },

    async createCheckout(input) {
      // Stripe Checkout Session over the REST API (Stripe Tax on; account id in metadata so the
      // webhook can resolve the tenant). Documented path — not exercised in tests.
      // account id on BOTH the session (for the one-time checkout.session.completed path) AND, for a
      // subscription, on subscription_data[metadata] — Stripe reflects that onto every cycle invoice's
      // subscription_details.metadata, the only stable place the recurring-grant webhook can read it
      // (session metadata / client_reference_id do NOT propagate to invoices) — ADR-0089.
      const params: Record<string, string> = {
        mode: input.mode,
        "line_items[0][price]": input.priceId,
        "line_items[0][quantity]": "1",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.accountId,
        "metadata[account_id]": input.accountId,
        "automatic_tax[enabled]": "true",
      };
      if (input.mode === "subscription") {
        params["subscription_data[metadata][account_id]"] = input.accountId;
      } else {
        // One-time (payment) checkout (ADR-0113). The session carries no webhook-readable line items
        // without expansion, so stamp the price id on the SESSION metadata for the purchase->grant
        // resolution. Stamp account id (and price id) on `payment_intent_data[metadata]` too: Stripe
        // copies PaymentIntent metadata onto the Charge, so a later `charge.refunded` can resolve the
        // tenant + join back to this purchase by the PaymentIntent id (the refund clawback path).
        params["metadata[price_id]"] = input.priceId;
        params["payment_intent_data[metadata][account_id]"] = input.accountId;
        params["payment_intent_data[metadata][price_id]"] = input.priceId;
      }
      const res = await fetchWithTimeout(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(params).toString(),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) throw new InternalError("Stripe checkout creation failed");
      const data = (await res.json()) as { url?: string };
      if (data.url === undefined)
        throw new InternalError("Stripe returned no checkout url");
      return { url: data.url };
    },
  };
}

function paddleApiBase(env: PaddleConfig["env"]): string {
  return env === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export function createPaddleBilling(config: PaddleConfig): BillingProvider {
  return {
    verifyAndParse(rawBody, signatureHeader, opts) {
      verifyPaddleWebhook(rawBody, signatureHeader, config.webhookSecret, opts);
      // Envelope validation at the boundary (services-hardening MED finding): reject an envelope
      // with a missing/wrong-typed event_id/event_type/data BEFORE it reaches the mapper — a
      // signature check alone does not guarantee the payload SHAPE. Tolerant of the rest of the
      // documented envelope (occurred_at/notification_id) and future provider-additive fields — a
      // `.strict()` envelope rejected every REAL Paddle delivery (2026-07-04 live-verification
      // finding; see PaddleEventSchema). parseStrict throws a redaction-safe ValidationError
      // (never echoes the rejected value), which the route layer maps to a non-2xx so Paddle
      // retries — the mapper's existing fail-closed-to-null/defensive handling of a
      // well-formed-but-unrecognized `data` payload is unchanged.
      const event = parseStrict(PaddleEventSchema, JSON.parse(rawBody));
      return parsePaddleEvent(event, config.onWarn);
    },

    async createCheckout(input) {
      // Paddle Billing's primary checkout surface is Paddle.js (client-side overlay/inline, a client
      // token + Price id — ADR-0108), not a server-redirect flow like Stripe's. The `BillingProvider`
      // port still requires a `{ url }` (Stripe-shaped) result, so this drives Paddle's
      // transaction-based hosted-checkout path instead: create a `draft`/`ready` Transaction for the
      // price + tenant, and return the `checkout.url` Paddle hands back ("Pass a transaction to a
      // checkout" — developer.paddle.com). `input.mode` is unused: Paddle infers one-time vs. recurring
      // from the Price's own catalog configuration, not a per-request flag (unlike Stripe's
      // `mode: "payment" | "subscription"`). `cancelUrl` has no Paddle transaction-level equivalent
      // (handled client-side by Paddle.js) — kept on the shared port for Stripe parity only.
      const baseUrl = paddleApiBase(config.env);
      const body = {
        items: [{ price_id: input.priceId, quantity: 1 }],
        // The Caisson account/tenant id, propagated NATIVELY by Paddle onto the resulting transaction
        // (and, for a recurring price, the subscription it creates) — no metadata-stamping workaround
        // needed (ADR-0108, removes the Stripe driver's subscription_data[metadata] trick).
        custom_data: { account_id: input.accountId },
        checkout: { url: input.successUrl },
      };
      const res = await fetchWithTimeout(
        `${baseUrl}/transactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok)
        throw new InternalError("Paddle transaction creation failed");
      const data = (await res.json()) as {
        data?: { checkout?: { url?: string } };
      };
      const url = data.data?.checkout?.url;
      if (url === undefined)
        throw new InternalError("Paddle returned no checkout url");
      return { url };
    },

    async createDiscount(input) {
      // Mint an affiliate discount code via Paddle Billing's POST /discounts (ADR-0315). Same REST
      // shape as createCheckout above (paddleApiBase + Bearer + fetchWithTimeout). The program
      // parameters are FIXED (10% buyer-facing, operator-locked): `type: "percentage"` with
      // `amount: "10"` (percentage amount, 0.01–100 per Paddle's API), `enabled_for_checkout: true`
      // so buyers can redeem it, and `recur: true` so it applies across a subscription's billing
      // periods (not just the first). `usage_limit: null` = unlimited redemptions (an affiliate code
      // is shared, not single-use). The response's `data.id` is the `dsc_…` join key the webhook
      // mapper later reads off `transaction.completed.discount_id`.
      const baseUrl = paddleApiBase(config.env);
      // amount "10" = the operator-LOCKED 10% buyer-facing discount (ADR-0315). Fixed program
      // parameter, not a per-mint input — this package cannot depend "up" on the host that owns
      // the discount program (ADR-0003), so the locked value is inlined.
      const body = {
        description: input.description,
        type: "percentage",
        amount: "10",
        enabled_for_checkout: true,
        code: input.code,
        recur: true,
        usage_limit: null,
      };
      const res = await fetchWithTimeout(
        `${baseUrl}/discounts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) throw new InternalError("Paddle discount creation failed");
      // Zod-parse ONLY the fields we read (loose, never .strict() — Paddle's envelope carries the
      // full discount entity; we consume the id + code echo).
      const parsed = PaddleDiscountResponseSchema.safeParse(await res.json());
      const discountId = parsed.success ? parsed.data.data.id : "";
      if (discountId === "")
        throw new InternalError("Paddle returned no discount id");
      // Paddle uppercases/normalizes the stored code; prefer its echo, fall back to the input.
      const code =
        parsed.success && parsed.data.data.code !== undefined
          ? parsed.data.data.code
          : input.code;
      return { discountId, code };
    },
  };
}
