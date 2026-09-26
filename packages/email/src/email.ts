// Provider-agnostic transactional email. The `Emailer` port has two drivers: a capture
// driver (records sends in memory for tests — never touches the network) and a Resend driver (prod)
// that POSTs via `fetchWithTimeout` (ADR-0002) and reads its API key from injected config — no
// provider key in code. `template`/`data` stay free-form on the port itself (the `alerting`
// package sends free-form operator alerts through this same port with its own template
// namespace) — every network driver tries the React-Email registry
// (`./templates/index.ts#tryRenderEmailTemplate`) first and falls back to the original honest
// template/data mapping when `template` isn't one of the branded ids.
import { fetchWithTimeout, InternalError } from "@caisson-sh/kernel";
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

/** Remaining-send quota telemetry parsed from Resend's response headers on a successful send.
 *  `x-resend-monthly-quota` is present on every plan; `x-resend-daily-quota` only on the free
 *  plan. `null` = header absent or non-numeric (never fabricated). */
export interface ResendQuota {
  monthlyRemaining: number | null;
  dailyRemaining: number | null;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
  /** Optional Reply-To address — replies to a transactional send land here instead of bouncing
   *  off the (typically no-reply) sender identity. Omitted from the wire body when unset. */
  replyTo?: string;
  /** Optional quota observer, called after each SUCCESSFUL send with the remaining-quota headers
   *  Resend returns (its API exposes no usage endpoint — these headers are the only programmatic
   *  signal). Observer errors are swallowed: telemetry must never break a send. */
  onQuota?: (quota: ResendQuota) => void;
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
      if (config.onQuota) {
        try {
          config.onQuota({
            monthlyRemaining: parseQuotaHeader(
              res.headers.get("x-resend-monthly-quota"),
            ),
            dailyRemaining: parseQuotaHeader(
              res.headers.get("x-resend-daily-quota"),
            ),
          });
        } catch {
          // Quota telemetry must never break a send.
        }
      }
    },
  };
}

/** `null` for absent/empty/non-numeric header values — a missing or blank header is "unknown",
 *  never 0 (Number("") is 0, which would read as "quota exhausted" and fire a false alert). */
function parseQuotaHeader(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
