// AWS SES production driver for the `Emailer` port (ADR-0170). SES exposes an SMTP interface, so
// this is a thin config mapper onto `smtp.ts` — no `aws-sdk` dependency needed.
import type { Emailer } from "./email.ts";
import {
  createSmtpEmailer,
  type SmtpConfig,
  type SmtpTransport,
} from "./smtp.ts";

export interface SesConfig {
  region: string;
  smtpUser: string;
  smtpPass: string;
  from: string;
  /** Override transport for tests — see `SmtpConfig`. */
  transport?: SmtpTransport;
}

/** Pure mapping from SES config to the SMTP config `smtp.ts` needs — the testable seam. */
export function sesSmtpConfig(config: SesConfig): SmtpConfig {
  return {
    host: `email-smtp.${config.region}.amazonaws.com`,
    port: 587,
    // 587 is SES's STARTTLS port (secure:false, upgraded in-place); the implicit-TLS
    // wrapper is 465 (secure:true) if that's ever needed instead.
    secure: false,
    user: config.smtpUser,
    pass: config.smtpPass,
    from: config.from,
    // omit the key entirely when absent — exactOptionalPropertyTypes rejects `transport: undefined`
    ...(config.transport ? { transport: config.transport } : {}),
  };
}

/** SES driver for the `Emailer` port — `createSmtpEmailer` pointed at SES's regional endpoint. */
export function createSesEmailer(config: SesConfig): Emailer {
  return createSmtpEmailer(sesSmtpConfig(config));
}
