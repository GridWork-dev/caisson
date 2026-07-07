---
title: Abandoned-checkout email — server-side checkout-started capture + delayed single-send notice
status: draft - spec-only, operator-gated build (locked 2026-07-06, "Spec only, build later")
tags: [billing, frontend]
adr-interactions: none — spec-only, no ADR gets filed for this document
---

# SPEC — Abandoned-checkout email

**Status: DRAFT — spec-only, operator-gated build.** Per the 2026-07-06 lock, this document
authorizes nothing: no capture route, no scheduled job, no template, no migration. It exists so a
later PLAN has a settled design to consume. **No ADR is filed for this SPEC** — it is not a
decision lock, it is groundwork.

## Goal (WHAT + WHY)

A buyer who reaches the authed cart checkout and opens the Paddle overlay, but never completes
payment, gets no follow-up today — there is no data path that would let one exist (see Current
state). Design one: a server-side record of "checkout started," a delayed check for
non-completion, and one plain-tone email, reusing the transactional email plumbing that already
landed this branch (`services/license/src/email-notify.ts`) rather than building new send
infrastructure.

## Non-goals

- **No pre-auth email capture.** v1 only emails a signed-in buyer whose account email we already
  hold (`email-notify.ts`'s `findBuyerEmail`). No email-on-the-pricing-page capture, no guest
  checkout tracking — privacy posture, not a technical limit.
- No discount/incentive email (see Open forks — recommended against).
- No multi-step nurture sequence — one email, ever, per abandonment.
- No change to Paddle webhook-handled event types (`purchase.completed` / `subscription.*` /
  `refund.completed` / `invoice.paid` in `packages/billing/src/events.ts:12-99`) — this is an
  additive, parallel capture path, not a new mapped Paddle event.

## Current state (verified against this branch)

- **Cart is client-only, `localStorage`**, key `cs-cart-v1` (`apps/site/lib/cart.ts:24-27`) — never
  synced server-side. A visitor builds a cart on public `/pricing` with no session.
- **Checkout only opens after sign-in.** The only call site of `openCartCheckout` is
  `apps/site/components/cart-checkout-panel.tsx`, rendered exclusively by
  `apps/site/app/dashboard/cart/page.tsx:15`, which calls `requireDashboardSession` first — so by
  the time the Paddle overlay can open, we already hold a server-verified `accountId`
  (`cart-checkout-panel.tsx:12-14`).
- **`begin_checkout` fires client-side only, no email, no persistence**:
  `apps/site/lib/paddle-checkout.ts:76` (`trackEvent("begin_checkout", { items: String(items.length) })`)
  then `paddle.Checkout.open({ items, customData: { account_id: accountId } })` (`:78-82`). Nothing
  server-side observes this moment today.
- **`account_id` IS stamped into checkout `customData`** for the signed-in buyer
  (`paddle-checkout.ts:82`) — the same key `parsePaddleEvent`'s `readAccountId` reads on the
  eventual webhook, so a checkout-started record keyed the same way joins cleanly to a later
  completion.
- **Webhook events are all post-completion.** `services/license/src/webhook.ts:45-88` only acts on
  `provider.verifyAndParse`'s mapped `DomainBillingEvent` union — `purchase.completed`,
  `subscription.created/updated/canceled`, `refund.completed`, `invoice.paid`
  (`packages/billing/src/events.ts:12-99`). No `checkout.opened`/draft-`transaction` event is
  mapped anywhere.
- **The send path is now cheap — this changes the cost picture.** `services/license/src/email-notify.ts`
  (new this branch) already does the hard part for a commerce-lifecycle email: `resolveEmailer()`
  (Resend-or-capture, mirrors `apps/site/lib/auth-server.ts`), `findBuyerEmail(db, accountId)`
  (account_member owner → better-auth `user` row, same join `discord-notify.ts` uses for Discord
  identity), and a never-throw send wrapper (`notifyPurchaseEmail`, `email-notify.ts:118-149`),
  wired unconditionally in `server.ts:135-146`. Building this email is now "one more template + one
  new capture/delay path," not "wire email into services/license from zero."
- **The pg-boss scheduling pattern already exists and is the one to reuse.**
  `services/license/src/credit-expiry-scheduler.ts` is the first in-repo pg-boss consumer
  (ADR-0256): inert unless armed by a cron env var, a daily tick enumerates candidate accounts and
  enqueues one job per account (`runCreditExpiryTick`, `:70-79`), and the send itself is gated by an
  append-only per-subject marker row inserted `ON CONFLICT DO NOTHING` INSIDE the same transaction as
  the send (`packages/credits/src/credits.ts:813-834`, `credit_expiry_notice` — schema doc at
  `packages/credits/src/schema.ts:138-141`) — so a re-run of the sweep sends nothing twice. The
  `@caisson/jobs` wrapper exposes only cron `schedule()` + `singletonKey`-deduped `enqueue()`
  (`packages/jobs/src/pgboss.ts:71,250-264`) — no per-job delayed-start primitive — so a design that
  reuses periodic-tick-and-scan needs no change to `@caisson/jobs` itself.
- **A prior, unwired nurture template already exists and was abandoned as a sequence.**
  `apps/site/emails/nurture-follow-up.ts` + `waitlist-welcome.ts` are raw-HTML-string builders
  ("template only, not wired to a sender"), predate the six-bundle catalog rework (still say
  "edition"), and sit outside the `@caisson/email` registry entirely — dead weight, not reused here,
  but their own doc comments already concluded "one email, not a drip." Consistent with this SPEC's
  no-sequence stance; not touched by this SPEC.

## Design

**(a) Capture point — recommend a small authenticated site API route, not a Paddle webhook.**

Add `POST /api/checkout/started` in `apps/site`, called from `cart-checkout-panel.tsx`'s `pay()`
right before `openCartCheckout` — same authenticated request context `requireDashboardSession`
already establishes for the page, so `accountId` needs no re-derivation. Body: cart line ids +
labels (already client-held, no new lookup) and a server-stamped timestamp. Zod `.strict()` at the
boundary per the security floor.

_Rejected: consuming a Paddle `transaction.created`/draft webhook._ Paddle does emit
transaction-lifecycle events before completion, but modeling exactly when Caisson's specific
`Checkout.open({items, customData})` integration mode creates a transaction record is unverified
against this repo's Paddle usage, and it would touch two packages (extend
`packages/billing`'s `DomainBillingEvent` union with a new event type, then handle it in
`services/license`) for a signal `apps/site` already owns unambiguously — the button click. The
in-house route is the same moment, the same trusted `accountId`, and a one-package diff.

