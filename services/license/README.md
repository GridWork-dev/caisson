# services/license

Merchant-of-Record billing webhook + idempotent credit grants. Commercial service.

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
- `resolveEntitlements` (`src/resolve-entitlements.ts`, ADR-0071) — the account entitlement resolver:
  turns a buyer's purchases into the edition/bundle/module set they hold.
- The Ed25519 offline-license issuer (ADR-0010) — signs offline license tokens for a granted
  entitlement via `@caisson/license-issue`.
- The HTTP transport (`src/server.ts` → `src/app.ts`, `Bun.serve`) — the router serves **six** routes,
  not the three this list used to name. Every route below except `/health` is Bearer-gated by
  `authorized()`, which accepts EITHER the `LICENSE_ISSUE_TOKEN` or the admin token (constant-time
  compare via `tokenMatches`), and is rate-limited fail-closed (`rateLimited(…, "closed")`) — a
  limiter that cannot reach its backing store rejects rather than admits.
  - `GET /health` — the only ungated route (GET only; any other method 405s).
  - `POST /webhook` — billing, over `handleBillingWebhook`. Gated by provider signature, not Bearer.
  - `POST /issue` — offline license issuance, over the Ed25519 issuer above.
  - `POST /admin/affiliate/mint` — affiliate-code mint.
  - `POST /eval/apply` · `POST /eval/issue` — the evaluation-license seam.

  The three `admin`/`eval` routes were live and undocumented until 2026-08-26. Auditing this
  service's HTTP surface from this README alone would have missed two privileged endpoints, which is
  why the list is now exhaustive rather than illustrative: a partial route list on a money seam reads
  as a complete one.

- `email-notify.ts` — the `@caisson/email` wiring for this service. `resolveEmailer()` builds the
  Resend driver when `RESEND_API_KEY` is set (`RESEND_FROM` optional, defaults to
  `Caisson <no-reply@caisson.sh>`), the in-memory capture driver otherwise — same env vars and
  default as `apps/site/lib/auth-server.ts`'s own `resolveEmailer`, so an unconfigured deploy never
  crashes and never silently hits the network. `findBuyerEmail`/`recipientFor` resolve the buyer's
  notification address the same way `notifyDiscordGrant` resolves Discord identity
  (`account_member` → personal-account fallback → better-auth's `user` table). Two consumers:
  `notifyPurchaseEmail` fires the `purchase-confirmation` receipt post-webhook-commit (same
  detached, never-throws contract as `notifyDiscordGrant` — always wired, unlike the Discord/
  PostHog pushes, since an unset `RESEND_API_KEY` just falls back to the capture driver); the
  ADR-0252/0256 credit-expiry T-30d notice (`credit-expiry-scheduler.ts`, wired in `deploy.ts`)
  reuses the same resolver.
