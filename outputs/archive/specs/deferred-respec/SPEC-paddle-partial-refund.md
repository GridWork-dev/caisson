---
title: Paddle partial refund — per-line entitlement revoke + credit clawback for a multi-item cart
status: draft - operator lock required
tags: [security, external-system, billing, data-migration]
---

# SPEC — Paddle partial refund (per-line revoke + per-line credit clawback)

**Status: draft — operator lock required.** This is a DRAFT for the operator to review; it does
NOT authorize building. Four policy/schema forks (below) gate PLAN — the persistence fork (C) shapes
tasks 2/4/5 and must be locked first, per the one-operator rule (`CLAUDE.md`: never auto-decide a
fork). **Only the fork-independent task group (billing-side capture + adjustment-item mapping +
sweep) is PLAN-ready as written; the fork-dependent group is deliberately NOT plan-ready until fork
(C) — and (A)/(B)/(D) — lock (see Tasks).**

**Structure note (deliberate deviation).** This SPEC follows the harvest-slice2 template
(Goal → Scope → Design → Tasks → Verify → Effort+Value) and adds three sections not in the
reference SPECs — **OPEN FORKS**, **ADR interactions**, and **External references** — because this
change is fork-gated (four unresolved operator locks) and touches a live external MoR (Paddle) whose
exact webhook semantics must be pinned. **Why now / trigger**, **Current state**, and **Risks** are
likewise extra context sections beyond the template. These are intentional, not silent divergence.

## Goal (WHAT + WHY)

Refunding **one line** of a multi-item Paddle cart today is a full no-op: the buyer keeps every
line's access and every line's credits. `services/license/src/apply-billing-event.ts:127`
(`if (!ev.fullyRefunded) return NO_EFFECT;`) short-circuits any partial refund — the operator-locked
ADR-0113 policy. This SPEC makes a per-line refund **do the right thing per line**: revoke only the
refunded line's entitlement (when nothing else still backs it) and claw back only that line's unspent
credits, idempotently across Paddle's per-item adjustment redeliveries. It closes exactly the gap
ADR-0204 flagged in its Consequences ("a per-line revoke posture is a future operator fork") and
realizes ADR-0113's deferred "Partial-refund / proration MODELING."

## Scope

**In:**

- Per-line entitlement revoke + per-line credit clawback for a **one-time** (`source_kind='one_time'`)
  multi-item Paddle cart, idempotent across Paddle's per-item adjustment redeliveries.
- Capturing the per-line join key — `txnitm_… → (priceId, resolved credits, entitlement ids)` — at
  `purchase.completed` grant time (the enabling persistence; unbuildable retroactively — see Why now).
- Parsing `adjustment.updated data.items[]` into a per-line refund event, and the per-line effect in
  `apply-billing-event.ts`.
- **Packages touched:** `packages/billing` (Apache-2.0 base), `packages/credits` (Apache-2.0 base),
  `services/license` (commercial). No pricebook change (`PURCHASE_BOOK_VERSION` unchanged). No new
  dependency.
- **Prior art / locks:** ADR-0113 (one-time grants + the full-refund-only money policy), ADR-0204
  (multi-item fulfillment landed; per-line refund explicitly deferred), ADR-0108 (Paddle→domain
  mapper), ADR-0089 (cycle→grant + price-book), ADR-0007 (append-only integer ledger), ADR-0200
  (Paddle sole live buyer webhook).

**Out:**

- **Subscription proration refunds.** One-time purchases only, mirroring ADR-0113's refund scope.
  `invoice.paid` stays single-line by design.
- **Stripe / Polar / LemonSqueezy real per-line refund tracking.** Only Paddle emits real per-line
  adjustment data and is the sole live buyer (ADR-0200); the other drivers keep their scalar
  `fullyRefunded` boolean. Whether the shared event _shape_ is designed for symmetry now is fork (D).
- **Re-issuing the offline-Ed25519 license / edge revoke-broadcast** — ADR-0113's own deferred
  "Issuer / revoke-broadcast to the edge" item; not this SPEC.
