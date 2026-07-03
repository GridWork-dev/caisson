---
title: admin surface v2 — operator revoke of REAL purchase entitlements
status: draft - operator lock required
tags:
  [
    security,
    billing,
    auth,
    external-system,
    data-migration,
    frontend,
    observability,
  ]
proposed-adr: ADR-0225 (next in sequence; ceiling is 0224 — re-verify before filing, ADR-0088 collision-check convention)
adr-interactions: extends ADR-0113 (refcount revoke/clawback) · extends ADR-0218 (per-line remainder) · extends ADR-0220 (admin mutation surface v1) · extends ADR-0204 (owner gate / CF-Access-JWT) · reuses ADR-0007/0212 (integer/branded money) · reuses ADR-0074 (feature envelope) · reuses ADR-0047/0010 (edge Ed25519 license verify) · reuses ADR-0005/0052/0006 (RLS + WORM append-only)
linear: CAISSON-19
---

# SPEC — admin surface v2: operator revoke of REAL purchase entitlements

> **DRAFT for operator review. It does not authorize building.** The post-wave-hardening
> triage spec (`outputs/specs/post-wave-hardening/SPEC-post-wave-hardening.md`, "Out of scope")
> explicitly carved CAISSON-19 out for "its own SPEC + fork round (refund interaction, clawback
> semantics, ADR-0113/0218 refcount effects)". Per the founding operator rule (`CLAUDE.md`:
> "Never auto-decide a fork") no product code lands until a new ADR locks the forks below. This
> SPEC is the input to that ADR, not an execution plan.

## Goal (WHAT + WHY)

Give the operator an `apps/admin` path to **revoke a REAL, paid entitlement** — a grant a buyer
obtained through a subscription cycle (`invoice.paid`) or a one-time purchase
(`purchase.completed`) — for the fraud / chargeback-received / ToS-violation cases where the
operator wants to **strip access without issuing a Paddle refund**.

Admin v1 (ADR-0220) deliberately does NOT do this. Its `revokeAdminComp`
(`services/license/src/entitlement-store.ts:373`) filters `source_kind = 'admin_comp'` and carries
an explicit ceiling comment:

> `// ponytail: v1 operator revoke is comp-only. Revoking a real purchase/subscription entitlement`
> `// is a deliberate follow-up (it must decide the refund/refcount interaction) — out of scope here.`

So today the ONLY way a real paid grant flips to `revoked` is the webhook path
(`services/license/src/apply-billing-event.ts`) firing on a Paddle `subscription.canceled` or
`refund.completed`. If no such provider event fires — a fraudulent buyer whose card the operator
will not refund, a chargeback already lost at the bank, a ToS ban — the paid `entitlement_grant`
row stays `active` forever and the only lever is **raw SQL against the production money rows**, the
exact highest-risk operator action ADR-0220 set out to remove.

**Why this is genuinely its own fork round and not a one-line extension of v1:** a real-purchase
revoke touches the money core (does it claw credits? bounded how?), the refcount model (an
entitlement backed by two paid sources), the external Paddle boundary (does revoke imply refund?),
and the edge (a revoked buyer still holds a signed offline license token that grants registry
access until it expires). Each of those is an operator-owned decision, not a default.

## Tags

`security` · `billing` · `auth` · `external-system` · `data-migration` · `frontend` ·
`observability`. Per `identity/doctrine.md` these fire the SHIP audits:

- **SECURITY (blocking — money/license seam).** This revokes PAID access and can claw real
  credits. `CLAUDE.md`: crypto/money/license code here is **Fable-lane review, never fan-out**.
- **`external-system`** is present _conditionally_ — it fires only if a fork below elects to have
  revoke call the Paddle API (Fork R-1 option C). The Recommended path (R-1 = A) keeps revoke
  DB-only and this tag becomes classification-only.
- **Migration-safety (`data-migration`)** — the `admin_action_log` action-enum extension + any
  new revocation-list table.
