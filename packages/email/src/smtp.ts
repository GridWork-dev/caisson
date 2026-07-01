// SMTP production driver for the `Emailer` port (ADR-0170), backed by `nodemailer`. This same
// driver also serves AWS SES: SES exposes an SMTP interface, so `ses.ts` just points this at
// SES's regional SMTP endpoint (see `sesSmtpConfig`) instead of a separate `aws-sdk` driver.
import nodemailer from "nodemailer";
import type { Emailer, EmailMessage } from "./email.ts";

/**
 * The subset of nodemailer's `Transporter` this driver depends on. Tests inject a fake here so
 * `send` never opens a real SMTP connection.
 */
export interface SmtpTransport {
  sendMail(msg: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** TLS-on-connect (port 465). Defaults to false (STARTTLS on 587/25). */
  secure?: boolean;
  /**
   * Override the underlying transport. Tests inject a fake here instead of host/user/pass so
   * `send` runs fully offline.
   */
  transport?: SmtpTransport;
}

/**
 * Production `Emailer` backed by SMTP. The template is a name, not a render target: the body is a
 * minimal deterministic text mapping (subject = template, body = JSON data) — real template
 * rendering lands with the template registry per ADR-0018, same as the Resend driver.
 */
export function createSmtpEmailer(config: SmtpConfig): Emailer {
  const transport: SmtpTransport =
    config.transport ??
    (nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      auth: { user: config.user, pass: config.pass },
    }) as SmtpTransport);

  return {
    async send(msg: EmailMessage): Promise<void> {
      await transport.sendMail({
        from: config.from,
        to: msg.to,
        subject: msg.template,
        text: JSON.stringify(msg.data),
      });
    },
  };
}
