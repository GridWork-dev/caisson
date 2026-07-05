// The template registry (ADR-0018): every `Emailer` driver renders through `renderEmailTemplate`
// so HTML and the plain-text fallback are generated from the SAME React component and never
// drift. Every template today takes one bounded, no-PII prop — a one-time action URL — matching
// the `EmailTemplateData` shape on the port.
import { render } from "@react-email/render";
import { MagicLinkEmail, MAGIC_LINK_SUBJECT } from "./magic-link.tsx";
import {
  PasswordResetEmail,
  PASSWORD_RESET_SUBJECT,
} from "./password-reset.tsx";
import { VerifyEmailEmail, VERIFY_EMAIL_SUBJECT } from "./verify-email.tsx";

export type EmailTemplateId = "magic-link" | "password-reset" | "verify-email";

export interface EmailTemplateData {
  url: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const TEMPLATES: Record<
  EmailTemplateId,
  {
    subject: string;
    Component: (data: EmailTemplateData) => React.ReactElement;
  }
> = {
  "magic-link": { subject: MAGIC_LINK_SUBJECT, Component: MagicLinkEmail },
  "password-reset": {
    subject: PASSWORD_RESET_SUBJECT,
    Component: PasswordResetEmail,
  },
  "verify-email": {
    subject: VERIFY_EMAIL_SUBJECT,
    Component: VerifyEmailEmail,
  },
};

/** Stable display order for the dev preview route. */
export const EMAIL_TEMPLATE_IDS: readonly EmailTemplateId[] = [
  "magic-link",
  "password-reset",
  "verify-email",
];

/** Render one template + its plain-text fallback from the SAME element (never drift). */
export async function renderEmailTemplate(
  template: EmailTemplateId,
  data: EmailTemplateData,
): Promise<RenderedEmail> {
  const entry = TEMPLATES[template];
  const element = entry.Component(data);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { subject: entry.subject, html, text };
}

function isEmailTemplateId(template: string): template is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as readonly string[]).includes(template);
}

function hasUrl(data: Record<string, unknown>): boolean {
  return typeof data.url === "string";
}

/**
 * The `Emailer` port is shared with non-buyer-facing callers (e.g. `@caisson/alerting`'s
 * operator alert emails, which use free-form `template` names like `alert.system.error_rate_high`
 * and arbitrary `data`) — those were never meant to render as a branded template. This renders
 * ONLY when `template` is a known branded id and `data` carries the `{url}` shape every branded
 * template expects; otherwise it returns `null` so the driver falls back to a generic mapping.
 */
export async function tryRenderEmailTemplate(
  template: string,
  data: Record<string, unknown>,
): Promise<RenderedEmail | null> {
  if (!isEmailTemplateId(template) || !hasUrl(data)) return null;
  return renderEmailTemplate(template, { url: String(data.url) });
}
