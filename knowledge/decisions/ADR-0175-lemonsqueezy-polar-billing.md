# ADR-0175 — Billing adapter: LemonSqueezy + Polar behind the `BillingProvider` port (buyer-facing)

**Status:** accepted · 2026-06-30 (Stage-2 Stream D, adapter buildout) · extends ADR-0017 (BillingProvider
port) / ADR-0108 (Paddle) / ADR-0116 (billing driver scope — Paddle platform-MoR, `@caisson/billing` is the
buyer-facing package) · realizes `docs/state/adapter-expansion.md` Tier-3 billing (advisory "ADR-0126" retires
→ 0175). Append-only.

## Context

`packages/billing` defines `BillingProvider{verifyAndParse, createCheckout}` (`provider.ts:15-31`) with Stripe
(`:38`) and Paddle (`:109`) drivers, both co-located in `provider.ts`. Per ADR-0116, Paddle is the **platform**
MoR; `@caisson/billing` is the **buyer-facing** package where the buyer picks their own rail. LemonSqueezy and
Polar are MoR alternatives buyers ask for (`adapter-expansion.md` Tier-3).

## Decision

Add **LemonSqueezy** and **Polar** drivers behind the unchanged `BillingProvider` port. Resolving the one open
naming choice recon flagged: **new sibling files** `packages/billing/src/{lemonsqueezy,polar}.ts` (one file per
driver) — even though `provider.ts` today co-locates Stripe+Paddle, the per-file split matches the
adapter-doctrine's "new file beside the existing driver" and reads cleaner at four drivers. Each exports
`create<X>Billing(config): BillingProvider` with injected config; `verifyAndParse` composes an HMAC verify
(`crypto.timingSafeEqual`, raw-body) + a Zod-`.strict()` event mapper; `createCheckout` drives the provider's
hosted checkout. Mirror `paddle.test.ts`'s "Mirrors billing.test.ts's coverage" verify/parse/checkout test
shape (proven twice already — no new test abstraction).

**Platform revenue path is untouched** — Paddle stays the platform MoR (ADR-0116); these drivers are for the
buyer's own `@caisson/billing` rail selection, dormant until the buyer supplies creds.

## Scope — build-now vs DEPLOY-class

**Build now:** the two driver files + mirrored round-trip/conformance tests. **DEPLOY-class:** LemonSqueezy /
Polar API keys + webhook secrets — dormant until set.

## Rejected

- **Co-locating the new drivers in `provider.ts`** — the sibling-file split is the decided convention going
  forward; `provider.ts`'s Stripe+Paddle stay as-is (append-only, not refactored).
- **Putting a new MoR on the platform path** — no; platform MoR is Paddle only (ADR-0116).

## Binding

`BillingProvider` gains LemonSqueezy + Polar as buyer-facing sibling-file drivers; the platform MoR stays
Paddle; the sibling-file split is the convention for future billing drivers. Adding another buyer billing
driver needs no new ADR.

Evidence: `packages/billing/src/provider.ts:15-31,38,109`; `paddle.test.ts:1-19`; ADR-0116;
`docs/state/adapter-expansion.md:42,105`; recon `wf_fa542371-7e6` (D5:commerce-comms).
