# ADR-00NN — Subscription cycle → credit grant + the commerce price-book (closes X-2)

> **DRAFT — not yet locked.** Lives in `outputs/specs/billing-x2/` for operator review. On lock,
> copy to `knowledge/decisions/ADR-00NN-billing-credit-grant.md` (next free number — suggest **0089**;
> 0025–0039 are a reserved gap, the live range ends at 0088), set `Status: accepted`, and record it on
> the board + `docs/adr-index.md`. Append-only thereafter. Design rationale: `DESIGN.md` (same dir).

Status: **proposed (draft)** · 2026-06-28 · closes the **X-2** gap on the live board
(`docs/state/decisions-and-forks.md`, "Pricing numbers" row). Amends nothing; composes on ADR-0007,
ADR-0012, ADR-0017, ADR-0024, ADR-0060.

## Context

`@caisson/billing` parses Stripe into a typed `DomainBillingEvent` and emits
`subscription.created|updated|canceled` + `invoice.paid` (`packages/billing/src/events.ts:8-104`), but
**no component maps a recurring subscription cycle to `grant()`** — the credit primitive and its
`sub_allotment` event type sit unused (`packages/credits/src/credits.ts:14-19,173-198`). A subscriber's
monthly payment therefore never becomes spendable credits. Separately, **no price-book pins the credit
numbers**: ADR-0012 fixes USD anchors and ADR-0004 says every generation debits credits, but nothing
answers "a `$X/mo` plan grants how many credits?" or "a generation costs how many credits?". The
**per-ai-call** conversion already exists — `@caisson/ai-meter` (ADR-0060) owns a versioned provider-cost
book and the integer denomination **1 credit = 1000 micro-USD = $0.001**
(`packages/ai-meter/src/pricebook.ts:29-33,54-60`). X-2 must reuse that unit, not fork it.

## Decision

**1. The recurring grant fires on `invoice.paid`, never on `subscription.created`.** Stripe fires
`customer.subscription.created` once at signup; `invoice.paid` fires every cycle
(`billing_reason: "subscription_create"` first charge, `"subscription_cycle"` each renewal). The mapper
grants only for `billing_reason ∈ {subscription_create, subscription_cycle}`. The three `subscription.*`
events are lifecycle signals (record plan, end access on cancel), **not** grant triggers — granting on
`subscription.created` would grant once and never renew, re-creating the X-2 bug.

**2. A new base package `@caisson/pricebook` is the single commerce price-book** — distinct from
ai-meter's runtime provider-cost book, sharing its denomination. It holds: a **plan-book**
(`stripePriceId → { planTag, creditsPerCycle (exact integer), cadence }`), an **action-book**
(per-action credit cost, e.g. `codegenRunCredits`), and the **`centsToCredits` conversion** over the one
shared `microUsdPerCredit` unit. Versioned (`PRICEBOOK_VERSION`, append-only), Zod `.strict()` at the
boundary, fail-closed `resolvePlan` (unknown price id throws — never a guessed grant). It depends only on
`@caisson/kernel`; it never depends "up" on an edition (ADR-0003).

**3. The cycle → grant mapper lives in `services/license`, not in `@caisson/billing`** — honoring the
locked ADR-0017 P1↔P6 split (billing ships verify+parse; `services/license` ships the
event→entitlement→grant orchestration). `applyBillingEvent(tx, ev)` runs inside `withTenant`; for a
gated `invoice.paid` it calls `grant(tx, { eventType: "sub_allotment", accountId, amount:
plan.creditsPerCycle, sourceEventId: ev.invoiceId })`.

