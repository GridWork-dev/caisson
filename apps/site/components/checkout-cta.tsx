"use client";

import type { ButtonProps } from "./button";
import { Button } from "./button";

export interface CheckoutCtaProps extends ButtonProps {
  /** The purchased-id this CTA leads toward (an edition slug or "bundle") — the Plausible event prop. */
  edition: string;
}

/**
 * The pricing page's "Get <edition>" buttons (ADR-0118): fires a typed Plausible custom event
 * ("Checkout: edition") on click, then navigates wherever `href` points — `/dashboard/plan` for a
 * real purchase intent, where the buyer is authed and the actual Paddle checkout opens with a
 * verified `accountId` (lib/paddle-checkout.ts). A `"use client"` wrapper because the kit `Button`
 * needs an `onClick`, while the page around it stays a Server Component / statically generated.
 */
export function CheckoutCta({ edition, onClick, ...rest }: CheckoutCtaProps) {
  return (
    <Button
      {...rest}
      onClick={(event) => {
        window.plausible?.("Checkout: edition", { props: { edition } });
        onClick?.(event);
      }}
    />
  );
}