**(b) Delayed job — a periodic tick, N = 24h, reusing the credit-expiry scheduler's shape exactly.**

New table `checkout_abandonment` (`account_id`, `items`, `started_at`, tenant RLS per ADR-0005) fed
by (a). A cron tick (same posture as `CREDIT_EXPIRY_TICK_TASK`, inert unless armed) scans rows where
`started_at <= now() - interval 'N hours'`, no purchase completed for that account since
`started_at`, and no notice sent yet (see suppression below) — then sends, gated by an append-only
`checkout_abandonment_notice` marker row (`ON CONFLICT DO NOTHING`, same pattern as
`credit_expiry_notice`) inserted inside the send transaction. **Recommend N = 24h**: long enough
that a buyer who paused mid-checkout to grab a card isn't emailed while they're still mid-purchase
(webhook completion is near-instant once Paddle collects payment), short enough that the context is
still fresh and the buyer hasn't lost the intent entirely. This is a genuine judgment call, not a
technical constraint — flagged below as an open fork.

**(c) Suppression rules (single-send, no exceptions in v1).**

A candidate row is skipped, permanently, if any of:

- a `purchase.completed` for that `accountId` landed after `started_at` (the buyer converted —
  check `apply-billing-event`'s grant records, not a new field);
- a `checkout_abandonment_notice` row already exists for this `account_id` within the last 30
  days (matches the existing `credit-expiring` cadence guard's spirit — one nudge per rolling
  month, not one per cart);
- the account has no marketing consent (see Open forks — consent model).

**One email ever per abandoned cart-session; no retries, no second nudge.**

**(d) Template — `@caisson/email` `abandoned-checkout`, same voice as `purchase-confirmation`.**

New `packages/email/src/templates/abandoned-checkout.tsx`, registered in `templates/index.ts`
alongside the existing five (`magic-link`, `password-reset`, `verify-email`, `credits-expiring`,
`purchase-confirmation`). Matches `purchase-confirmation.tsx`'s tone exactly: flat statement of
fact ("Your cart is still here"), the line items, one `EmailButton` back to `/dashboard/cart`, no
urgency copy, no countdown, no "act now" — the same restraint `credits-expiring.tsx` uses
("they burn first automatically; top up or use them before then").

**(e) Metrics.**

Two server-side PostHog events, same posture as `posthog-capture.ts`'s existing `purchase` capture
(config-gated on a `POSTHOG_CAPTURE_KEY`-shaped env var, never throws, distinct_id = accountId):
`abandoned_checkout_email_sent` (properties: item count) at send time, and
`abandoned_checkout_converted` when a `purchase.completed` lands for an account with a prior sent
notice inside a bounded lookback window (e.g. 14 days) — read at grant time, not a new counter.

**(f) Rough build cost + seams.**

| Seam                              | Change                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/site`                       | new `POST /api/checkout/started` route; one `fetch` call added to `cart-checkout-panel.tsx`'s `pay()`         |
| `services/license` (schema)       | two new tenant-RLS tables (`checkout_abandonment`, `checkout_abandonment_notice`), numbered-Drizzle migration |
| `services/license` (scheduler)    | one new cron tick + scan task, same shape as `credit-expiry-scheduler.ts` — no `@caisson/jobs` changes        |
| `packages/email`                  | one new template + registry entry, following `purchase-confirmation.tsx`                                      |
| `services/license` (email-notify) | one new `notifyAbandonedCheckout` function, mirroring `notifyPurchaseEmail`'s never-throw contract            |
| `posthog-capture.ts`              | two new event names, same config-gated wrapper                                                                |

No new package, no new dependency, no new external egress sink (email already goes through Resend;
PostHog already goes through the existing capture key). Effort: **S–M** (~1 day) — the send
plumbing is fully reusable; the net-new work is two small tables, one scheduler clone, and one
template.

## Open forks for the operator (do not default)

- **Send timing N.** Recommended **24h** (rationale in (b)) — a shorter window (e.g. 4–6h) catches
  intent while hotter but risks emailing someone still completing payment in another tab; a longer
  window (e.g. 48–72h) is safer against false positives but the intent has cooled more. Operator's
  call.
- **Discount/incentive in the email — recommend NO.** Caisson's site posture is committed,
  non-negotiable pricing (ADR-0082, amended ADR-0237 rider 2: no "coming soon," no soft framing
  anywhere). An abandoned-checkout discount trains buyers to abandon carts on purpose and
  contradicts the price-integrity stance the rest of the site holds. If the operator wants a
  incentive lever, it should be a deliberate, visible promotion — not a silent per-buyer discount
  triggered by inaction.
- **Consent model.** (i) _Implicit_ — any signed-in buyer with an abandoned cart gets one email,
  treated as transactional-adjacent (same bucket as the purchase receipt), no opt-out UI needed
  beyond existing account settings; or (ii) _Explicit_ — gate on a marketing-consent flag the
  buyer must have set (no such field exists in the account schema today — this is new scope if
  picked). Recommend (i) for a single, one-time, low-frequency nudge tied to the buyer's own
  in-progress action (not cold outreach) — but this is a genuine privacy-posture call, not a
  technical default, and gates suppression rule (c)'s third clause either way.

## Effort: S–M (~1 day once locked; two small tables + one scheduler clone + one template, all cloned from patterns this branch already shipped). Value: MEDIUM — the furthest-away lifecycle email per the newsletter-surface gap list is now the cheapest of the remaining gaps, purely because the email-wiring foundation (`email-notify.ts`) already landed; capturing the moment (a) is the only genuinely new mechanism, everything else is precedent-following.