**4. Idempotency is anchored on the Stripe invoice id**, keyed `(source_event_id, event_type)` via the
existing `credit_event_source_uniq` partial-unique index (ADR-0024; `packages/credits/src/schema.ts:39-42`).
One invoice = one cycle = one `sub_allotment` row; a webhook retry or manual resend is absorbed
(`ON CONFLICT DO NOTHING → idempotent: true`). The allotment deliberately keys on `invoice.id` rather
than the Stripe `evt_…` id (the package's default convention) so cycle-stability survives a re-delivery
under a fresh event id.

**5. Integer-only conversion, one unit of account.** Plan grants do **no** arithmetic — `creditsPerCycle`
is an exact table integer (so discounts/proration/tax in `amount_total` never wobble the grant). The only
conversion path (top-ups / amount-derived) is `centsToCredits = cents × 10_000 ÷ microUsdPerCredit`,
BigInt, integer-exact, rounding **down** for a grant (never over-grant) — the same `ceilDiv` pipeline
ai-meter rounds **up** for a cost. A `__golden__/conversion.json` fixture pins it (ADR-0013).

**6. Failure posture (fail-closed).** Unknown price id → throw → non-2xx → Stripe retries → no grant
until a price-book row exists. `subscription_update` proration → no grant by default (next cycle grants
the new plan). Downgrade → fewer credits next cycle, **no clawback** (append-only). Cancel → no grant, no
clawback; unspent credits retain value (expiry deferred). `invoice.payment_failed` → no grant.

**7. Required billing seam change (still P1-shaped — parse, not orchestrate).** Enrich the `invoice.paid`
member of `DomainBillingEventSchema` with `subscriptionId`, `priceId` (from `invoice.lines[0].price.id`),
`billingReason`, and `invoiceId` — enough for the mapper to resolve plan + cycle. No Stripe type escapes
the package (ADR-0017 containment); `subscription.*` members unchanged.

## Rejected

- **Grant on `subscription.created` / `.updated`** (the events already emitted) — fires once at signup,
  never on renewal; a config-in-billing variant of this is the trap that re-introduces X-2 on every
  recurring cycle.
- **Derive `creditsPerCycle` from `invoice.amount_total`** (no plan-table) — couples the grant rigidly
  to the charged dollar amount, so a discount, proration, or tax line silently changes the allotment, and
  there is no room for margin / promo / annual bonus. The board explicitly asks for a _price-book_ (a
  single source), not an amount formula.
- **A second denomination in the commerce book** — would let `microUsdPerCredit` drift from ai-meter's.
  X-2 reuses ai-meter's single unit (relocated to one owner, SD-3) instead.
- **Put the grant-mapper in `@caisson/billing`** — violates the locked ADR-0017 P1↔P6 split; billing
  stays the verify+parse seam.
- **Price-book as a row in the module `registry/`** (ADR-0004) — the registry's standards/golden gate is
  built for shippable _code modules_, not plan pricing; a semantic mismatch that would force pricing
  edits through a code-publish gate.
- **Float credit math / app-layer dedupe** — ADR-0007/0002 and ADR-0024 violations (rounding drift; race
  under concurrent webhook retries — the DB unique index is the only correct anchor).

## Binding

- The recurring subscription grant fires on `invoice.paid` with `billing_reason ∈ {subscription_create,
subscription_cycle}` and **never** on a `subscription.*` lifecycle event.
- `@caisson/pricebook` is the single commerce price-book: versioned, append-only, Zod `.strict()`,
  fail-closed, integer-only, sharing ai-meter's one `microUsdPerCredit` denomination — exactly one
  definition of that constant exists across the codebase.
- The cycle→grant mapper lives in `services/license` (ADR-0017 P6), runs inside `withTenant`, and grants
  via `sub_allotment` idempotent on `(invoice.id, "sub_allotment")` (ADR-0024).
- No grant without a paid invoice and a resolvable plan; unknown plan / failed payment / proration-update
  / cancel grant **nothing**; no clawback ever (append-only ledger).
- `@caisson/billing` emits an enriched `invoice.paid` (`priceId`/`billingReason`/`invoiceId`/
  `subscriptionId`) and no Stripe type escapes the package.
- Asserted by tests: `invoice.paid(create)` grants once; retry on the same invoice id → one row; two
  invoice ids → two grants; `subscription.created` → no row; cancel → no row, balance intact (mirrors the
  ADR-0024 concurrent-double-insert assertion, retargeted to `sub_allotment`).

Evidence: ADR-0007 (debit-before-spend ledger, integer credits), ADR-0012 (pricing anchors +
grandfather), ADR-0017 (Stripe MoR, `BillingProvider` containment, P1↔P6 split), ADR-0024 (`credit_event`
idempotency indexes), ADR-0060 (`ai-meter` price-book + the shared denomination), ADR-0004 (codegen
debit), ADR-0074 (generic `feature_*` event types). Code: `packages/billing/src/events.ts:8-104`,
`packages/credits/src/credits.ts:14-19,173-198`, `packages/credits/src/schema.ts:39-47`,
`packages/ai-meter/src/pricebook.ts:29-60,86-120`. Design: `outputs/specs/billing-x2/DESIGN.md`. Open
sub-decisions (SD-0…SD-7) live in DESIGN.md §6 and stay operator-owned per the one-operator rule.