- **UI review (`frontend`)** — the higher-blast-radius revoke form (impact preview + type-to-confirm).
- `observability` — classification-only (the dual-log already exists).

## Why now / trigger

- Checkout is imminent (Paddle **sandbox**, pre-launch CF-Access gate ON). The operator needs the
  fraud/chargeback/ToS lever before the first real buyer — the refund-driven revoke path only
  covers the "give the money back" case.
- ADR-0220 shipped the whole mutation scaffold (`admin_write` role, dual-log, WORM anchor,
  type-to-confirm UI, CF-Access-JWT gate) that v2 reuses verbatim — the marginal build is small;
  the decisions are the work.
- The `fix/money-path-hardening` branch just landed the exact remainder machinery a paid-purchase
  clawback needs (`creditsClawedForSource`, `creditsGrantedBySource`, purchase-remainder bounding
  in `apply-billing-event.ts`) — v2 is cheapest to design while that context is fresh.

## Out of scope

- **Refunding money.** A refund is done in the Paddle dashboard; the `refund.completed` webhook
  then does its OWN revoke + clawback (`apply-billing-event.ts:160`) automatically. Admin v2 is the
  **complement**: strip access when NO refund fires. (Whether the two can double-apply is Fork R-1.)
- **Re-granting / reactivation.** ADR-0113's "resubscribe reactivation" deferral is untouched here.
- **Bulk / batch revoke.** One target account, one action per call (the ADR-0220 RLS bound).
- **A buyer-facing surface.** Operator-only, behind CF-Access.
- **Edge revocation-broadcast infrastructure** as a hard requirement — its necessity is Fork R-4;
  if chosen it is scoped there, not assumed.
- **Cancelling a live Paddle subscription** — only relevant under Fork R-3 option B (see there).

## Current state (verified in-repo)

| Fact                                                                                           | Anchor                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1 revoke is comp-only; the ceiling is a `ponytail:` comment                                   | `services/license/src/entitlement-store.ts:373` (`revokeAdminComp`, `source_kind = 'admin_comp'` filter)                                                                       |
| Real paid grants carry `source_kind IN ('subscription','one_time')`, source-ref CHECK-pinned   | `services/license/src/entitlement-store.ts:29` (`ENTITLEMENT_SCHEMA_SQL`)                                                                                                      |
| The only revokers of paid grants are the webhook handlers                                      | `services/license/src/apply-billing-event.ts:152` (`subscription.canceled`), `:160` (`refund.completed`)                                                                       |
| Subscription revoke helper (source-scoped, refcount-safe, idempotent)                          | `revokeSubscriptionGrants` — `entitlement-store.ts:230`                                                                                                                        |
| One-time purchase revoke helper (PaymentIntent-scoped)                                         | `revokePurchaseGrants` — `entitlement-store.ts:258`                                                                                                                            |
| Per-line purchase revoke helper (ADR-0218)                                                     | `revokePurchaseLineGrants` — `entitlement-store.ts:291`                                                                                                                        |
| Refcount truth: an account HAS an entitlement iff ≥1 ACTIVE grant                              | `readEntitlements` — `entitlement-store.ts:205` (`SELECT DISTINCT … WHERE status='active'`)                                                                                    |
| Clawback: bounds to balance, `SELECT … FOR UPDATE`, returns `{clawedBack}`                     | `packages/credits/src/credits.ts:425`                                                                                                                                          |
| Credits granted / already-clawed for a purchase (both claw directions)                         | `creditsGrantedBySource` / `creditsClawedForSource` (`credits.ts`; the latter added on `fix/money-path-hardening`)                                                             |
| Full-refund claw is now bounded to `granted − alreadyClawed` (CAISSON-5)                       | `apply-billing-event.ts:175` (money-path-hardening branch)                                                                                                                     |
| Account-existence guard before any admin mutation (CAISSON-9)                                  | `assertAccountExists` — `admin-mutations.ts` (money-path-hardening branch)                                                                                                     |
| v1 mutation surface: `withAdminWrite`, dual-log, WORM anchor, `WormStatus`                     | `services/license/src/admin-mutations.ts`                                                                                                                                      |
| Queryable audit half; action enum CHECK-pinned to the 4 v1 actions                             | `services/license/src/admin-audit-log.ts:25` (`admin_action_log`, CHECK on 4 actions)                                                                                          |
| Admin UI: type-to-confirm cards, CF-Access-gated routes                                        | `apps/admin/src/app/business/mutations.tsx`, `apps/admin/src/app/api/admin/entitlement/revoke/route.ts`                                                                        |
| Auth floor: CF-Access-JWT middleware, `aud`-pinned, fail-closed                                | ADR-0204 §3                                                                                                                                                                    |
| **Edge access is a SIGNED offline license token, verified at the Worker — NOT a live DB read** | `registry/worker/entitlement-filter.ts` (`verifyLicense`, baked Ed25519 pubkey); token `expiry` is ISO-8601 or `null` = perpetual-per-major (`services/license/src/app.ts:86`) |
| ADR-0113 already flags edge revoke-broadcast as deferred                                       | ADR-0113 "Deferred": _"the offline-Ed25519 license is not re-issued on revoke; edge entitlement freshness is the issuer slice's concern"_                                      |

