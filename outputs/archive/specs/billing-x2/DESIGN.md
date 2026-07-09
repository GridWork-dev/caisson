# DESIGN — Billing X-2: subscription cycle → credit grant + the price-book

Status: **design / spec-first (doc-only)** · 2026-06-28 · feeds `ADR-DRAFT-billing-credit-grant.md`
Scope: the X-2 gap on the live board (`docs/state/decisions-and-forks.md`, "Pricing numbers" row).
**No product code in this session** — this is the WHAT/HOW before the lock. Implementation is P6/commerce.

---

## 1. The gap (verbatim, then precise)

> `billing` emits `subscription.created/updated/canceled` but no component maps the recurring cycle
> → `grant()`, and no price-book holds the USD↔credit / per-generation / per-ai-call conversion.

Two independent holes, one board row:

**Hole A — the cycle never grants.** `@caisson/billing` parses Stripe into a typed `DomainBillingEvent`
(`packages/billing/src/events.ts:8-40`) and emits `subscription.created|updated|canceled` + `invoice.paid`
(`events.ts:79-104`). **Nothing in the repo calls `grant()` for a subscription.** The credit primitive
exists and already reserves a `sub_allotment` event type for exactly this
(`packages/credits/src/credits.ts:14-19`, `grant()` at `credits.ts:173-198`), but no caller wires the
webhook to it. A subscriber pays every month and the wallet never moves — the MRR product ships no value.

**Hole B — no commerce price-book.** There is no single artifact answering "a `$99/mo` plan grants how
many credits this cycle?" or "a `create-caisson` generation costs how many credits?". ADR-0012 fixes the
USD anchors and ADR-0004 says every generation debits credits — but **the credit numbers are pinned
nowhere**. (`invoice.paid` even carries `amountTotal` in cents — `events.ts:31-37` — but no table turns
cents into a grant.)

**The reconciliation that shapes the whole design:** a price-book _already exists_ for the third
conversion the gap names — **per-ai-call**. `@caisson/ai-meter` (ADR-0060) owns a versioned
provider-cost book (`provider/model → integer micro-USD per token`) and the **integer USD↔credit
denomination** itself: `DEFAULT_CREDIT_CONVERSION = { microUsdPerCredit: 1000 }` —
**1 credit = 1000 micro-USD = $0.001** (`packages/ai-meter/src/pricebook.ts:29-33,54-60`), with a
BigInt `ceilDiv` integer pipeline (`pricebook.ts:86-105,122-138`). So X-2 must **not** invent a second
denomination. It introduces a _commerce_ price-book (plan→grant, action→cost) that **shares ai-meter's
single denomination**. Two books, two scopes, one unit of account.

| Book                               | Owns                                                                        | Scope                             | Status       |
| ---------------------------------- | --------------------------------------------------------------------------- | --------------------------------- | ------------ |
| `@caisson/ai-meter` (ADR-0060)     | `provider/model → per-token micro-USD`; the `microUsdPerCredit` unit        | **per-ai-call** runtime cost      | **built**    |
| `@caisson/pricebook` (this design) | `stripePriceId → creditsPerCycle`; `action → credit cost` (codegen, topups) | **commerce** (grant + à-la-carte) | **proposed** |

---

## 2. Constraints (binding — read before the options)

- **Integer-only money/credits**, never floats (ADR-0007, ADR-0002; CLAUDE.md invariant). Reuse the
  ai-meter BigInt `ceilDiv` pipeline; do not introduce a parallel rounding rule.
- **Append-only ledger; idempotent grants.** Every grant is one `credit_event` row, idempotent on
  `(source_event_id, event_type)` or `(account_id, idempotency_key)` (ADR-0024;
  `packages/credits/src/schema.ts:39-47`). 23505 → idempotent success; `ON CONFLICT DO NOTHING`
  keeps the txn alive (`credits.ts:153-159`).
