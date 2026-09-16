// Client-side Paddle.js checkout (ADR-0116). Opens the Paddle overlay for a given price id;
// env-gated on `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV` — ONLY the client
// token is ever exposed here, never the server API key (that stays server-side, in the future
// `services/license` webhook driver). The grant itself is server-side via the existing webhook ->
// services/license -> pricebook path (apply-billing-event.ts); this module's job ends at opening
// checkout. "use client" — Paddle.js runs in the browser only.
"use client";

import {
  CheckoutEventNames,
  type Paddle,
  type PaddleEventData,
  initializePaddle,
} from "@paddle/paddle-js";

import { trackEvent } from "./analytics";

let paddleInstance: Paddle | undefined;
let paddleInitPromise: Promise<Paddle | undefined> | undefined;

// G35: fired only once payment actually succeeds (never on overlay-open, never on cancel).
// Paddle.js accepts exactly ONE `eventCallback` per `Initialize()` call (a global slot, not
// per-`Checkout.open()`), so this module fans that single callback out to N listeners.
const completedListeners = new Set<() => void>();

function handlePaddleEvent(event: PaddleEventData): void {
  if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
    for (const listener of completedListeners) listener();
  }
}

/**
 * Register a callback for the Paddle `checkout.completed` event (G35 — the cart previously
 * cleared the instant the overlay OPENED, losing the buyer's lines on a cancel too). Returns an
 * unregister function; safe to call before Paddle has initialized — the listener just waits.
 */
export function onCheckoutCompleted(listener: () => void): () => void {
  completedListeners.add(listener);
  return () => completedListeners.delete(listener);
}

function paddleEnv(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
    ? "production"
    : "sandbox";
}

/**
 * Lazily initialize the Paddle.js instance once per page load. Returns `undefined` when
 * `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` is unset (inert seam, same pattern as every other
 * provider port — Resend, Plausible, OTel) so a checkout button can no-op gracefully rather than
 * throw in an environment with no Paddle account configured yet.
 *
 * G6: a load/init failure (ad-blocker, network, bad token) used to memoize the REJECTED promise
 * forever — a `Promise` is truthy regardless of settled state, so `if (!paddleInitPromise)` never
 * re-ran `initializePaddle()` again, permanently poisoning checkout for the rest of the session.
 * The `.catch()` below resets the memo to `undefined` on failure (so the NEXT call gets a fresh
 * `initializePaddle()`) and re-throws so a caller can surface a real error instead of silently
 * reverting.
 */
async function getPaddle(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (token === undefined || token.length === 0) return undefined;
  if (!paddleInitPromise) {
    paddleInitPromise = initializePaddle({
      token,
      environment: paddleEnv(),
      eventCallback: handlePaddleEvent,
    })
      .then((paddle) => {
        paddleInstance = paddle;
        return paddle;
      })
      .catch((err: unknown) => {
        paddleInitPromise = undefined;
        throw err;
      });
  }
  return paddleInitPromise;
}

export interface OpenCheckoutOptions {
  /** A real Paddle price id (`pri_…`), e.g. from `@caisson/pricebook`'s PURCHASE_BOOK/PLAN_BOOK keys. */
  priceId: string;
  /** The buyer's account id — stamped as `custom_data.account_id`, the SAME key the webhook's
   * `parsePaddleEvent` reads (paddle-events.ts `readAccountId`) so the grant resolves the tenant. */
  accountId: string;
}

/** One line of a multi-item checkout — quantity defaults to 1 (every SKU this site sells is a
 *  perpetual per-buyer license, never a stackable quantity). */
export interface CartCheckoutItem {
  priceId: string;
  quantity?: number;
}

/**
 * Open ONE Paddle.js checkout overlay for every line passed in `items` (confirmed against the
 * Paddle.js docs: `Checkout.open({ items: [...] })` already accepts a multi-item list — this is
 * the same call `openCheckout` makes below with a single-entry array, just generalized). A buyer
 * with N cart lines pays once, not N times. Same no-op-when-unconfigured contract as
 * `openCheckout`, and the same `custom_data.account_id` convention the webhook's
 * `parsePaddleEvent` reads to resolve the tenant.
 *
 * `discountCode` (SPEC-abandoned-checkout-email.md's discount fork, 2026-07-10 lock) is the
 * caller-validated `?promo=` search param — passed straight through to Paddle.js's own
 * `discountCode` checkout-open option (confirmed against developer.paddle.com: `Checkout.open`
 * accepts `discountCode` as a top-level option alongside `items`/`customData`). Omitted when
 * `undefined` — an unset discount is simply not part of the call, never a stray empty string.
 */
export async function openCartCheckout(
  items: readonly CartCheckoutItem[],
  accountId: string,
  discountCode?: string,
): Promise<boolean> {
  if (items.length === 0) return false;
  const paddle = await getPaddle();
  if (!paddle) return false;
  // begin_checkout (ADR-0237 F8) — fired only after the two no-op guards, so the funnel never
  // counts a click Paddle ignored.
  trackEvent("begin_checkout", { items: String(items.length) });
  paddle.Checkout.open({
    items: items.map((item) => ({
      priceId: item.priceId,
      quantity: item.quantity ?? 1,
    })),
    customData: { account_id: accountId },
    // Surface the business-name + tax/VAT-ID field so EU B2B buyers can enter a VAT number and get
    // the reverse-charge treatment at checkout rather than a post-purchase revision. `showAddTaxId`
    // defaults to `true` in Paddle.js, but we set it explicitly so the behaviour is pinned here and
    // survives a future default change (Paddle checkout settings, `showAddTaxId`).
    settings: { showAddTaxId: true },
    ...(discountCode !== undefined ? { discountCode } : {}),
  });
  return true;
}

/**
 * Open the Paddle.js checkout overlay for a single `priceId`. A no-op (resolves `false`) when
 * Paddle is not configured for this environment — callers should disable/hide the buy button in
 * that case rather than rely on this throwing. A thin single-item convenience over
 * `openCartCheckout`.
 */
export async function openCheckout(
  options: OpenCheckoutOptions,
): Promise<boolean> {
  return openCartCheckout(
    [{ priceId: options.priceId, quantity: 1 }],
    options.accountId,
  );
}

/** Whether Paddle checkout is configured in this environment (for conditionally rendering CTAs). */
export function isPaddleConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.length ?? 0) > 0;
}

/** Open only the transaction whose lines/account the server validated (ADR-0424). */
export async function openCartTransaction(
  transactionId: string,
): Promise<boolean> {
  if (!/^txn_[a-z0-9]{26}$/.test(transactionId)) return false;
  const paddle = await getPaddle();
  if (!paddle) return false;
  trackEvent("begin_checkout", { source: "server-cart" });
  paddle.Checkout.open({ transactionId, settings: { showAddTaxId: true } });
  return true;
}
