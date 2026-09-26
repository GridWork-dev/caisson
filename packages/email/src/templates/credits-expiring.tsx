// The T-30d credit-expiry notice (ADR-0245/0252 Decision 6b) — the product's first
// transactional/billing template. One bounded, no-PII prop set: the expiring credit count, the
// expiry date, and the credits-dashboard URL. Sent once per grant by the `@caisson-sh/credits`
// expiry-notice sweep (the append-only `credit_expiry_notice` marker gates the send).
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export interface CreditsExpiringData {
  /** Unexpired remaining credits on the expiring grant (integer units, ADR-0007). */
  credits: number;
  /** The grant's expiry date, YYYY-MM-DD. */
  expiresOn: string;
  /** The customer credits dashboard. */
  url: string;
}

export function creditsExpiringSubject(data: CreditsExpiringData): string {
  return `${String(data.credits)} credits expire on ${data.expiresOn}`;
}

export function CreditsExpiringEmail(
  data: CreditsExpiringData,
): React.ReactElement {
  return (
    <EmailLayout
      preview={`${String(data.credits)} credits expire on ${data.expiresOn}`}
      heading="Credits expiring soon"
    >
      <EmailBody>
        {data.credits} credits expire on {data.expiresOn}. They burn first
        automatically; top up or use them before then.
      </EmailBody>
      <EmailButton href={data.url} label="View your credits" />
      <EmailBody>
        Credits roll over and each grant lives 12 months from issue. Anything
        unused on the expiry date is removed from your balance.
      </EmailBody>
    </EmailLayout>
  );
}
