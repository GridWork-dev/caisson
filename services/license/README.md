# services/license

Merchant-of-Record billing webhook + idempotent credit grants (P6). Commercial service.

**Built (code-wiring B1, ADR-0089/0017; Paddle mount ADR-0200):**

- `applyBillingEvent(tx, ev)` — the subscription **cycle → credit grant** mapper. Grants on
  `invoice.paid` with billing_reason ∈ {`subscription_create`, `subscription_cycle`} via
  `sub_allotment`. **Paddle is the sole mounted webhook** (`POST /webhook`); the Stripe driver
  stays built but dormant. The Paddle driver derives billing_reason from the transaction's
  `origin`: `web`/`api` (first subscription charge) → `subscription_create`, `subscription_recurring`
  (renewal) → `subscription_cycle`, `subscription_charge` (mid-cycle one-time charge) → non-granting.
  Idempotent on the **Paddle transaction id** (`txn_…` — `invoice_id` is deprecated), one cycle = one
  allotment. Never on a `subscription.*` lifecycle event (granting at signup never renews — the X-2
  bug). Fail-closed on an unknown plan (`resolvePlan` throws → webhook non-2xx → Paddle retries). No
  clawback (append-only).
- `handleBillingWebhook(pg, provider, rawBody, sig)` — verify+parse via the injected `BillingProvider`
  port (no Stripe type escapes `@caisson/billing`), then run the mapper inside `withTenant` (RLS-scoped).
- `notifyDiscordGrant` (`src/discord-notify.ts`, ADR-0203) — post-grant Discord role push. After a
  granting webhook commits, resolves the buyer account's linked Discord user(s) (`account_member` →
  personal-account fallback → better-auth's `account` provider-link table) and fire-and-forgets
  `POST /billing-grant` on the support bot; never fails the webhook. Enabled only when both
  `SUPPORT_BOT_URL` and `SUPPORT_BOT_GRANT_TOKEN` are set. Fed by `applyBillingEvent`'s
  `{ grantedEntitlements }` return so the push can never drift from the grant gate's own decision.
  The push is **at-most-once by design** (ADR-0229 row 51's outer claim gates it): a crash after the
  grant transaction commits but before the detached push fires loses that push permanently, with no
  automatic retry — an accepted gap, not a bug, since the site's link-time backfill re-converges roles.

**Follow-on Bucket-B slices:** the entitlement resolver (purchase → edition/bundle/module set,
ADR-0071), the Ed25519 offline-license issuer (ADR-0010, harvested from PUBLIC tessera only — never
pro-private media-pipeline), and the HTTP transport (Bun.serve route over `handleBillingWebhook`).
