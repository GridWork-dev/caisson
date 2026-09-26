// The template registry (ADR-0018): every `Emailer` driver renders through `renderEmailTemplate`
// so HTML and the plain-text fallback are generated from the SAME React component and never
// drift. The three auth templates take one bounded, no-PII prop — a one-time action URL; the
// `credits-expiring` billing notice (ADR-0252) adds its own per-template data shape, so the
// registry is keyed by a `TemplateDataMap` rather than one shared prop type.
import { render } from "react-email";
import {
  CreditsExpiringEmail,
  creditsExpiringSubject,
  type CreditsExpiringData,
} from "./credits-expiring.tsx";
import { MagicLinkEmail, MAGIC_LINK_SUBJECT } from "./magic-link.tsx";
import {
  PasswordResetEmail,
  PASSWORD_RESET_SUBJECT,
} from "./password-reset.tsx";
import { VerifyEmailEmail, VERIFY_EMAIL_SUBJECT } from "./verify-email.tsx";

export type EmailTemplateId =
  | "magic-link"
  | "password-reset"
  | "verify-email"
  | "credits-expiring";

export interface EmailTemplateData {
  url: string;
}

export type { CreditsExpiringData };

/** Per-template prop shapes — `renderEmailTemplate` is typed against this map. */
export interface TemplateDataMap {
  "magic-link": EmailTemplateData;
  "password-reset": EmailTemplateData;
  "verify-email": EmailTemplateData;
  "credits-expiring": CreditsExpiringData;
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
};

/** Stable display order for the dev preview route. */
export const EMAIL_TEMPLATE_IDS: readonly EmailTemplateId[] = [
  "magic-link",
  "password-reset",
  "verify-email",
  "credits-expiring",
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
