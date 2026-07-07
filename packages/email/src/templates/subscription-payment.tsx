// The subscription-CYCLE payment receipt (CAISSON-27). A subscription renewal charge
// (`invoice.paid` with `billingReason: "subscription_cycle"` — Paddle's `subscription_recurring`
// origin, a transaction carrying a subscription_id whose subscription already granted) is NOT a
// first purchase: it re-confirms an existing plan, so it must read as a recurring-payment receipt,
// not the "thanks for your purchase" first-buy copy. Reuses `purchase-confirmation.tsx`'s exact
// prop shape (`PurchaseConfirmationData`) — a subscription cycle is single-line by design (the
// plan) and always carries its own grand total, so the mixed-cart total-omission never applies
// here. Only the copy differs (heading / subject / body); the data + layout are identical.
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";
import type { PurchaseConfirmationData } from "./purchase-confirmation.tsx";

function formatMinor(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function subscriptionPaymentSubject(
  data: PurchaseConfirmationData,
): string {
  return `Your Caisson subscription payment ${data.orderId} was received`;
}

export function SubscriptionPaymentEmail(
  data: PurchaseConfirmationData,
): React.ReactElement {
  return (
    <EmailLayout
      preview={`Subscription payment ${data.orderId} — ${formatMinor(data.amountTotalMinor, data.currency)}`}
      heading="Subscription payment received"
    >
      <EmailBody>
        Thanks, {data.buyerName}. We received your subscription payment (order{" "}
        {data.orderId}). Your plan stays active.
      </EmailBody>
      {data.lines.map((line, i) => (
        <EmailBody key={`${line.label}-${String(i)}`}>
          {line.amountMinor === undefined
            ? line.label
            : `${line.label} — ${formatMinor(line.amountMinor, data.currency)}`}
        </EmailBody>
      ))}
      <EmailBody>
        Total charged: {formatMinor(data.amountTotalMinor, data.currency)}
      </EmailBody>
      <EmailButton href={data.dashboardUrl} label="View your dashboard" />
      <EmailBody>
        Pull your license and modules with bunx @caisson-sh/cli@latest using the
        account on your dashboard. Full terms are in the Caisson EULA at
        https://caisson.sh/legal/eula.
      </EmailBody>
    </EmailLayout>
  );
}
