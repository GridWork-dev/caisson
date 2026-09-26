// The post-purchase receipt (extends ADR-0203/0252's driver-gated notification pattern to a THIRD
// channel — email). Sent once per webhook grant, next to the Discord role push and the PostHog
// purchase capture (the host's post-commit webhook block). One bounded prop set: the
// buyer's display name, the provider order id, the per-line breakdown (integer minor units,
// ADR-0007, when a line's own charged amount is known — a sender without per-line amounts passes
// labels only and the accurate total still rides on `amountTotalMinor`), and the dashboard link —
// no PII beyond what the buyer
// already gave the checkout.
import {
  EmailBody,
  EmailButton,
  EmailLayout,
  EmailLink,
  EmailMono,
} from "./layout.tsx";

export interface PurchaseConfirmationLine {
  /** Human-readable line label (canonical product/bundle name). */
  label: string;
  /** This line's charged amount, minor units (integer cents, ADR-0007) — omitted when the caller
   *  has only a per-purchase total, not a verified per-line split. */
  amountMinor?: number;
}

export interface PurchaseConfirmationData {
  /** The buyer's display name, or their email when no name is on file. */
  buyerName: string;
  /** The provider order/transaction id, for support reference. */
  orderId: string;
  /** ISO currency code, e.g. "usd". */
  currency: string;
  /** The charged grand total, minor units (integer cents, ADR-0007). */
  amountTotalMinor: number;
  /** Per-line purchase breakdown. */
  lines: readonly PurchaseConfirmationLine[];
  /** The buyer dashboard — license + registry access. */
  dashboardUrl: string;
  /**
   * The buyer's signed license token (ADR-0292 first-mint webhook-push), when the post-commit
   * mint succeeded for this delivery. Omitted when unavailable — the receipt still sends either
   * way; the dashboard link above always re-serves the current token regardless.
   */
  licenseToken?: string;
}

function formatMinor(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function purchaseConfirmationSubject(
  data: PurchaseConfirmationData,
): string {
  return `Your Caisson order ${data.orderId} is confirmed`;
}

export function PurchaseConfirmationEmail(
  data: PurchaseConfirmationData,
): React.ReactElement {
  return (
    <EmailLayout
      preview={`Order ${data.orderId}: ${formatMinor(data.amountTotalMinor, data.currency)}`}
      heading="Purchase confirmed"
    >
      <EmailBody>
        Thanks, {data.buyerName}. Order <EmailMono>{data.orderId}</EmailMono> is
        confirmed.
      </EmailBody>
      {data.lines.map((line, i) => (
        <EmailBody key={`${line.label}-${String(i)}`}>
          {line.amountMinor === undefined
            ? line.label
            : `${line.label}: ${formatMinor(line.amountMinor, data.currency)}`}
        </EmailBody>
      ))}
      <EmailBody>
        Total charged: {formatMinor(data.amountTotalMinor, data.currency)}
      </EmailBody>
      <EmailButton href={data.dashboardUrl} label="View your dashboard" />
      {data.licenseToken !== undefined && (
        <>
          <EmailBody>Your license is ready:</EmailBody>
          <EmailBody>
            <EmailMono>{data.licenseToken}</EmailMono>
          </EmailBody>
        </>
      )}
      <EmailBody>
        Pull your license and modules with{" "}
        <EmailMono>bunx @caisson-sh/cli@latest</EmailMono> using the account on
        your dashboard. Full terms are in the{" "}
        <EmailLink href="https://caisson.sh/legal/eula">Caisson EULA</EmailLink>
        .
      </EmailBody>
    </EmailLayout>
  );
}
