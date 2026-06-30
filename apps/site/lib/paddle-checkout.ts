// Client-side Paddle.js checkout (ADR-0116). Opens the Paddle overlay for a given price id;
// env-gated on `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV` — ONLY the client
// token is ever exposed here, never the server API key (that stays server-side, in the future
// `services/license` webhook driver). The grant itself is server-side via the existing webhook ->
// services/license -> pricebook path (apply-billing-event.ts); this module's job ends at opening
// checkout. "use client" — Paddle.js runs in the browser only.
"use client";

import { type Paddle, initializePaddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | undefined;
let paddleInitPromise: Promise<Paddle | undefined> | undefined;

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
 */
async function getPaddle(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (token === undefined || token.length === 0) return undefined;
  if (!paddleInitPromise) {
    paddleInitPromise = initializePaddle({
      token,
      environment: paddleEnv(),
    }).then((paddle) => {
      paddleInstance = paddle;
      return paddle;
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

/**
 * Open the Paddle.js checkout overlay for `priceId`. A no-op (resolves `false`) when Paddle is
 * not configured for this environment — callers should disable/hide the buy button in that case
 * rather than rely on this throwing.
 */
export async function openCheckout(
  options: OpenCheckoutOptions,
): Promise<boolean> {
  const paddle = await getPaddle();
  if (!paddle) return false;
  paddle.Checkout.open({
    items: [{ priceId: options.priceId, quantity: 1 }],
    customData: { account_id: options.accountId },
  });
  return true;
}

/** Whether Paddle checkout is configured in this environment (for conditionally rendering CTAs). */
export function isPaddleConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.length ?? 0) > 0;
}
