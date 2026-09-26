// Postmark production driver for the `Emailer` port (ADR-0170). REST via `fetchWithTimeout`
// (ADR-0002), same shape as the Resend driver: the server token is injected config, never a
// module-level constant, and a non-ok response never echoes the response body (it can carry
// recipient / token fragments).
import { fetchWithTimeout, InternalError } from "@caisson-sh/kernel";
import type { Emailer, EmailMessage } from "./email.ts";
import { tryRenderEmailTemplate } from "./templates/index.ts";

export interface PostmarkConfig {
  serverToken: string;
  from: string;
}

const POSTMARK_ENDPOINT = "https://api.postmark.com/email";

/**
 * Production `Emailer` backed by Postmark. Every outbound call routes through `fetchWithTimeout`;
 * a non-ok response throws `InternalError` WITHOUT the response body.
 */
export function createPostmarkEmailer(config: PostmarkConfig): Emailer {
  return {
    async send(msg: EmailMessage): Promise<void> {
      const rendered = await tryRenderEmailTemplate(msg.template, msg.data);
      const res = await fetchWithTimeout(POSTMARK_ENDPOINT, {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": config.serverToken,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          From: config.from,
          To: msg.to,
          Subject: rendered?.subject ?? msg.template,
          ...(rendered ? { HtmlBody: rendered.html } : {}),
          TextBody: rendered?.text ?? JSON.stringify(msg.data),
        }),
      });
      if (!res.ok) {
        // Do NOT include the response body — it can echo recipient / token fragments.
        throw new InternalError("email send failed");
      }
    },
  };
}