- **Deciding any of forks (A)–(D).** They are surfaced with options + a recommendation and left for
  the operator's `AskUserQuestion` lock before PLAN.

## Why now / trigger

- **ADR-0204 shipped multi-item carts** (`purchase.completed.lineItems`, `apps` on-site cart) —
  multi-line transactions are now the norm, so a buyer refunding one edition of a three-item cart is
  a realistic support event, not a corner case. The grant side is per-line; the refund side is not.
- **The join key must be captured NOW or the feature is unbuildable for old purchases.** A per-line
  refund needs to know which line granted which credits/entitlements. That mapping
  (`txnitm_…` → priceId → {credits, entitlement ids}) is **not persisted anywhere today** (see
  Current state). Any historical purchase made before the capture ships is permanently un-refundable
  per-line — so the capture task is worth landing early even if the refund-side logic ships later.
- **Pre-launch window is the cheap window.** Checkout is not yet live (Paddle sandbox, CF-Access gate
  ON; ADR-0082/0106); per ADR-0113 §1 there is no live grant data, so a schema addition supersedes
  cleanly with zero backfill risk. Every day past go-live, the retrofit cost only grows.

## Current state (verified against the main checkout)

**Refund mapping is coarse (whole-transaction only):**

- `packages/billing/src/paddle-events.ts` — `parsePaddleEvent` `adjustment.updated` case (lines
  219–238) reads only `data.action==='refund'`, `data.status==='approved'`, `data.transaction_id`,
  `data.totals.total`, and top-level `data.type` (`'full'|'partial'`) → maps to
  `fullyRefunded: readString(obj.type)==='full'`. **It never reads `data.items[]`** — the per-line
  adjustment array Paddle actually sends.
- `packages/billing/src/events.ts` — the `refund.completed` union member (lines 55–65) is
  `{sourceEventId, accountId, paymentId, amountRefunded, currency, fullyRefunded}`. **No per-line
  field exists.**
