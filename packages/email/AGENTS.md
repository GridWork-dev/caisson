# @caisson-sh/email — agent usage note

Provides the transactional email port: a provider-agnostic `Emailer` interface with a capture
driver for tests and production drivers for Resend, Postmark, SMTP, and SES (ADR-0018/ADR-0170).

## Key surface

- Import the `Emailer` interface and inject the appropriate driver at the app boundary: `createCaptureEmailer` in
  tests, `createResendEmailer` / `createPostmarkEmailer` / `createSmtpEmailer` / `createSesEmailer`
  in production (SES is a thin config mapper onto the SMTP driver — no separate AWS SDK dependency).
- Never log email body content or recipient addresses — `console.log` is banned in product code and email payloads may contain PII.
- Provider credentials (API keys, server tokens, SMTP user/pass) are resolved from environment variables; never inline them in code.
- All `send` calls are async; await and handle errors — a failed send must not be swallowed silently.
- On a non-ok provider response, drivers throw a fixed `InternalError` message and never include the response body — it can echo recipient or key fragments.

## Scope

Transactional email dispatch only. Email template rendering and marketing sends are out of scope for this package.
