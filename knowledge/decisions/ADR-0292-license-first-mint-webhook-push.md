# ADR-0292 — License first mint: webhook-push at grant

**Status:** accepted · 2026-07-07 (operator-locked, eleventh-sitting picker over the
buyer-lifecycle audit `outputs/research/buyer-lifecycle-map-2026-07-07.md` gap G1).
Append-only; supersede with a later ADR, never edit. **Tags:** `billing`, `security`.

## Context

The lifecycle audit confirmed a P0: nothing automated ever calls the license service's
`POST /issue` — a buyer pays, entitlements are granted, and no license token is ever minted.
The only first-mint path is a raw operator curl with `LICENSE_ISSUE_TOKEN`; the admin reissue
proxy 404s when no prior grant exists. The fork was the trigger mechanism: webhook-push at
grant time vs dashboard-pull on first visit vs both.

## Decision

- **Webhook-push at grant.** The license service mints the buyer's license immediately after
  the entitlement grant commits in the billing-webhook path — post-commit side effect,
  idempotent per (account, major) so webhook redeliveries and renewal cycles re-mint nothing
  they should not. The purchase email can carry the license from day one.
- The dashboard's existing re-serve path is unchanged and becomes universally correct: once
  the push mints, every later read re-serves.
- An **admin first-mint lever** (an admin action calling `POST /issue` for an account holding
  entitlements but no grant) ships as the rescue path and permanent support tool — it does not
  replace the push.

## Consequences

- Closes the pays-and-gets-nothing P0 at the single seam where payment truth already lands.
- The mint inherits the webhook path's canonical account-billing-lock order and idempotency
  discipline; it is a money/license seam and takes the fable audit lane at SHIP.
- Dashboard-pull first-mint is NOT built (rejected: a buyer who never opens the dashboard
  would never have a license, and the email could not carry it).