**The load-bearing edge fact:** revoking a paid `entitlement_grant` row makes
`resolveAccountEntitlements` (`services/license/src/resolve-entitlements.ts`) drop it immediately —
but a buyer who already holds a signed license token keeps registry/download access at the edge
**until that token expires**, because the Worker verifies the token OFFLINE against a baked pubkey
and never re-reads the DB. If tokens are issued with `expiry: null` (perpetual-per-major), a
DB-only revoke never reaches the edge at all. This is Fork R-4.

## Design (reuse-first; the forks are the real content)

Everything mechanical is already built and tested — v2 is a thin composition:

- **Revoke** = call the existing source-scoped helper (`revokeSubscriptionGrants` /
  `revokePurchaseGrants`) under `withAdminWrite` instead of `withTenant`, filtered to the
  operator-chosen account + source id. Refcount and idempotency come for free (they only flip
  `active` rows, scoped to one source, never touch a sibling source backing the same entitlement).
- **Clawback** (if elected) = reuse the CAISSON-5 pattern exactly: `remaining =
max(0, creditsGrantedBySource(paymentId) − creditsClawedForSource(paymentId))`, then
  `clawback({ amount: remaining, sourceEventId: paymentId })` — which further bounds to the wallet
  balance and never goes negative. This is the _same_ arithmetic the full-refund webhook now runs,
  so an operator revoke and a later Paddle refund of the same purchase are mutually idempotent
  (whichever lands second claws 0).
- **Audit** = the ADR-0220 dual-log verbatim (`admin_action_log` + WORM `appendWorm`), with new
  action discriminator(s) — see Fork R-5.
- **Auth / bound / UI** = ADR-0204 CF-Access-JWT + ADR-0220 one-account-per-call + type-to-confirm,
  reused; the only UI addition is an impact preview (Fork R-6).

The genuinely-new code is small: a target-identity resolver (which grant(s) does the operator mean
— Fork R-2), a compose function that ties revoke+clawback into one `withAdminWrite` transaction,
and the audit-enum migration. Estimated < 250 LOC excluding the optional edge-broadcast fork.

## Forks (operator-locked — do NOT pre-bind)

### Fork R-1 — Does an operator revoke touch MONEY (Paddle / credits)?

The core question. Three coherent postures:

- **A (Recommended — high confidence). DB-only: revoke the entitlement + claw UNSPENT credits;
  NEVER call Paddle.** Refunds stay operator-driven in the Paddle dashboard (the `refund.completed`
  webhook auto-syncs the DB, and is idempotent with this claw). Revoke is the "strip access, keep
  the money" lever (fraud, chargeback-already-lost, ToS). _Evidence:_ the clawback machinery is
  built and bounded (CAISSON-5); keeping Paddle out preserves the doctrine trust boundary (external
  side-effects → main thread, never a mutation service credential in `apps/admin`); the
  external-system tag stays classification-only. _Tradeoff:_ two separate operator gestures to both
  strip access AND refund (revoke here, refund in Paddle) — acceptable, they're different intents.
