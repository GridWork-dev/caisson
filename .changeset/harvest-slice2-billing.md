---
"@caisson/billing": patch
---

Stripe webhook envelope hardening (ADR-0210): `provider.ts`'s Stripe driver used to trust
the raw webhook body via a bare `JSON.parse(rawBody) as StripeEvent` cast — a type-level
assertion with no runtime shape check. Signature verification already ran first, but a
validly-signed, malformed-envelope delivery (missing/wrong-typed `id`, or an unexpected
top-level field) flowed straight into the mapper. `StripeEventSchema` (`strictObject`,
mirroring `PaddleEventSchema`) is now wired into `verifyAndParse` via `parseStrict`, closing
the gap Paddle/LemonSqueezy/Polar already closed — all four `BillingProvider` drivers now
parse through a strict envelope schema before their mapper runs. `data.object` stays a loose
`Record<string, unknown>` (the existing `read*` helpers are the defensive layer for it,
unchanged). No change to `verifyAndParse`'s call order, the `BillingProvider` port shape, or
Stripe driver activation state (ADR-0200: still dormant). New export: `StripeEventSchema`.
