// The template registry (ADR-0018): every `Emailer` driver renders through `renderEmailTemplate`
// so HTML and the plain-text fallback are generated from the SAME React component and never
// drift. The three auth templates take one bounded, no-PII prop — a one-time action URL; the
// `credits-expiring` billing notice (ADR-0252) and the `purchase-confirmation` receipt (services/
// license's post-webhook-commit send) each add a per-template data shape, so the registry is
// keyed by a `TemplateDataMap` rather than one shared prop type.
import { render } from "react-email";
import {
  AbandonedCheckoutEmail,
  ABANDONED_CHECKOUT_SUBJECT,
  type AbandonedCheckoutData,
  type AbandonedCheckoutLine,
} from "./abandoned-checkout.tsx";
import {
  AccessRevokedEmail,
  accessRevokedSubject,
  type AccessRevokedData,
} from "./access-revoked.tsx";
import {
  CreditsExpiringEmail,
  creditsExpiringSubject,
  type CreditsExpiringData,
} from "./credits-expiring.tsx";
import { MagicLinkEmail, MAGIC_LINK_SUBJECT } from "./magic-link.tsx";
import {
  NurtureFollowUpEmail,
  nurtureSubject,
  type NurtureFollowUpData,
} from "./nurture-follow-up.tsx";
import {
  PasswordResetEmail,
  PASSWORD_RESET_SUBJECT,
} from "./password-reset.tsx";
import {
  PurchaseConfirmationEmail,
  purchaseConfirmationSubject,
  type PurchaseConfirmationData,
  type PurchaseConfirmationLine,
} from "./purchase-confirmation.tsx";
import {
  RenewalConfirmationEmail,
  renewalConfirmationSubject,
  type RenewalConfirmationData,
  type RenewalConfirmationLine,
} from "./renewal-confirmation.tsx";
import {
  SubscriptionPaymentEmail,
  subscriptionPaymentSubject,
} from "./subscription-payment.tsx";
import {
  UpdatesWindowExpiringEmail,
  updatesWindowExpiringSubject,
  type UpdatesWindowExpiringData,
} from "./updates-window-expiring.tsx";
import { VerifyEmailEmail, VERIFY_EMAIL_SUBJECT } from "./verify-email.tsx";
import {
  WaitlistWelcomeEmail,
  waitlistWelcomeSubject,
  type WaitlistWelcomeData,
} from "./waitlist-welcome.tsx";

export type EmailTemplateId =
  | "magic-link"
  | "password-reset"
  | "verify-email"
  | "credits-expiring"
  | "updates-window-expiring"
  | "purchase-confirmation"
  | "subscription-payment-received"
  | "renewal-confirmation"
  | "access-revoked"
  | "waitlist-welcome"
  | "nurture-follow-up"
  | "abandoned-checkout";

export interface EmailTemplateData {
  url: string;
}

export type {
  AbandonedCheckoutData,
  AbandonedCheckoutLine,
  AccessRevokedData,
  CreditsExpiringData,
  NurtureFollowUpData,
  PurchaseConfirmationData,
  PurchaseConfirmationLine,
  RenewalConfirmationData,
  RenewalConfirmationLine,
  UpdatesWindowExpiringData,
  WaitlistWelcomeData,
};