- **B. Revoke entitlement only; NEVER claw credits.** Access dies, the credit wallet is untouched.
  _Tradeoff:_ a fraudulent buyer keeps spendable credits they didn't pay to keep; under-punishes
  the exact case v2 exists for.
- **C. Revoke + claw + call the Paddle refund API.** One button does everything. _Tradeoff:_
  fires the `external-system` audit (blocking), needs a Paddle-write credential in the admin blast
  radius, and races the resulting `refund.completed` webhook (double-revoke — idempotent, but a
  confusing audit trail). Rejected posture unless the operator specifically wants one-click
  refund+revoke; it collapses the very distinction (refund-vs-strip) that motivates v2.

_Recommendation rationale:_ A cleanly fills the evidenced gap (strip-without-refund) with only
reuse, keeps the money boundary intact, and stays idempotent with the existing refund path. Make
the credit-claw an explicit per-action operator choice inside A (a checkbox: "also claw unspent
credits"), defaulting ON for fraud — see Fork R-6's preview.

### Fork R-2 — Revoke GRANULARITY: what does the operator target?

`entitlement_grant` is refcounted per `(account, entitlement, source, purchase/line)`. "Revoke
compliance for account X" is ambiguous when X holds it from two sources.

- **A (Recommended — medium-high). Source-scoped: the operator targets a specific paid SOURCE**
  (a `subscription_id` or a `purchase_id`/`paymentId`), and v2 revokes every grant that source
  backs — reusing `revokeSubscriptionGrants` / `revokePurchaseGrants` unchanged. The UI lists the
  account's active paid sources (from the ADR-0141 read cockpit) and the operator picks one.
  _Evidence:_ matches the webhook's own unit of action (a cancel/refund is per-source), preserves
  refcount (a sibling source keeps the entitlement), reuses tested helpers 1:1. _Tradeoff:_ the
  operator thinks in "this purchase", not "this entitlement" — but that IS the correct mental model
  for a chargeback/fraud (you revoke _a transaction_, not an abstract capability).
- **B. Entitlement-scoped across ALL real sources:** revoke every `subscription`+`one_time` grant
  for one `entitlement_id`. _Tradeoff:_ over-revokes when two purchases back it; needs a new
  cross-source revoke helper; clawback becomes ambiguous (which purchase's credits?).
- **C. Single grant-row-scoped** (target one `entitlement_grant.id`). _Tradeoff:_ maximum
  precision, worst ergonomics; the operator would read raw grant ids.

### Fork R-3 — Are SUBSCRIPTION grants revocable, or one-time purchases ONLY?

A `subscription`-source grant is odd to revoke in isolation: the Paddle subscription is still
active, so the **next `invoice.paid` re-grants it** (idempotent per-source), silently undoing the
operator's revoke within one cycle.

- **A (Recommended — high confidence). One-time purchases ONLY in v2.** `source_kind = 'one_time'`
  grants are terminal (no renewal re-grants them), so a revoke sticks. For a subscription, the
  correct lever is **cancel the subscription in Paddle** → `subscription.canceled` webhook revokes
  it durably. _Evidence:_ revoking a still-billing subscription in the DB is a footgun (re-granted
  next cycle); the webhook path already handles subscription revoke correctly. _Tradeoff:_ the
  operator must go to Paddle to kill a subscription's access — but that's the only way to also stop
  the billing, so it's the right home.
- **B. Both, but a subscription revoke ALSO marks the subscription "admin-suspended"** so the next
  `invoice.paid` skips the re-grant. _Tradeoff:_ needs a new suspension flag + a webhook-path check
  (base billing-mapper edit) — real new surface, not reuse; only worth it if the operator wants to
  freeze access mid-cycle without cancelling billing (rare).

### Fork R-4 — EDGE propagation: how fast does registry/download access actually die?

A DB revoke is invisible to the Worker, which verifies a SIGNED offline license token against a
baked pubkey (`registry/worker/entitlement-filter.ts`). A revoked buyer keeps edge access until
their token expires; with `expiry: null` tokens, forever.

- **A (Recommended — medium confidence, pending the token-expiry decision). Accept a bounded
  staleness window; document it.** v2 revokes the DB truth (which kills the buyer _dashboard_ view
  and any FRESH token issue immediately); edge access lapses when the held token expires. Pair this
  with an operator note that fraud/ToS revokes should be issued alongside a short license-token TTL
  policy. _Evidence:_ ADR-0113 already deferred edge revoke-broadcast; building a revocation list is
  a whole infra slice disproportionate to a pre-launch, low-volume operator action. _Tradeoff:_ a
  revoked fraudster can still `npm install` premium modules until their token expires — materially
  bad ONLY if tokens are long-lived/perpetual. **This fork is coupled to the token-expiry policy**
  (currently `expiry` can be `null`); the operator should also decide a non-null default TTL for
  paid tokens, which turns the staleness window from "forever" into "≤ TTL".
- **B. Build an edge revocation list (CRL-style):** the Worker checks a small deny-set (revoked
  license ids / account ids) it fetches on a short cache. _Tradeoff:_ a genuine new infra piece
  (a KV/asset the Worker reads, a publish path from revoke) — the ADR-0113 "issuer slice" work,
  correctly its own SPEC; do NOT fold it into v2.
- **C. Force a license RE-ISSUE with reduced claims on revoke** (rotate the buyer's token so the
  new one omits the revoked entitlement). _Tradeoff:_ only helps if the client re-fetches the token
  AND the old one has expired — doesn't revoke an already-distributed token; more moving parts than
  it's worth pre-launch.

### Fork R-5 — AUDIT action taxonomy: new action type, or reuse `entitlement_revoke`?

`admin_action_log.action` is CHECK-pinned to the four v1 actions
(`admin-audit-log.ts:34`); `entitlement_revoke` today MEANS comp-only.

- **A (Recommended — high confidence). Distinct new action(s):** `purchase_revoke` (and, if R-1=A
  claws, the clawback is captured in the same action's `before/after` money snapshot, not a
  separate row). Extend the `ADMIN_ACTIONS` enum + the CHECK via a `@caisson/migrate` numbered
  migration (ADR-0014). _Evidence:_ keeps "revoked a comp" and "revoked a paid purchase +
  clawed $N" auditable as distinct events — the WORM chain is customer-facing evidence, so the
  distinction is load-bearing for a chargeback dispute. _Tradeoff:_ a migration (small, additive,
  pre-launch clean). Dual-log wiring (`insertAdminActionLog` + `appendWorm`) is otherwise unchanged.
- **B. Reuse `entitlement_revoke`** and disambiguate by payload. _Tradeoff:_ conflates comp-revoke
  and paid-revoke in every audit query; a reviewer can't filter "show me every paid revoke" without
  parsing JSON. Rejected for a money/evidence seam.

### Fork R-6 — UI confirmation: is v1's type-to-confirm enough for a higher blast radius?

v1 arms the submit when the operator retypes the target account id or `CONFIRM`
(`mutations.tsx:126`). Paid revoke + clawback is strictly higher-stakes.

- **A (Recommended — medium-high). Type-to-confirm PLUS a mandatory impact preview.** Before arming,
  the form shows: the selected source, the exact entitlements that will drop (accounting for
  refcount — "compliance stays active, backed by subscription sub_123"), and the credit claw
  preview (`granted − alreadyClawed`, bounded to balance). The operator confirms against a concrete
  effect, not a blind id. Reuses the ADR-0141 read cockpit for the preview data. _Tradeoff:_ one
  extra read round-trip before the confirm — trivial, and it's the single best guard against a
  mis-targeted paid revoke.
- **B. Reuse v1's type-to-confirm unchanged.** _Tradeoff:_ the operator can't see refcount survival
  or the claw amount before committing — the exact places a paid revoke surprises you.

## Tasks (atomic; each with a verify command) — indicative, pending fork locks

1. **Target-identity resolver + read.** Surface the account's active PAID sources
   (`subscription_id` / `purchase_id`, with the entitlements each backs) via the ADR-0141 read
   role for the picker + preview (Fork R-2/R-6). Verify: `bun test apps/admin/src/lib` (a
   fixture account with two sources lists both, with per-source entitlement sets).
2. **Compose `revokePurchaseAdmin`** in `services/license/src/admin-mutations.ts`: under
   `withAdminWrite`, call `assertAccountExists`, then the source-scoped revoke helper, then (if
   R-1=A) the bounded clawback (`creditsGrantedBySource − creditsClawedForSource`, `clawback`),
   all in one transaction. Verify: `bun test services/license/src/admin-mutations.integration.test.ts`
   — revoke sticks; a sibling-source entitlement survives (refcount); claw bounds to balance and to
   granted-minus-already-clawed; a re-run and a subsequent full-refund webhook both claw 0.
3. **Audit-enum migration** (Fork R-5=A): extend `ADMIN_ACTIONS` + the `admin_action_log` CHECK
   via `@caisson/migrate`. Verify: `bun test services/license/src` (a `purchase_revoke` row
   inserts; an unregistered action is rejected by the CHECK).
4. **Route + Zod `.strict()` body** (`/api/admin/entitlement/revoke-purchase`), CF-Access-gated,
   actor from the middleware header. Verify: `bun test apps/admin` — rejects unknown fields, denies
   a missing `x-admin-actor`, one account per call.
5. **UI: paid-revoke card with impact preview + type-to-confirm** (Fork R-6). Verify: `bun run build`
   (Next client/server boundary) + a component test for the preview + confirm gate.
6. **Dual-log wiring** (`insertAdminActionLog` + `appendWorm`, `WormStatus` surfaced do-not-retry).
   Verify: `bun test` — both logs land per revoke; a failed revoke writes neither.
7. **Docs + runbook:** record the edge-staleness window (Fork R-4) + the paid-token TTL policy in
   `docs/state/launch-runbook.md`. Verify: manual — the runbook names the window.
8. **Changeset + full check.** Verify: `bunx changeset status --since=origin/main` + `bun run check`.

## Verify (goal-backward)

Re-ask the goal, not the task list:

- Can the operator, from `apps/admin` behind CF-Access, revoke a **real paid** entitlement (the
  fraud/chargeback/ToS case) with **no raw SQL against production** — something admin v1 could not?
- Does a paid revoke respect the **refcount** (an entitlement backed by another active paid source
  survives) and stay **idempotent** with the existing refund webhook (whichever lands second claws
  and revokes nothing new)?
- If credits are clawed (Fork R-1=A), is the amount integer + branded, bounded to
  `granted − alreadyClawed` AND to the wallet balance, and **never negative** (ADR-0007/0212/0113/0218
  intact)?
- Is every paid revoke **dual-logged** (WORM + `admin_action_log`) as a DISTINCT action with the
  real CF-Access actor, and RLS-bounded to one account?
- Is the **edge-staleness window** (a held license token outliving the DB revoke) documented and
  its size bounded by a decided token-TTL policy — not silently "forever"?
- Above all: **did a new ADR lock every fork above BEFORE any of this shipped?** If not — do not
  ship (the founding operator rule).

## Risks

1. **Building without the superseding ADR violates the repo's own binding rule.** Gate all code
   behind the operator-locked ADR-0225.
2. **Edge staleness is the sharpest surprise (Fork R-4).** A DB revoke does NOT cut edge access for
   a held offline token; with `expiry: null` tokens it never does. The operator must decide a paid-
   token TTL, or accept a documented window, or fund the edge-revocation slice (its own SPEC).
3. **Subscription re-grant footgun (Fork R-3).** Revoking a still-billing subscription's grant is
   silently undone by the next `invoice.paid`. The Recommended one-time-only scope avoids it; if B
   is chosen the webhook mapper needs a suspension check.
4. **Clawback on a fungible wallet.** Credits are a pooled balance; the CAISSON-5 remainder bound
   (`creditsClawedForSource`) is what stops a paid revoke from draining OTHER purchases' credits.
   v2 MUST reuse that exact bound, not the raw `granted` amount — a Fable-lane review item.
5. **Chargeback evidence.** The WORM audit half is customer-facing dispute evidence; Fork R-5's
   distinct action type is load-bearing for "prove you revoked THIS transaction for cause".
6. **Mis-targeted paid revoke is customer-harmful** (a paying buyer wrongly stripped). The
   account-existence guard (CAISSON-9) + one-account bound + the Fork R-6 impact preview are the
   layered mitigations; the preview is the highest-value one.
7. **Paddle-write credential (only if Fork R-1=C).** Putting a Paddle refund credential in the
   admin blast radius crosses the doctrine trust boundary (external side-effects → main thread).
   The Recommended R-1=A avoids it entirely.

## ADR interactions

- **ADR-0220** (admin mutation surface v1) — **extends.** Reuses `withAdminWrite`, the dual-log,
  the WORM anchor, `assertAccountExists`, CF-Access gating, and type-to-confirm verbatim; lifts the
  `revokeAdminComp` "comp-only" ceiling by adding a paid-source revoke path. v1's four actions stay
  unchanged.
- **ADR-0113** (refcount revoke/one-time/clawback) — **extends/realizes.** Reuses
  `revokeSubscriptionGrants`/`revokePurchaseGrants`, the refcount survival rule, and the
  bounded-to-balance clawback; realizes part of its "operator revoke" intent for the non-refund
  case. Does NOT resolve its deferred edge revoke-broadcast (Fork R-4).
- **ADR-0218** (per-line partial refund) — **reuses.** The `creditsClawedForSource` /
  purchase-remainder bound (per-line ∪ whole-txn, either delivery order) is the arithmetic a paid
  revoke's clawback must adopt so it stays idempotent with any prior/later partial refund.
- **ADR-0204** (owner gate / CF-Access-JWT) — **reuses/intact.** The admin auth floor and the
  owner posture; no pin weakened.
- **ADR-0074** (feature envelope) — **reuses** if the clawback is recorded under the existing
  envelope; no base `credit_event` type added.
- **ADR-0047 / ADR-0010** (edge Ed25519 license verify) — **context, unchanged.** Explains why a
  DB revoke doesn't reach the edge (Fork R-4); v2 does not modify the Worker unless R-4=B is chosen
  (which is scoped out to its own SPEC).
- **ADR-0007 / ADR-0212** (integer / branded money) — **intact.** Clawback is integer-only, minted
  via `asCredits`, never negative.
- **ADR-0005 / ADR-0052 / ADR-0006** (fail-closed RLS / WORM chain / append-only) — **reused.**
- **ADR-0014** (numbered migrate) — **reused** for the audit-enum extension (Fork R-5=A).

## Effort / Value

**Effort: S–M.** The mechanical pieces (source-scoped revoke, bounded clawback, dual-log, CF-Access
gate, type-to-confirm) are all built and tested — v2 is a thin composition (< 250 LOC) plus one
additive migration, EXCEPT under Fork R-4=B (edge revocation list) or R-1=C (Paddle-write path),
either of which is its own larger slice and should be split out. The seam count (money · license ·
audit · edge) makes it **Fable-lane, SECURITY-blocking, not fan-out**.

**Value: HIGH.** Closes the last raw-SQL-only operator action against the production money/license
rows — the fraud/chargeback/ToS strip-without-refund case — before the first real buyer, with a
tamper-evident + operator-facing audit trail and refund-path idempotency. Strictly gated: no code
ships until ADR-0225 locks the six forks above.