- `services/license/src/apply-billing-event.ts:127` — `refund.completed` short-circuits on
  `!ev.fullyRefunded`: a partial adjustment records nothing (no revoke, no clawback). Locked by
  `services/license/src/apply-billing-event.integration.test.ts:520` ("a PARTIAL refund … is a
  no-op") and `packages/billing/src/paddle.test.ts:313` ("a PARTIAL approved refund maps with
  fullyRefunded=false").

**The grant side collapses N lines before persistence — no per-line state to join back to:**

- `services/license/src/apply-billing-event.ts:88–113` (`purchase.completed`) sums `totalCredits`
  across all lines into **one** `grant()` keyed `sourceEventId: ev.paymentId`, and unions every line's
  entitlements into **one** `grantEntitlements()` also keyed on `ev.paymentId` (comment: "the refund
  path revokes by purchase_id alone").
- `packages/credits/src/credits.ts` — `credit_event` has one row per grant, `source_event_id =
paymentId`, **no line/item column**. `creditsGrantedBySource` (lines 307–319) sums **all** lines
  under `paymentId`. `clawback` (lines 345–395) already does the right thing at the account level —
  `min(amount, currentBalance)`, `FOR UPDATE` lock, idempotent on `(sourceEventId,
'refund_clawback')`, never negative — but is bounded by the whole-transaction granted total.
- `services/license/src/entitlement-store.ts` — the `entitlement_grant` uniqueness index (lines
  52–53) is `(account_id, entitlement_id, source_kind, COALESCE(subscription_id, purchase_id))`:
  **N lines granting the same entitlement id in one cart collapse to ONE row** (`ON CONFLICT DO
NOTHING`). `revokePurchaseGrants` (lines 207–222) keys **only** on `purchaseId` — the whole
  transaction. **No line/item column.**
- `packages/pricebook/src/purchases.ts` — `resolvePurchase(priceId)` (lines 211–220) is the only
  `priceId → {credits, entitlements}` source; already used per-line at grant time (fail-closed on
  unknown id, ADR-0089 §6).

**Consequence:** "revoke/claw back just the refunded line" needs **new per-line persistence at grant
time**, not just a webhook-mapping change at refund time — the join key does not exist today.

**Paddle API semantics** (verified 2026-07-02 against developer.paddle.com — see External refs):

- `POST /adjustments`: `type: 'full'` (whole transaction) or `'partial'` (requires `items[]`). Each
  item: `{item_id: 'txnitm_…', type: 'full'|'partial'|'tax'|'proration', amount?}`. `tax`/`proration`
  items are Paddle-generated, not operator-initiated.
- The adjustment's `item_id` is the **transaction ITEM id** (`txnitm_…`), from
  `transaction.details.line_items[].id` — **NOT** the catalog `price.id`. Our `readLineItems()` today
  reads `obj.items[].price.id` from the top-level request-echo array, which carries no `txnitm_`. So
  capturing the join key requires reading (or correlating to) `details.line_items[].id`.
- `adjustment.updated` webhook `data` carries, per refunded line:
  `items: [{id: 'adjitm_…', item_id: 'txnitm_…', type: 'full'|'partial'|'tax'|'proration', amount,
totals: {subtotal, tax, total}}]` — everything needed for a correct per-line effect, **provided**
  the purchase-time grant stored the `txnitm_ → (priceId, credits, entitlement ids)` mapping.
- An item-level `type: 'full'` = the whole line was refunded (candidate to revoke that line's
  entitlement + claw all its unspent credits); item `type: 'partial'` = only part of the line's
  dollar amount was refunded (Paddle gives no entitlement guidance — this is fork (A)).
- Paddle allows an item to be adjusted **multiple times up to its total** (confirmed by the
  `adjustment_transaction_item_over_adjustment` /
  `adjustment_transaction_item_has_already_been_fully_adjusted` API errors) — a line can be partially
  refunded twice ($20 then $30 of a $100 item) before being fully refunded.

## OPEN FORKS (operator locks these via AskUserQuestion before PLAN — do not default)

**Fork (C) — persistence approach [surface FIRST; it shapes tasks 2/4/5].**

- **(C-a) New side-table** `purchase_line_grant(purchase_id, item_id /*txnitm_*/, price_id,
credits_granted, entitlement_ids[], refunded_credits, refunded_at)` written alongside the existing
  aggregate `credit_event`/`entitlement_grant` rows. Additive, non-breaking; the aggregate rows stay
  the fast-path balance/entitlement read; per-line refund state lives in one place; the ADR-0113
  junction stays byte-identical.
- **(C-b) Extend the primary keys** — add a nullable `line_item_id` column to `entitlement_grant`
  (relax `entitlement_grant_uniq` to include it) and to `credit_event`. Single source of truth, no
  side-table, but a deeper schema change that **supersedes ADR-0113 §1's locked uniqueness index** and
  changes revoke semantics to a true per-line refcount. **This choice changes the schema/table targets
  of tasks 2/4/5 outright** — a PLAN cannot safely consume those tasks until (C) locks.
- **Recommended: (C-a)** — confidence MEDIUM-HIGH. Additive, append-friendly (ADR-0007), keeps the
  locked junction intact (extends, not supersedes), and isolates the new concern. Evidence: `clawback`
  and `entitlement_grant` are already correct at their current grain; (C-a) adds a join table rather
  than reworking two locked schemas. Trade-off: a second table to keep coherent with the aggregates.

**Fork (A) — what does an item-level `type: 'partial'` (dollar-only) refund do to entitlement + credits?**

- **(A-1)** Only item `type: 'full'` ever revokes an entitlement (binary entitlements make "partial
  revoke" meaningless); a partial-dollar adjustment claws a **proportional** credit amount, entitlement
  untouched.
- **(A-2)** A partial-dollar adjustment claws **nothing** until the line is fully refunded (entitlement
  and credits both wait for cumulative `type: 'full'`).
- **Recommended: (A-1) with entitlement untouched on partial** — confidence MEDIUM. Matches Paddle's
  own item-type distinction and returns money the buyer is owed without stripping access they still
  partly paid for. Trade-off: proportional credit math introduces a rounding site (must respect
  ADR-0007 integer-only + ADR-0212 rounding provenance). This is a genuine product-policy call — do
  not default.

**Fork (B) — when the SAME entitlement id is granted by two+ lines in one cart, does refunding ONE line revoke it?**

- **(B-1) True per-line refcount:** the entitlement stays active as long as ANY not-fully-refunded
  line in the cart (or another source) still backs it; revoke only when every backing line is refunded.
- **(B-2) Cart-level OR:** refunding any one backing line revokes the entitlement.
- **Recommended: (B-1)** — confidence MEDIUM-HIGH. Consistent with ADR-0071/0113's existing
  cross-source refcount ethos (an entitlement survives losing one of two sources). Under (C-a) this is
  a computed check against `purchase_line_grant` (revoke the single junction row iff all lines backing
  that id are refunded) — the junction schema stays intact. Getting this wrong over-revokes (strips
  paid access) or under-revokes (leaves refunded access live) — both money/access-integrity bugs.

**Fork (D) — build against Paddle only, or design the shared event shape for cross-driver symmetry now?**

- **(D-1) Paddle-only:** the new per-line refund event is populated only by the Paddle mapper; the
  other three drivers keep their scalar `fullyRefunded`.
- **(D-2) Provider-agnostic shape now:** design `refund.completed`'s per-line array so Stripe/Polar/
  LemonSqueezy can populate it later (they emit no real per-line refund data today).
- **Recommended: (D-2) shape, (D-1) population** — confidence MEDIUM. Add the per-line array to the
  shared `DomainBillingEvent` (cheap, symmetric with the `purchase.completed.lineItems` precedent from
  ADR-0204) but only the Paddle mapper fills it; others one-entry-wrap or leave empty. Low cost, avoids
  a second schema migration if a future MoR gains the capability.

## Design (fork-independent parts settled; fork-dependent parts flagged)

**1. Capture the per-line join key at grant time (settled shape — ship early, low-risk).**
`packages/billing/src/paddle-events.ts` `readLineItems()` gains the `txnitm_` id per line, read from
`data.details.line_items[].id` (or correlated by order to the existing `items[]`). Extend
`purchase.completed.lineItems` in `packages/billing/src/events.ts` with `itemId: z.string()` (empty
string for drivers that carry none). At `purchase.completed` time, `apply-billing-event.ts` writes the
per-line provenance (**layout per fork C**) alongside the existing aggregate `grant()` /
`grantEntitlements()` — `resolvePurchase(line.priceId)` already yields `{credits, entitlements}` per
line; persist the **resolved** values directly (not the priceId alone) so a later refund never
re-derives from a possibly-changed pricebook (ADR-0006/0007 append-only ethos). Credits stay branded
`Credits` (ADR-0212). _(The billing-side capture — `readLineItems` + the `events.ts` field — is
fork-independent; only where/how the resolved values persist depends on fork C.)_

**2. Map `adjustment.updated data.items[]` → a per-line refund event (settled shape; fork D scope).**
In the `adjustment.updated` case, when `type === 'partial'`, parse `data.items[]`: skip Paddle-generated
`tax`/`proration` item types, and for each `full`/`partial` item emit `{itemId, amountRefunded:
totals.total, fullyRefunded: item.type==='full'}`. Extend `refund.completed` with an
`items: {itemId, amountRefunded, fullyRefunded}[]` array (the whole-transaction `type: 'full'` path
keeps its existing scalar behavior — the current full-refund clawback is unchanged).

**3. Per-line revoke + clawback in `apply-billing-event.ts` (fork A/B/C dependent).**
For each refunded line, look up its persisted `(entitlement ids, credits granted)` via the fork-(C)
join key. Revoke the line's entitlement ids per fork (B) (under (B-1)+(C-a): revoke the junction row
only if no other still-active line backs the id). Claw back `min(thisLine'sCredits, currentBalance)`
via the existing `clawback()` — it is already amount-agnostic and idempotent; the only change is a
**per-line-unique, per-delivery** `sourceEventId`.

**4. Idempotency (settled — the load-bearing correctness rule).** The per-line clawback key MUST be
unique **per adjustment delivery**, not merely per line: `${adjustmentId}:${itemId}` (or
`${eventId}:${itemId}`). Paddle allows a line to be partially refunded more than once, so a naive
"first delivery for this item = the whole clawback" key silently drops a second legitimate partial
adjustment. This is distinct from the whole-purchase `paymentId` key the existing full-refund path
uses, so full and partial refunds never collide.

**Ponytail note:** the fork-(A) proportional-credit path is the only new arithmetic — everything else
reuses `clawback()`, `resolvePurchase()`, and the existing revoke functions at a finer key. No new
credit primitive, no new package, no new dependency.

## Tasks

> **PLAN-readiness gate.** Tasks split into two groups. **Group 1 (fork-independent)** is atomic and
> verifiable _now_ — a PLAN can consume it before the forks lock. **Group 2 (fork-dependent)** is
> **NOT plan-ready as written**: its schema/table targets and policy branches change with the fork
> (C)/(A)/(B) lock (e.g. (C-b) retargets tasks 2/4/5 onto `entitlement_grant`/`credit_event` instead
> of a side-table). Task numbers below reflect the recommended defaults C-a / A-1 / B-1 / D-2 as the
> _provisional_ shape; a different lock reshapes group 2. Do NOT open a PLAN on group 2 until the
> operator locks (C) — and (A)/(B)/(D) — via AskUserQuestion.

### Group 1 — fork-independent (PLAN-ready now)

1. **Capture `txnitm_` per line, billing-side (billing).** `packages/billing/src/paddle-events.ts`:
   read `details.line_items[].id` into each `readLineItems()` entry; add `itemId` to
   `purchase.completed` in `events.ts`; Stripe/Polar/LemonSqueezy one-entry-wrap with `itemId: ""`.
   _(The grant-time persistence of the resolved per-line values is task 2 — fork-dependent.)_ Verify:
   `bun test packages/billing/src/paddle.test.ts`.
2. **Map partial adjustment items (billing).** `paddle-events.ts` `adjustment.updated`: parse
   `data.items[]` (skip `tax`/`proration`), emit the `refund.completed.items[]` array; extend the
   `events.ts` schema. _(Shared-vs-Paddle-only array shape is fork D — but the mapping itself is
   settled.)_ Verify: `bun test packages/billing/src/paddle.test.ts`.
3. **Sweep + changeset.** `bun run check` green; changesets naming `@caisson/billing`,
   `@caisson/credits` (if touched), and the `services/license` change. Verify:
   `bun run check && bunx changeset status --since=origin/main`.

### Group 2 — fork-dependent (BLOCKED until fork C/A/B/D locks; shape shown under C-a / A-1 / B-1 / D-2)

2. **Persist per-line grant provenance (license) — FORK (C).** New `purchase_line_grant` table + its
   `buildTenantPolicySql` RLS (ADR-0005) in `services/license`; write one row per line at
   `purchase.completed` alongside the existing aggregate grant. **Under (C-b) this instead adds a
   `line_item_id` column to `entitlement_grant`/`credit_event` — a different diff.** Verify:
   `bun test services/license/src/apply-billing-event.integration.test.ts`.
3. **Per-line revoke store fn (license) — FORK (B)+(C).** `entitlement-store.ts`: add a
   revoke-one-line function that revokes an entitlement's junction row only when no other active line
   backs it (fork B-1 refcount check against the fork-(C) store). Verify:
   `bun test services/license/src/entitlement-store.integration.test.ts`.
4. **Per-line effect (license) — FORK (A)+(B)+(C).** `apply-billing-event.ts` `refund.completed`: for
   `items[]`, revoke per line + `clawback(min(lineCredits, balance))` keyed `${adjustmentId}:${itemId}`;
   apply the fork-(A) partial-dollar policy; keep the whole-transaction `fullyRefunded` path unchanged.
   Verify: `bun test services/license/src/apply-billing-event.integration.test.ts`.
5. **Extend the locked tests — task scaffolding fork-independent, policy cases inherit (A)/(B).**
   `packages/billing/src/paddle.test.ts` (near line 313): item-level adjustment parsing (independent).
   `apply-billing-event.integration.test.ts` (replace the line-520 no-op test): single-line-of-multi
   full refund, same-entitlement-two-lines-one-refunded (**asserts the locked fork B**), partial-dollar
   policy case (**asserts the locked fork A**), re-delivery idempotency, and unspent-vs-spent clawback
   bound. Verify: `bun test services/license/src packages/billing/src`.

## Verify (goal-backward)

Re-ask the goal against the merged diff + tests:

- A one-line-of-three **full** refund revokes only that line's entitlement and claws only that line's
  unspent credits; the other two lines keep access and credits (assert balance + `readEntitlements`).
- An entitlement backed by **two lines**, one refunded, **survives** (fork B-1) — revoked only when
  both backing lines are refunded.
- A partial-**dollar** adjustment behaves per the locked fork (A) (proportional credit claw,
  entitlement untouched under A-1).
- A **re-delivered** `adjustment.updated` for the same `(adjustmentId, itemId)` writes **no second**
  clawback; **two sequential** partial adjustments on the same item **both** claw (per-delivery key).
- The clawback never pushes the wallet negative (`min(lineCredits, balance)` preserved).
- A purchase made **before** the join-key capture shipped is handled honestly (documented as
  full-refund-only; no crash, no guessed grant).
- ADR-0007 intact (integer-only; clawback is a new compensating entry). ADR-0212 held (per-line
  credits are branded `Credits`). `bun run check` green across billing/credits/license; no
  license-tier / no-depend-up violation (ADR-0003).

## Risks

- **Retrofit impossibility (HIGH).** Without the `txnitm_` join key captured at grant time, per-line
  refund is impossible to reconstruct for already-granted purchases — no way to know which line a
  historical grant's credits/entitlements came from. Mitigation: land group-1 task 1 (capture) early
  even if the refund side ships later; accept that per-line support applies only to purchases made
  after the capture change. Pre-launch (Paddle sandbox, no live data per ADR-0113 §1) is the cheap
  window.
- **Refcount-within-cart correctness (HIGH, security-sensitive).** Fork (B) wrong either over-revokes
  (strips access a still-paid line legitimately backs) or under-revokes (leaves access live after a
  refund) — both are money/access-integrity bugs on the gridwork-core `identity/security.md` path.
  Mitigation: the same-entitlement-two-lines test case is mandatory; owner-facing behavior gets a
  security-audit pass at SHIP.
- **Multi-adjustment-per-item idempotency (HIGH).** Paddle permits an item to be adjusted multiple
  times up to its total; a per-line (not per-delivery) key silently drops the second legitimate
  partial adjustment. Mitigation: `${adjustmentId}:${itemId}` key + the re-delivery + sequential-
  partials tests.
- **Fork (A) proportional-credit rounding (MEDIUM).** A proportional claw introduces a rounding site —
  must be integer-only (ADR-0007) with rounding provenance (ADR-0212); a golden-file case pins the
  direction.
- **`item_id` source correctness (MEDIUM).** The adjustment's `item_id` references
  `details.line_items[].id`, not the top-level `items[]` echo; reading the wrong array yields a key
  that never joins. Mitigation: group-1 task 1 test asserts a captured `txnitm_` matches an
  adjustment's `item_id` in a round-trip fixture.
- **SHIP gate:** security + external-system tagged → a `gw-security-auditor` pass is required at SHIP
  given the money/entitlement path (gridwork-core doctrine tag taxonomy).

## ADR interactions

- **ADR-0113 — REQUIRES SUPERSEDING (the money-policy clause) + realizes (the deferred item).** The
  locked "acts only on a FULL refund; a partial refund is a no-op" gate (§4, and the
  `apply-billing-event.ts:127` short-circuit) must be superseded by a later ADR — partial refunds
  become actionable per line. This directly **realizes** ADR-0113's own deferred "Partial-refund /
  proration MODELING." **Under fork (C-b) only**, adding a `line_item_id` discriminator to
  `entitlement_grant_uniq` also **supersedes ADR-0113 §1's** locked junction uniqueness index; under
  **(C-a)** the junction stays intact (extends, not supersedes).
- **ADR-0204 — realizes / extends.** Realizes the per-line refund fork the Consequences section
  explicitly deferred; the symmetric refund-side counterpart to §5's multi-item fulfillment
  (vuln-0005).
- **ADR-0108 — extends.** Adds item-level `data.items[]` parsing + `details.line_items[].id` capture
  to the Paddle→domain mapper; no existing mapping changes.
- **ADR-0089 — extends / honors.** Per-line clawback amounts derive from persisted exact table-integer
  credits (§5); `resolvePurchase` stays fail-closed on unknown ids (§6). No new rounding on the
  full-line path.
- **ADR-0007 — honors.** The per-line clawback is a new append-only compensating entry; persisting the
  resolved per-line `{credits, entitlement ids}` at grant time is the append-friendly choice. Fork
  (A-1) proportional credits must stay integer-only.
- **ADR-0071 — extends.** Per-line refcount (fork B-1) extends the entitlement-store refcount model
  from cross-source to within-cart.
- **ADR-0212 — relates.** Per-line credits remain branded `Credits`; any proportional-claw arithmetic
  carries `RoundedMoney` provenance.
- **ADR-0005 — relates.** Any new per-line table (fork C-a) carries `buildTenantPolicySql` fail-closed
  RLS, scoped inside `withTenant`.
- **ADR-0003 — relates.** New fields land in base Apache-2.0 packages (`billing`, `credits`) and the
  commercial `services/license`; no open→commercial depend-up.
- **ADR-0200 — relates.** Paddle is the sole live buyer webhook, so population is Paddle-only (fork D);
  the shared event shape may still be designed provider-agnostic.
- **ADR-0014 / data-migration — relates.** The new table/columns land in the prod numbered-Drizzle
  path; pre-launch there is no live grant data, so the addition supersedes cleanly (ADR-0113 §1),
  keeping the `data-migration` tag's rollback risk low.
- **ADR-0006 — relates.** No pricebook change; `PURCHASE_BOOK_VERSION` is untouched (the refund reads
  persisted per-line values, not a re-resolved pricebook).

## External references (Paddle, verified 2026-07-02)

- `POST /adjustments`: https://developer.paddle.com/api-reference/adjustments/create-adjustment/
- `adjustment.updated` / `adjustment.created` webhooks:
  https://developer.paddle.com/webhooks/adjustments/adjustment-updated ·
  https://developer.paddle.com/webhooks/adjustments/adjustment-created
- Transaction adjustments (the `details.line_items[].id` source):
  https://developer.paddle.com/build/transactions/create-transaction-adjustments/
- Cumulative-per-item-adjustment errors (idempotency evidence):
  https://developer.paddle.com/errors/adjustments/adjustment_transaction_item_over_adjustment ·
  https://developer.paddle.com/errors/adjustments/adjustment_transaction_item_has_already_been_fully_adjusted
- Adjustment line items report:
  https://developer.paddle.com/build/reports/adjustment-line-items

## Effort: L (multi-package cross-cut: billing mapper + credits ledger key + license schema/revoke, + a fork-C schema migration and a security-sensitive refcount path; ~2–3 days once forks lock). Value: HIGH — closes a money/access-integrity gap two ADRs (0113, 0204) explicitly deferred, and the join-key capture (group-1 task 1) is a time-boxed pre-launch window that is unbuildable retroactively. Effort is gated: only the fork-independent group (~0.5 day) is buildable before the operator locks fork (C).
