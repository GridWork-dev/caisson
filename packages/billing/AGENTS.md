# @caisson/billing — agent usage note

Provides the Stripe billing provider port: raw-body HMAC webhook verification and typed `DomainBillingEvent` dispatch (ADR-0017).

## Key surface

- Webhook handlers MUST pass the raw request body (not parsed JSON) to the HMAC verifier.
- The `BillingProvider` interface is the only surface editions touch; the Stripe SDK is behind the port.
- `DomainBillingEvent` objects are enqueued through `@caisson/jobs` — never processed inline.
- Never log Stripe metadata that could contain card or PII data (`console.log` is banned in product code).

## Scope

Stripe integration and webhook verification only. Credit wallet operations belong in `@caisson/credits`.