- **Fail-closed.** An unknown plan / missing price-book row / unverified webhook **grants nothing**
  (mirrors ai-meter's `resolvePriceEntry` throwing on an unknown model, `pricebook.ts:107-120`).
- **Zod `.strict()` at every boundary** (`strictObject`/`parseStrict` from `@caisson/kernel`).
- **No package depends "up" on an edition** (ADR-0003). `pricebook` is base; `billing` may depend on it.
- **P1 ↔ P6 split is locked (ADR-0017).** `@caisson/billing` ships the verify+parse seam only; the
  _orchestration_ (event → entitlement → license → grant, and the subscription allotment) lives in
  `services/license`. This design honors that line: the grant-**mapper** is P6/commerce, not billing.
- **Versioned + append-only price-book** — a price change bumps a version stamp, never edits a line in
  place (ADR-0006; ai-meter's `PRICE_BOOK_VERSION` at `pricebook.ts:59-60` is the precedent). Required
  for ADR-0012 grandfathering (a buyer pins the version they bought on).
- **MoR containment (ADR-0017).** No Stripe type escapes `@caisson/billing`; the mapper consumes only
  `DomainBillingEvent`.

---

## 3. Design

### 3.1 The commerce price-book — `@caisson/pricebook` (new base package)

A small, dependency-light base package (depends only on `@caisson/kernel`). Three concerns:

**(a) Plan-book** — `stripePriceId → { planTag, creditsPerCycle, cadence }`, integer credits, explicit
(not derived from the charged amount). Example shape (illustrative, not final numbers):

```ts
// pricebook/src/plans.ts — illustrative shape only; the NUMBERS are an open sub-decision (ADR-0012).
export const PRICEBOOK_VERSION = "2026-06-28"; // append-only stamp; a change bumps this, never edits a row
export const planBookEntrySchema = strictObject({
  planTag: z.string().min(1), // "developer" | "compliance_updates" | ...
  creditsPerCycle: z.number().int().positive(), // EXACT integer grant; no float, no per-$ derivation
  cadence: z.enum(["month", "year"]), // an annual invoice grants the annual allotment once
});
export const PLAN_BOOK: Record<string /* stripePriceId */, PlanBookEntry> = {
  /* price_… → entry */
};

export function resolvePlan(priceId: string): PlanBookEntry {
  /* fail-closed: throw on unknown id */
}
```

**(b) Action-book** — per-action credit cost the gap names ("how many credits does a generation cost"):
`{ codegenRunCredits: number, ... }`, flat integers. The codegen path (ADR-0004) reads this to size its
`codegen_debit`; the per-_ai_-call cost is **not** duplicated here — it stays computed by ai-meter from
token usage.

**(c) The shared denomination + conversion.** The single unit of account. `centsToCredits` for the only
place a raw USD figure must become credits (top-up packs / any amount-derived path), integer-exact:

```ts
// 1 credit = 1000 micro-USD = $0.001 ; 1 cent = 10_000 micro-USD ⇒ 1 cent = 10 credits, no remainder.
const MICRO_USD_PER_CENT = 10_000n;
export function centsToCredits(
  cents: number,
  conv = CREDIT_CONVERSION,
): number {
  // floor for a GRANT (never over-grant); ai-meter uses ceil for a COST (never under-bill). Same pipeline.
  return Number(
    (BigInt(cents) * MICRO_USD_PER_CENT) / BigInt(conv.microUsdPerCredit),
  );
}
```

> **Denomination ownership (open sub-decision SD-3).** Today `microUsdPerCredit` lives in `ai-meter`.
> For ONE unit of account across both books, the constant should be owned in one low place and imported
> by both. Recommended home: a `CREDIT_CONVERSION` constant in **`@caisson/kernel`** (base-of-base),
> with `ai-meter` and `pricebook` both importing it. Alternative: own it in `pricebook` and have
> `ai-meter` import "up" to it (acceptable — both are base, no edition coupling). Either way, **delete
> the second definition** so the denomination can never drift.

### 3.2 The cycle → grant mapper — `services/license` (P6/commerce, per ADR-0017)

`services/license` exists as a stub (README + package.json only). It is the locked home for billing
orchestration (ADR-0017 "P1↔P6 event split"). The mapper is a single pure-ish function the webhook
route calls inside `withTenant`:

```ts
// services/license/src/apply-billing-event.ts (design sketch — not implemented this session)
export async function applyBillingEvent(
  tx: TenantExecutor,
  ev: DomainBillingEvent,
): Promise<void> {
  switch (ev.type) {
    case "invoice.paid":
      if (
        ev.billingReason !== "subscription_create" &&
        ev.billingReason !== "subscription_cycle"
      )
        return;
      const plan = resolvePlan(ev.priceId); // fail-closed on unknown price id
      await grant(tx, {
        eventType: "sub_allotment",
        accountId: ev.accountId,
        amount: plan.creditsPerCycle, // exact table integer
        sourceEventId: ev.invoiceId, // SD-2: cycle-stable idempotency anchor
      });
      return;
    case "purchase.completed":
      /* one-time edition/module entitlement + any bundled credits */ return;
    case "subscription.created": // signup lifecycle only — NO grant here (see the trap below)
    case "subscription.updated": // plan change recorded; proration grant = SD-1
    case "subscription.canceled": // no grant, no clawback (append-only); credits keep their value
      return;
  }
}
```

**Why `invoice.paid`, not `subscription.created` (the load-bearing call).** Stripe fires
`customer.subscription.created` **once**, at signup. It fires `invoice.paid` **every cycle** —
`billing_reason: "subscription_create"` on the first charge and `"subscription_cycle"` on each renewal.
Granting on `subscription.created` grants once at signup and **never on renewal** — which is the X-2 bug
wearing a different hat. The recurring money event is `invoice.paid`. The three `subscription.*` events
the package already emits are lifecycle signals (record the plan, end access on cancel), **not** grant
triggers.

### 3.3 Required change to `@caisson/billing` (the seam, still P1-shaped)

`invoice.paid` today carries only `{ amountTotal, currency }` (`events.ts:31-37,97-104`) — not enough to
know _which plan_ or _which cycle_. Enrich the `invoice.paid` member of `DomainBillingEventSchema`
(staying inside the package, no Stripe type escaping):

- `subscriptionId: string` — from `invoice.subscription`.
- `priceId: string` — from `invoice.lines.data[0].price.id` (the subscription line's price → plan-book key).
- `billingReason: enum("subscription_create" | "subscription_cycle" | "subscription_update" | "manual" | ...)`
  — from `invoice.billing_reason`; the mapper's gate.
- `invoiceId: string` — from `invoice.id`; the **idempotency anchor** for the allotment (SD-2).

This is mechanism, not orchestration, so it respects the P1↔P6 line — billing still only _parses_; it
just parses _enough_. `subscription.*` members are unchanged.

### 3.4 Idempotency, proration, cancel — the failure posture

- **Webhook retry / double-delivery** → `grant(sub_allotment, sourceEventId=invoiceId)` hits
  `credit_event_source_uniq (source_event_id, event_type)` (`schema.ts:39-42`) → `ON CONFLICT DO NOTHING`
  → `{ idempotent: true }`, **one** ledger row. Keying on **`invoice.id`** (one per billing period), not
  the Stripe `evt_…` id, makes "one cycle = one allotment" hold even across a manual invoice resend
  that carries a fresh event id (SD-2; note the existing convention uses `event.id` —
  `events.ts:11,76` — we deliberately override it for the allotment).
- **Upgrade mid-cycle** → Stripe emits a proration `invoice.paid` with `billing_reason:
"subscription_update"`. Default posture: **no grant** on `subscription_update` (the next
  `subscription_cycle` invoice grants the new plan's full allotment) — avoids a double-grant on upgrade.
  Granting a prorated delta is SD-1.
- **Downgrade** → takes effect next cycle; the next `subscription_cycle` invoice carries the cheaper
  price id → fewer credits. **No clawback** of already-granted credits (append-only; never negate a past
  grant). Existing balance spends down naturally.
- **Cancel** (`subscription.canceled`) → no grant, **no clawback**. The buyer keeps unspent credits
  (default; expiry is SD-4). Access to subscription-only entitlements ends via the entitlement layer,
  not the wallet.
- **Payment failure** (`invoice.payment_failed`, not currently parsed) → **no grant** (fail-closed: no
  credits without a paid invoice). Stripe dunning retries; on recovery `invoice.paid` fires and grants.
  Parsing this event is optional (used only to flag the entitlement, never to move credits).
- **Unknown price id** → `resolvePlan` throws → the webhook returns non-2xx → Stripe retries → still
  fails until a price-book row is added. Fail-closed: a plan launched without a price-book row grants
  **nothing**, never a guessed amount.

### 3.5 Integer conversion model (no float drift)

One unit of account: **1 credit = 1000 micro-USD = $0.001** (ai-meter's `microUsdPerCredit: 1000`).

- **Plan grants do no conversion at all** — `creditsPerCycle` is an exact integer in the plan-book. This
  is _why_ a plan-book beats deriving credits from `amount_total`: discounts, proration, and tax move
  `amount_total`; the granted credits should not wobble with them.
- **The only conversion path** (top-ups, any amount-derived grant) uses `centsToCredits` =
  `cents × 10_000 ÷ microUsdPerCredit`, BigInt, integer-exact (with `microUsdPerCredit=1000`,
  `1 cent = 10 credits`, zero remainder). GRANT direction rounds **down** (never over-grant); COST
  direction (ai-meter) rounds **up** (never under-bill) — same `ceilDiv` machine, opposite rounding,
  each conservative for its side.
- **Golden-file pin** (ADR-0013 pattern, like `ai-meter/src/__golden__/cost.json`): a
  `pricebook/src/__golden__/conversion.json` fixture pins `plan → creditsPerCycle` and representative
  `cents → credits` so a refactor that perturbs the unit fails the regression.

---

## 4. New / changed modules

| Module                                  | Change                                                                                                                                              | Owner / phase                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@caisson/pricebook` (**new** base pkg) | plan-book + action-book + shared denomination/`centsToCredits`; Zod `.strict()`; versioned; fail-closed `resolvePlan`; `__golden__/conversion.json` | base / commerce                                                                                       |
| `@caisson/kernel`                       | host the single `CREDIT_CONVERSION` constant (SD-3, recommended)                                                                                    | base                                                                                                  |
| `@caisson/ai-meter`                     | import the shared denomination instead of defining its own (SD-3); no behavior change                                                               | base                                                                                                  |
| `@caisson/billing` `events.ts`          | enrich `invoice.paid` with `subscriptionId` / `priceId` / `billingReason` / `invoiceId`; parse from `invoice.lines`/`billing_reason`                | base / P1-seam                                                                                        |
| `services/license` (**stub today**)     | `apply-billing-event.ts` mapper: `invoice.paid(create                                                                                               | cycle) → grant(sub_allotment)`; lifecycle no-ops; the webhook HTTP route calls it inside `withTenant` | P6 / commerce |
| `@caisson/credits`                      | **no change** — `sub_allotment` + source idempotency already exist (`credits.ts:14-19`, `schema.ts:39-42`)                                          | —                                                                                                     |

The webhook HTTP handler (route) is also P6: `verifyAndParse(rawBody, sig)` → `withTenant(accountId, tx
=> applyBillingEvent(tx, ev))`. Verification already exists (`webhook.ts`, `provider.ts:37-41`).

---

## 5. Test plan

`pricebook` (unit + golden):

- `resolvePlan(unknownId)` throws (fail-closed); known id returns the exact entry.
- `centsToCredits` integer round-trip; no float ever materializes; matches `__golden__/conversion.json`.
- `PRICEBOOK_VERSION` present; an entry edit without a version bump is caught by the append-only lint.

`services/license` mapper (PGlite + `withTenant`, mirroring `ai-meter/src/meter.integration.test.ts`):

- `invoice.paid(subscription_create)` → grants `creditsPerCycle` once; ledger has one `sub_allotment` row.
- **Webhook retry** (same `invoiceId`) → `{ idempotent: true }`, still **one** row (the ADR-0024
  concurrent-double-insert assertion, retargeted to `sub_allotment`).
- **Two cycles** (two distinct `invoiceId`s) → two grants, balance = `2 × creditsPerCycle`.
- `subscription.created` → **no** ledger row (the trap is closed).
- `subscription.canceled` → no row, prior balance intact (no clawback).
- `invoice.payment_failed` (if parsed) → no row.
- `invoice.paid(subscription_update)` proration → no grant under the default posture (SD-1).
- Unknown `priceId` → mapper throws, no row written (fail-closed).

---

## 6. Open sub-decisions (for the operator; do NOT auto-bind — CLAUDE.md one-operator rule)

- **SD-0 (headline — see the structured return):** what _drives_ the grant + _where_ the price-book
  lives. Recommended: `invoice.paid` + a new `@caisson/pricebook` plan-table.
- **SD-1 — proration on upgrade:** no-grant on `subscription_update` (default) vs grant a prorated
  credit delta. Recommend default (simpler, no double-grant); revisit if upgrades must feel instant.
- **SD-2 — idempotency anchor:** `invoice.id` (cycle-stable, recommended) vs Stripe `evt_…` id
  (delivery-stable, current convention). Recommend `invoice.id` for the allotment specifically.
- **SD-3 — denomination owner:** move `CREDIT_CONVERSION` to `@caisson/kernel` (recommended) vs own it
  in `pricebook` and have `ai-meter` import it. Either way, exactly one definition survives.
- **SD-4 — credit expiry on cancel/non-renewal:** no expiry (recommended, append-only-friendly) vs
  expire-at-period-end. Interacts with refund accounting.
- **SD-5 — annual plans:** grant the full annual allotment once on the annual `invoice.paid`
  (recommended; plan-book holds `cadence: "year"` + the annual `creditsPerCycle`) vs monthly drip.
- **SD-6 — the actual numbers:** `creditsPerCycle` per plan + `codegenRunCredits` are still
  operator-owned (ADR-0012 "Pricing FINAL adjustments" stays open). The design pins the _shape_ and the
  _unit_, never the figures.
- **SD-7 — grandfathering binding:** a buyer pins `PRICEBOOK_VERSION` at purchase so a later raise does
  not change their allotment (ADR-0012 grandfather mandate). Confirm the pin lives on the entitlement row.

---

## 7. What this design does NOT do

- No code, no migration SQL, no route handler (spec-first; CLAUDE.md cadence — implementation is P6).
- Does not touch `@caisson/credits` (the primitive is sufficient as-is).
- Does not reopen ADR-0017's P1↔P6 split, ADR-0007/0024 idempotency, or ADR-0060's ai-meter book — it
  composes on top of all three and **reuses** ai-meter's denomination rather than forking it.
- Does not set prices (SD-6).

## 8. Evidence (file:line)

- Gap A (no grant caller): `packages/billing/src/events.ts:16-30` (subscription.* members),
  `:79-104` (parse), vs `packages/credits/src/credits.ts:173-198` (`grant`, uncalled by billing).
- `sub_allotment` reserved + unused: `packages/credits/src/credits.ts:14-19`.
- Source idempotency index: `packages/credits/src/schema.ts:39-42`; `credits.ts:153-159`
  (`ON CONFLICT DO NOTHING`).
- `invoice.paid` carries cents but no plan/reason: `packages/billing/src/events.ts:31-37,97-104`.
- Denomination already exists (do not fork): `packages/ai-meter/src/pricebook.ts:29-33,54-60`
  (`microUsdPerCredit: 1000`), `:86-105` (BigInt `ceilDiv`), `:107-120` (fail-closed lookup).
- P1↔P6 split puts the allotment in `services/license`: ADR-0017 "P1 ↔ P6 event split".
- Board X-2 entry: `docs/state/decisions-and-forks.md` "Pricing numbers (final lock)" row.
