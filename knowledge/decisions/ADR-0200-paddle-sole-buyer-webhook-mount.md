# ADR-0200 — Paddle is the sole mounted buyer-purchase webhook source

**Status:** accepted · 2026-07-01 (commerce-goes-live session — operator lock via AskUserQuestion).
**Relates:** ADR-0108 (Paddle MoR), ADR-0116 (billing driver scope: Paddle platform-only, Stripe retained
as a buyer `@caisson/billing` driver), ADR-0131 (on-site cart + multi-item Paddle checkout), ADR-0089/0113
(grant transactions the webhook drives), ADR-0017 (the original Stripe-era webhook-verification lock).

## Context

The commerce-goes-live kickoff asked which billing source MOUNTS the buyer-purchase webhook — the seam
ADR-0116 deliberately left with two drivers built (`createPaddleBilling` + `createStripeBilling`, both
behind the one `BillingProvider` port). Recon found the question all but answered in code: the whole-repo
audit remediation (PR #40) already mounted `POST /webhook` on `services/license` (`src/app.ts`) with the
**Paddle** provider — raw-body-first `Paddle-Signature` HMAC verification (timing-safe, fail-closed 401
when `PADDLE_WEBHOOK_SECRET` is unset), per-IP rate-limiting, and the credit + entitlement grant in one
RLS transaction — and the live checkout (ADR-0131) is Paddle.js with `custom_data.account_id` stamped
from the server-verified session. No Stripe checkout surface exists anywhere in `apps/site`.

## Decision

**Paddle only.** The one buyer-purchase webhook mount is `services/license` `POST /webhook`
(license.caisson.sh/webhook), driven by `createPaddleBilling`. The Stripe driver stays exactly where
ADR-0116 scoped it: a dormant, buyer-facing `@caisson/billing` driver for generated buyer apps — the
platform mounts no Stripe webhook route and holds no Stripe webhook secret. A future second mount (any
provider) is a new ADR, not a config flip.

## Rejected

- **Mount the Stripe driver too** — a second public payment surface + webhook secret to operate, with no
  live Stripe checkout to feed it; pure attack surface and operational drag until a real Stripe ingest
  need exists.
