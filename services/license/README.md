# services/license

Merchant-of-Record billing webhook + idempotent credit grants (P6). Commercial service.

**Built (code-wiring B1, ADR-0089/0017):**

- `applyBillingEvent(tx, ev)` — the subscription **cycle → credit grant** mapper. Grants on
  `invoice.paid` with billing_reason ∈ {`subscription_create`, `subscription_cycle`} via
  `sub_allotment`, idempotent on the Stripe **invoice id** (one cycle = one allotment). Never on a
  `subscription.*` lifecycle event (granting at signup never renews — the X-2 bug). Fail-closed on an
  unknown plan (`resolvePlan` throws → webhook non-2xx → Stripe retries). No clawback (append-only).
- `handleBillingWebhook(pg, provider, rawBody, sig)` — verify+parse via the injected `BillingProvider`
  port (no Stripe type escapes `@caisson/billing`), then run the mapper inside `withTenant` (RLS-scoped).

**Follow-on Bucket-B slices:** the entitlement resolver (purchase → edition/bundle/module set,
ADR-0071), the Ed25519 offline-license issuer (ADR-0010, harvested from PUBLIC tessera only — never
pro-private media-pipeline), and the HTTP transport (Bun.serve route over `handleBillingWebhook`).
