// Sample data for every branded email template — shared between the catalog page's preview render
// and the send-test route, so a test send always matches what the operator just looked at.
import {
  EMAIL_TEMPLATE_IDS,
  type EmailTemplateId,
  type TemplateDataMap,
} from "@caisson/email";

export const EMAIL_SAMPLE_DATA: { [K in EmailTemplateId]: TemplateDataMap[K] } =
  {
    "magic-link": {
      url: "https://caisson.sh/api/auth/magic-link/verify?token=sample",
    },
    "password-reset": {
      url: "https://caisson.sh/api/auth/reset-password/sample?callbackURL=/reset-password",
    },
    "verify-email": {
      url: "https://caisson.sh/api/auth/verify-email?token=sample",
    },
    "credits-expiring": {
      credits: 120,
      expiresOn: "2027-07-06",
      url: "https://caisson.sh/dashboard/credits",
    },
    "updates-window-expiring": {
      entitlementId: "compliance",
      expiresOn: "2027-08-06",
      url: "https://caisson.sh/dashboard/license",
    },
    "purchase-confirmation": {
      buyerName: "Sample Buyer",
      orderId: "txn_01sample",
      currency: "usd",
      amountTotalMinor: 104900,
      lines: [{ label: "Compliance bundle", amountMinor: 104900 }],
      dashboardUrl: "https://caisson.sh/dashboard",
    },
    "subscription-payment-received": {
      buyerName: "Sample Buyer",
      orderId: "txn_01cycle",
      currency: "usd",
      amountTotalMinor: 149900,
      lines: [{ label: "Compliance Updates" }],
      dashboardUrl: "https://caisson.sh/dashboard",
    },
    "renewal-confirmation": {
      buyerName: "Sample Buyer",
      orderId: "txn_01sample",
      currency: "usd",
      amountTotalMinor: 41900,
      lines: [{ label: "Compliance bundle", newWindowEnd: "2028-07-06" }],
      dashboardUrl: "https://caisson.sh/dashboard",
    },
    "access-revoked": {
      buyerName: "Sample Buyer",
      reason: "refund",
      dashboardUrl: "https://caisson.sh/dashboard",
    },
    "waitlist-welcome": {
      email: "sample-buyer@example.com",
      bundle: "Compliance",
    },
    "nurture-follow-up": {
      email: "sample-buyer@example.com",
      bundle: "Compliance",
    },
  };

/** Runtime membership check for a request-supplied id — never trust an unchecked string. */
export function isEmailTemplateId(id: string): id is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as readonly string[]).includes(id);
}
