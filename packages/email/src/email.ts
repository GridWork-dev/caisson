// Provider-agnostic transactional email. The `Emailer` port has two drivers: a capture
// driver (records sends in memory for tests — never touches the network) and a Resend driver (prod)
// that POSTs via `fetchWithTimeout` (ADR-0002) and reads its API key from injected config — no
// provider key in code. `template`/`data` stay free-form on the port itself (the `alerting`
// package sends free-form operator alerts through this same port with its own template
// namespace) — every network driver tries the React-Email registry
// (`./templates/index.ts#tryRenderEmailTemplate`) first and falls back to the original honest
// template/data mapping when `template` isn't one of the branded ids.
import { fetchWithTimeout, InternalError } from "@caisson/kernel";
import { tryRenderEmailTemplate } from "./templates/index.ts";
export {
  EMAIL_TEMPLATE_IDS,
  renderEmailTemplate,
  tryRenderEmailTemplate,
  type EmailTemplateData,
  type EmailTemplateId,
  type RenderedEmail,
} from "./templates/index.ts";

export interface EmailMessage {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

/** The port: one method, provider-agnostic, the only seam callers depend on. */
export interface Emailer {
  send(msg: EmailMessage): Promise<void>;
}

/** A test driver that records every send in memory for recipient/template/data assertions. */
export interface CaptureEmailer extends Emailer {
  readonly sent: readonly EmailMessage[];
}

/**
 * In-memory `Emailer` for tests + the framework-agnostic reference. Records each send into a
 * private array exposed read-only via `sent` (preserving send order); never hits the network.
 */
export function createCaptureEmailer(): CaptureEmailer {
  const sent: EmailMessage[] = [];
  return {
    async send(msg: EmailMessage): Promise<void> {
      sent.push(msg);
    },
    get sent(): readonly EmailMessage[] {
      return sent;
    },
  };
}

export interface ResendConfig {
  apiKey: string;
  from: string;
  /** Optional Reply-To address — replies to a transactional send land here instead of bouncing
   *  off the (typically no-reply) sender identity. Omitted from the wire body when unset. */
  replyTo?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Production `Emailer` backed by Resend. The API key is injected via `config` — never read from a
 * module-level constant or hardcoded. Every outbound call routes through `fetchWithTimeout`. A
 * non-ok response throws `InternalError` WITHOUT the response body — the upstream error can echo
 * the recipient or key fragments, so it is never leaked to the caller.
 */
export function createResendEmailer(config: ResendConfig): Emailer {
  return {
    async send(msg: EmailMessage): Promise<void> {
      const rendered = await tryRenderEmailTemplate(msg.template, msg.data);
      const res = await fetchWithTimeout(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: msg.to,
          // Resend's raw REST field (snake_case) — this driver speaks the HTTP API, not the SDK.
          ...(config.replyTo !== undefined ? { reply_to: config.replyTo } : {}),
          subject: rendered?.subject ?? msg.template,
          ...(rendered ? { html: rendered.html } : {}),
          text: rendered?.text ?? JSON.stringify(msg.data),
        }),
      });
      if (!res.ok) {
        // Do NOT include the response body — it can echo recipient / key fragments.
        throw new InternalError("email send failed");
      }
    },
  };
}
