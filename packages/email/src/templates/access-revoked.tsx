// The revoke/refund buyer-facing notice (G27, buyer-lifecycle audit 2026-07-07): fired post-commit
// from the SAME seam as the purchase/renewal confirmations (the host's webhook handler)
// whenever a subscription cancel or a refund actually revoked an active grant. Before this
// template, `subscription.canceled`/`refund.completed` returned NO_EFFECT and fired nothing — a
// buyer found entitlements silently gone on their next dashboard visit. One bounded prop set, no
// entitlement listing (the mapper surfaces only "something was revoked", not which ids — the
// dashboard is the detailed source of truth).
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export type AccessRevokedReason = "subscription_canceled" | "refund";

export interface AccessRevokedData {
  /** The buyer's display name, or their email when no name is on file. */
  buyerName: string;
  /** What triggered this notice — selects the copy. */
  reason: AccessRevokedReason;
  /** The buyer dashboard — the current, authoritative entitlement list. */
  dashboardUrl: string;
}

export function accessRevokedSubject(data: AccessRevokedData): string {
  return data.reason === "refund"
    ? "Your Caisson refund has been processed"
    : "Your Caisson subscription has been canceled";
}

export function AccessRevokedEmail(
  data: AccessRevokedData,
): React.ReactElement {
  const body =
    data.reason === "refund"
      ? "Your refund has been processed, and any access it granted has been removed."
      : "Your subscription has been canceled, and any subscription-sourced access has ended.";
  return (
    <EmailLayout
      preview={accessRevokedSubject(data)}
      heading={
        data.reason === "refund" ? "Refund processed" : "Subscription canceled"
      }
    >
      <EmailBody>
        Hi {data.buyerName}. {body}
      </EmailBody>
      <EmailButton
        href={data.dashboardUrl}
        label="View your current entitlements"
      />
      <EmailBody>
        Anything you still own (a separate purchase, or a still-active
        subscription) is unaffected. If this was unexpected, reach out through
        the support links on your dashboard.
      </EmailBody>
    </EmailLayout>
  );
}
