# @caisson/email — agent usage note

Provides the transactional email port: a provider-agnostic `Emailer` interface with a capture driver for tests and a Resend driver for production (ADR-0018).

## Key surface

- Import the `Emailer` interface and inject the appropriate driver at the app boundary (capture in tests, Resend in production).
- Never log email body content or recipient addresses — `console.log` is banned in product code and email payloads may contain PII.
- Resend API keys are resolved from environment variables; never inline them in code.
- All `send` calls are async; await and handle errors — a failed send must not be swallowed silently.

## Scope

Transactional email dispatch only. Email template rendering and marketing sends are out of scope for this package.
