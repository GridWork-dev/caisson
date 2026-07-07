// The renewal-confirmation receipt (ADR-0251 sibling of purchase-confirmation.tsx) — a
// RENEWAL_BOOK line extends an existing entitlement's updates window rather than granting
// anything, so it never fires the purchase-confirmation email (gated on grantedEntitlements).
// Sent once per webhook renewal, next to (never instead of) the purchase-confirmation email on a
// mixed cart (services/license/src/app.ts's post-commit block — v1 accepts both firing). Same
// bounded prop set + voice as purchase-confirmation: buyer name, provider order id, the renewed
// line(s) with their new updates-window end date, the charged total (integer minor units, ADR-0007),
// and the dashboard link.
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export interface RenewalConfirmationLine {
  /** Human-readable renewed entitlement label (canonical product/bundle name). */
  label: string;
  /** The new updates-window end date, YYYY-MM-DD (mirrors credits-expiring's `expiresOn`). */
  newWindowEnd: string;
}

export interface RenewalConfirmationData {
  /** The buyer's display name, or their email when no name is on file. */
  buyerName: string;
  /** The provider order/transaction id, for support reference. */
  orderId: string;
  /** ISO currency code, e.g. "usd". */
  currency: string;
  /** The charged grand total, minor units (integer cents, ADR-0007). */
  amountTotalMinor: number;
  /** Per-line renewal breakdown. */
  lines: readonly RenewalConfirmationLine[];
  /** The buyer dashboard — license + registry access. */
  dashboardUrl: string;
}

function formatMinor(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function renewalConfirmationSubject(
  data: RenewalConfirmationData,
): string {
  return `Your Caisson renewal ${data.orderId} is confirmed`;
}

export function RenewalConfirmationEmail(
  data: RenewalConfirmationData,
): React.ReactElement {
  return (
    <EmailLayout
      preview={`Renewal ${data.orderId} — ${formatMinor(data.amountTotalMinor, data.currency)}`}
      heading="Renewal confirmed"
    >
      <EmailBody>
        Thanks, {data.buyerName}. Your renewal order {data.orderId} is
        confirmed.
      </EmailBody>
      {data.lines.map((line, i) => (
        <EmailBody key={`${line.label}-${String(i)}`}>
          {line.label} — updates through {line.newWindowEnd}
        </EmailBody>
      ))}
      <EmailBody>
        Total charged: {formatMinor(data.amountTotalMinor, data.currency)}
      </EmailBody>
      <EmailButton href={data.dashboardUrl} label="View your dashboard" />
      <EmailBody>
        Your updates window has been extended. Pull the latest with npx
        create-caisson using the account on your dashboard. Full terms are in
        the Caisson EULA at https://caisson.sh/legal/eula.
      </EmailBody>
    </EmailLayout>
  );
}
