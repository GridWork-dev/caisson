# @caisson-sh/email

Transactional email port: one provider-agnostic `Emailer` interface with a capture driver for
tests and production drivers for Resend, Postmark, SMTP, and SES.

- **Layer:** base

## Install

```bash
bun add @caisson-sh/email
```

## Usage

```ts
import { createResendEmailer, createCaptureEmailer } from "@caisson-sh/email";

const emailer = createResendEmailer({ apiKey, from: "no-reply@example.com" });
await emailer.send({ to, template: "welcome", data: { name } });

// In tests: swap in the capture driver and assert on emailer.sent.
const testEmailer = createCaptureEmailer();
```
