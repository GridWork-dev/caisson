// Transactional email via the `@caisson-sh/email` `Emailer` port. Resend in production
// (`RESEND_API_KEY` + `RESEND_FROM` set); an in-memory capture driver otherwise — safe default for
// local dev and CI, never touches the network. Swap in `@caisson-sh/email`'s Postmark/SES/SMTP
// drivers the same way; every caller only ever depends on the `Emailer` port.
import { createCaptureEmailer, createResendEmailer } from "@caisson-sh/email";
import type { Emailer } from "@caisson-sh/email";

function createEmailer(): Emailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (apiKey !== undefined && from !== undefined) {
    return createResendEmailer({ apiKey, from });
  }
  return createCaptureEmailer();
}

export const emailer: Emailer = createEmailer();

export async function sendWelcomeEmail(to: string): Promise<void> {
  await emailer.send({ to, template: "welcome", data: {} });
}