/** Per-template prop shapes — `renderEmailTemplate` is typed against this map. */
export interface TemplateDataMap {
  "magic-link": EmailTemplateData;
  "password-reset": EmailTemplateData;
  "verify-email": EmailTemplateData;
  "credits-expiring": CreditsExpiringData;
  "updates-window-expiring": UpdatesWindowExpiringData;
  "purchase-confirmation": PurchaseConfirmationData;
  // A subscription-cycle receipt shares the purchase-confirmation prop shape — only
  // the copy differs.
  "subscription-payment-received": PurchaseConfirmationData;
  "renewal-confirmation": RenewalConfirmationData;
  "access-revoked": AccessRevokedData;
  "waitlist-welcome": WaitlistWelcomeData;
  "nurture-follow-up": NurtureFollowUpData;
  "abandoned-checkout": AbandonedCheckoutData;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface TemplateEntry<K extends EmailTemplateId> {
  subject: string | ((data: TemplateDataMap[K]) => string);
  Component: (data: TemplateDataMap[K]) => React.ReactElement;
  /** Free-form driver `data` → this template's shape, or null when it doesn't fit. */
  coerce: (data: Record<string, unknown>) => TemplateDataMap[K] | null;
}

function coerceUrl(data: Record<string, unknown>): EmailTemplateData | null {
  return typeof data.url === "string" ? { url: data.url } : null;
}

/** Shared coercer for the two growth-email shapes: a bounded email + an optional bundle label. */
function coerceEmailBundle(
  data: Record<string, unknown>,
): { email: string; bundle?: string } | null {
  if (typeof data.email !== "string") return null;
  if (data.bundle === undefined) return { email: data.email };
  return typeof data.bundle === "string"
    ? { email: data.email, bundle: data.bundle }
    : null;
}

function coercePurchaseLine(line: unknown): PurchaseConfirmationLine | null {
  if (typeof line !== "object" || line === null) return null;
  const { label, amountMinor } = line as Record<string, unknown>;
  if (typeof label !== "string") return null;
  if (amountMinor === undefined) return { label };
  return typeof amountMinor === "number" && Number.isInteger(amountMinor)
    ? { label, amountMinor }
    : null;
}

function coerceRenewalLine(line: unknown): RenewalConfirmationLine | null {
  if (typeof line !== "object" || line === null) return null;
  const { label, newWindowEnd } = line as Record<string, unknown>;
  return typeof label === "string" && typeof newWindowEnd === "string"
    ? { label, newWindowEnd }
    : null;
}

function coerceRenewalConfirmation(
  data: Record<string, unknown>,
): RenewalConfirmationData | null {
  // amountTotalMinor is OPTIONAL (omitted on a mixed cart — the purchase receipt owns the total),
  // but when present it must be an integer (ADR-0007).
  const amountTotalMinor = data.amountTotalMinor;
  if (
    amountTotalMinor !== undefined &&
    (typeof amountTotalMinor !== "number" ||
      !Number.isInteger(amountTotalMinor))
  ) {
    return null;
  }
  if (
    typeof data.buyerName !== "string" ||
    typeof data.orderId !== "string" ||
    typeof data.currency !== "string" ||
    typeof data.dashboardUrl !== "string" ||
    !Array.isArray(data.lines)
  ) {
    return null;
  }
  const lines: RenewalConfirmationLine[] = [];
  for (const raw of data.lines) {
    const line = coerceRenewalLine(raw);
    if (line === null) return null;
    lines.push(line);
  }
  return {
    buyerName: data.buyerName,
    orderId: data.orderId,
    currency: data.currency,
    amountTotalMinor,
    lines,
    dashboardUrl: data.dashboardUrl,
  };
}

function coercePurchaseConfirmation(
  data: Record<string, unknown>,
): PurchaseConfirmationData | null {
  if (
    typeof data.buyerName !== "string" ||
    typeof data.orderId !== "string" ||
    typeof data.currency !== "string" ||
    typeof data.amountTotalMinor !== "number" ||
    !Number.isInteger(data.amountTotalMinor) ||
    typeof data.dashboardUrl !== "string" ||
    !Array.isArray(data.lines)
  ) {
    return null;
  }
  // Optional (ADR-0292): present only when the driver's caller resolved a fresh mint for this
  // delivery — absent renders the receipt without the license block, `unknown`-typed (e.g. `null`,
  // a number) fails the coercer closed rather than passing a bad value to the render. Spread in
  // conditionally (never `licenseToken: undefined`) — `exactOptionalPropertyTypes` distinguishes
  // "key absent" from "key present with an undefined value" and the target type demands the former.
  const { licenseToken } = data;
  if (licenseToken !== undefined && typeof licenseToken !== "string") {
    return null;
  }
  const lines: PurchaseConfirmationLine[] = [];
  for (const raw of data.lines) {
    const line = coercePurchaseLine(raw);
    if (line === null) return null;
    lines.push(line);
  }
  return {
    buyerName: data.buyerName,
    orderId: data.orderId,
    currency: data.currency,
    amountTotalMinor: data.amountTotalMinor,
    lines,
    dashboardUrl: data.dashboardUrl,
    ...(licenseToken !== undefined ? { licenseToken } : {}),
  };
}

function coerceAbandonedCheckoutLine(
  line: unknown,
): AbandonedCheckoutLine | null {
  if (typeof line !== "object" || line === null) return null;
  const { label } = line as Record<string, unknown>;
  return typeof label === "string" ? { label } : null;
}

/** The abandoned-checkout coercer. `discountLabel`/`discountUrl` are optional and must arrive
 *  together (BOTH present or BOTH absent) — a half-set discount pair fails closed rather than
 *  rendering a label with no link or a link with no label. */
function coerceAbandonedCheckout(
  data: Record<string, unknown>,
): AbandonedCheckoutData | null {
  if (
    typeof data.buyerName !== "string" ||
    typeof data.url !== "string" ||
    !Array.isArray(data.lines)
  ) {
    return null;
  }
  const { discountLabel, discountUrl } = data;
  if (
    (discountLabel === undefined) !== (discountUrl === undefined) ||
    (discountLabel !== undefined && typeof discountLabel !== "string") ||
    (discountUrl !== undefined && typeof discountUrl !== "string")
  ) {
    return null;
  }
  const lines: AbandonedCheckoutLine[] = [];
  for (const raw of data.lines) {
    const line = coerceAbandonedCheckoutLine(raw);
    if (line === null) return null;
    lines.push(line);
  }
  return {
    buyerName: data.buyerName,
    url: data.url,
    lines,
    ...(discountLabel !== undefined && discountUrl !== undefined
      ? { discountLabel, discountUrl }
      : {}),
  };
}

/** G27 — the revoke/refund notice coercer. `reason` is a closed two-value enum. */
function coerceAccessRevoked(
  data: Record<string, unknown>,
): AccessRevokedData | null {
  if (
    typeof data.buyerName !== "string" ||
    typeof data.dashboardUrl !== "string" ||
    (data.reason !== "subscription_canceled" && data.reason !== "refund")
  ) {
    return null;
  }
  return {
    buyerName: data.buyerName,
    reason: data.reason,
    dashboardUrl: data.dashboardUrl,
  };
}

const TEMPLATES: { [K in EmailTemplateId]: TemplateEntry<K> } = {
  "magic-link": {
    subject: MAGIC_LINK_SUBJECT,
    Component: MagicLinkEmail,
    coerce: coerceUrl,
  },
  "password-reset": {
    subject: PASSWORD_RESET_SUBJECT,
    Component: PasswordResetEmail,
    coerce: coerceUrl,
  },
  "verify-email": {
    subject: VERIFY_EMAIL_SUBJECT,
    Component: VerifyEmailEmail,
    coerce: coerceUrl,
  },
  "credits-expiring": {
    subject: creditsExpiringSubject,
    Component: CreditsExpiringEmail,
    coerce: (data) =>
      typeof data.credits === "number" &&
      Number.isInteger(data.credits) &&
      typeof data.expiresOn === "string" &&
      typeof data.url === "string"
        ? { credits: data.credits, expiresOn: data.expiresOn, url: data.url }
        : null,
  },
  "updates-window-expiring": {
    subject: updatesWindowExpiringSubject,
    Component: UpdatesWindowExpiringEmail,
    coerce: (data) =>
      typeof data.entitlementId === "string" &&
      typeof data.expiresOn === "string" &&
      typeof data.url === "string"
        ? {
            entitlementId: data.entitlementId,
            expiresOn: data.expiresOn,
            url: data.url,
          }
        : null,
  },
  "purchase-confirmation": {
    subject: purchaseConfirmationSubject,
    Component: PurchaseConfirmationEmail,
    coerce: coercePurchaseConfirmation,
  },
  "subscription-payment-received": {
    subject: subscriptionPaymentSubject,
    Component: SubscriptionPaymentEmail,
    // Same data shape as the purchase receipt — reuse its coercer.
    coerce: coercePurchaseConfirmation,
  },
  "renewal-confirmation": {
    subject: renewalConfirmationSubject,
    Component: RenewalConfirmationEmail,
    coerce: coerceRenewalConfirmation,
  },
  "access-revoked": {
    subject: accessRevokedSubject,
    Component: AccessRevokedEmail,
    coerce: coerceAccessRevoked,
  },
  "waitlist-welcome": {
    subject: waitlistWelcomeSubject,
    Component: WaitlistWelcomeEmail,
    coerce: coerceEmailBundle,
  },
  "nurture-follow-up": {
    subject: nurtureSubject,
    Component: NurtureFollowUpEmail,
    coerce: coerceEmailBundle,
  },
  "abandoned-checkout": {
    subject: ABANDONED_CHECKOUT_SUBJECT,
    Component: AbandonedCheckoutEmail,
    coerce: coerceAbandonedCheckout,
  },
};

/** Stable display order for the dev preview route. */
export const EMAIL_TEMPLATE_IDS: readonly EmailTemplateId[] = [
  "magic-link",
  "password-reset",
  "verify-email",
  "credits-expiring",
  "updates-window-expiring",
  "purchase-confirmation",
  "subscription-payment-received",
  "renewal-confirmation",
  "access-revoked",
  "waitlist-welcome",
  "nurture-follow-up",
  "abandoned-checkout",
];

/** Render one template + its plain-text fallback from the SAME element (never drift). */
export async function renderEmailTemplate<K extends EmailTemplateId>(
  template: K,
  data: TemplateDataMap[K],
): Promise<RenderedEmail> {
  const entry = TEMPLATES[template];
  const element = entry.Component(data);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  const subject =
    typeof entry.subject === "function" ? entry.subject(data) : entry.subject;
  return { subject, html, text };
}

/** Runtime membership check for a request-supplied id — never trust an unchecked string. */
export function isEmailTemplateId(
  template: string,
): template is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as readonly string[]).includes(template);
}

/**
 * The `Emailer` port is shared with non-customer-facing callers (e.g. `@caisson-sh/alerting`'s
 * operator alert emails, which use free-form `template` names like `alert.system.error_rate_high`
 * and arbitrary `data`) — those were never meant to render as a branded template. This renders
 * ONLY when `template` is a known branded id and `data` coerces to that template's expected
 * shape; otherwise it returns `null` so the driver falls back to a generic mapping.
 */
export async function tryRenderEmailTemplate(
  template: string,
  data: Record<string, unknown>,
): Promise<RenderedEmail | null> {
  if (!isEmailTemplateId(template)) return null;
  // Narrow per-id so the coerce/render pair stays type-correlated.
  const attempt = async <K extends EmailTemplateId>(
    id: K,
  ): Promise<RenderedEmail | null> => {
    const coerced = TEMPLATES[id].coerce(data);
    if (coerced === null) return null;
    return renderEmailTemplate(id, coerced);
  };
  return attempt(template);
}
