// The abandoned-checkout nudge (SPEC outputs/specs/deferred-respec/SPEC-abandoned-checkout-email.md,
// operator-locked 2026-07-10). Matches `purchase-confirmation.tsx`'s tone exactly: a flat
// statement of fact, the line items, one `EmailButton` back to the cart — no urgency copy, no
// countdown, no "act now" (the same restraint `credits-expiring.tsx` uses). Sent once per
// abandoned checkout by the host's abandoned-checkout sweep (the append-only
// `checkout_abandonment_notice` marker gates the send). The discount block (env-gated,
// `resolveAbandonedCheckoutDiscount`) is one plain sentence + the code — still no urgency framing.
import { EmailBody, EmailButton, EmailLayout, EmailLink } from "./layout.tsx";

export interface AbandonedCheckoutLine {
  label: string;
}

export interface AbandonedCheckoutData {
  /** The buyer's display name, or their email when no name is on file. */
  buyerName: string;
  /** The abandoned cart's lines (labels only). */
  lines: readonly AbandonedCheckoutLine[];
  /** The plain cart link — always present, always rendered (named `url`, not `cartUrl`, to match
   *  the other single-CTA templates — `credits-expiring`/`updates-window-expiring`). */
  url: string;
  /** Human discount copy, e.g. "10% off" — present only when BOTH discount env vars are set. */
  discountLabel?: string;
  /** The cart link with the discount's `?promo=` param — present only alongside `discountLabel`. */
  discountUrl?: string;
}

/** Fixed subject (no per-send variable, mirrors `MAGIC_LINK_SUBJECT`'s convention) — the copy is
 *  the SAME flat statement whether the cart holds one item or five. */
export const ABANDONED_CHECKOUT_SUBJECT = "Your cart is still here";

export function AbandonedCheckoutEmail(
  data: AbandonedCheckoutData,
): React.ReactElement {
  return (
    <EmailLayout
      preview="Your cart is still here"
      heading="Your cart is still here"
    >
      <EmailBody>
        Hi {data.buyerName}. You started checkout but didn't finish: your cart
        is still here, whenever you're ready.
      </EmailBody>
      {data.lines.map((line, i) => (
        <EmailBody key={`${line.label}-${String(i)}`}>{line.label}</EmailBody>
      ))}
      <EmailButton href={data.url} label="Return to cart" />
      {data.discountLabel !== undefined && data.discountUrl !== undefined && (
        <EmailBody>
          {data.discountLabel} if you complete checkout at{" "}
          <EmailLink href={data.discountUrl}>this link</EmailLink>.
        </EmailBody>
      )}
    </EmailLayout>
  );
}
