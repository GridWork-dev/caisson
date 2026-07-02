# ADR-0201 — Purchase → Discord edition-role: better-auth Discord link + license→bot push with backfill

**Status:** accepted · 2026-07-01 (commerce-goes-live session — operator lock via AskUserQuestion).
**Relates:** ADR-0109 (support-bot member management; deferred the billing-grant webhook variant "to the
Paddle phase — no new authed inbound surface before a caller exists"), ADR-0105 (support-bot service),
ADR-0200 (Paddle sole webhook mount — the caller now exists), ADR-0132 (buyer sign-in via better-auth),
ADR-0176 (org accounts via `account_member`), ADR-0071/0113 (entitlement grants the push reads).

## Context

A completed purchase grants credits + entitlements (ADR-0089/0113) but no Discord edition-role — the
ADR-0109 deferral. The missing piece was **identity**: nothing links a buyer account to a Discord user.
`services/support-bot` has only the manual `/grant-role` command; `apps/site` has no Discord surface; the
webhook event carries `custom_data.account_id` but no Discord identity. The bot's edition slugs also
drifted from the canonical entitlement ids (`local-first`/`agentic-dev` vs `local-ai`/`agent-dev`).

## Decision

**Discord link + push, with backfill-on-link.** Three seams, all config-gated (never crash unconfigured):

1. **Identity (apps/site):** `discord` joins the env-gated better-auth social providers
   (`DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`). A signed-in buyer links Discord from the dashboard
   (`linkSocial`); the Discord user id lands in better-auth's own `account` table — no new schema.
2. **Push at grant time (services/license):** after a webhook grant commits, the service resolves the
   account's members (`account_member`, tenant-scoped) → their linked Discord ids (better-auth `account`
   rows, `providerId = 'discord'`) and fire-and-forgets `POST /billing-grant` on the bot
   (`SUPPORT_BOT_URL` + `SUPPORT_BOT_GRANT_TOKEN`, `fetchWithTimeout`). The push NEVER blocks or fails
   the webhook response — the money path stays independent of Discord availability.
3. **Endpoint + backfill (services/support-bot / apps/site):** the bot's inbound surface grows one
   authed route — `POST /billing-grant` (Bearer, timing-safe SHA-256 + `compare_digest`; pydantic-strict
   body `{discord_user_id, entitlements[]}`) — gated on `BILLING_GRANT_TOKEN` (unset ⇒ fail-closed, bot
   unaffected). The BOT owns the entitlement→role expansion (canonical ids; `bundle` ⇒ all four editions;
   every grant adds the `Customer` umbrella), keeping one mapping home. For the buy-then-link ordering,
   the site pushes the account's current active entitlements to the same endpoint after a successful
   link (same env pair) — the backfill.

Role **removal** on refund/cancel stays manual (`/role-remove`) — a deliberate non-goal here; automate
only if refund volume ever warrants it.

## Rejected

- **/claim code pull flow** — keeps the bot a pure client but adds a buyer-visible step + a claim-code
  table; the operator picked the smoother UX.
- **Defer (manual `/grant-role` only)** — leaves the money path human-gated at Discord; the deferral's
  own condition ("before a caller exists") has expired now that the webhook grants.
- **Push with the Discord id stamped in checkout `custom_data`** — the buyer's Discord identity is not
  known at checkout time and must never be client-asserted.
