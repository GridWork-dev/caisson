// The T-30d updates-window expiry notice (G24, customer-lifecycle audit 2026-07-07) — the sibling of
// `credits-expiring.tsx` on the updates-window axis. One bounded, no-PII prop set: the expiring
// entitlement id, the expiry date, and the license/dashboard URL. Sent once per (account,
// entitlement, expiry instant) by the host's updates-window-expiry sweep (the append-only
// `updates_window_expiry_notice` marker gates the send).
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export interface UpdatesWindowExpiringData {
  /** The purchased entitlement id whose updates window is expiring (rendered as a display label). */
  entitlementId: string;
  /** The window's expiry date, YYYY-MM-DD. */
  expiresOn: string;
  /** The customer license/dashboard page. */
  url: string;
}

function displayLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) =>
      w === "ai" || w === "ui"
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

export function updatesWindowExpiringSubject(
  data: UpdatesWindowExpiringData,
): string {
  return `Your ${displayLabel(data.entitlementId)} updates window ends ${data.expiresOn}`;
}

export function UpdatesWindowExpiringEmail(
  data: UpdatesWindowExpiringData,
): React.ReactElement {
  const label = displayLabel(data.entitlementId);
  return (
    <EmailLayout
      preview={`${label} updates window ends ${data.expiresOn}`}
      heading="Updates window expiring soon"
    >
      <EmailBody>
        Your {label} updates window ends {data.expiresOn}. New versions released
        after that date will require a renewal to keep pulling through the
        registry.
      </EmailBody>
      <EmailButton href={data.url} label="Renew updates" />
      <EmailBody>
        What you already installed keeps working: this only affects versions
        published after the window ends.
      </EmailBody>
    </EmailLayout>
  );
}
