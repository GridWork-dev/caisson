# ADR-0269 — Developer plan covers owned entitlements: subscription-sourced re-grants lift the per-entitlement updates + snapshot gates while active

**Status:** accepted · 2026-07-06 (hygiene-package-standards session; the DIRECTION was
operator-locked 2026-07-06 — "the Developer plan should actually grant updates, not have its
copy walked back" — with the grant SHAPE delegated to this ADR's recommendation, per the
session kickoff `outputs/kickoffs/hygiene-package-standards.md` §T5). **Extends** ADR-0255
(per-entitlement `updatesWindows` — this ADR implements its "subscription-sourced entitlements
carry NO window entry" rule at the `(account, entitlement)` pair level), ADR-0251 (windows +
renewal SKUs), ADR-0247 F7 / ADR-0257 §1.2 (`entitledSince` member snapshots), ADR-0089/0071
(plan book / purchased-ids contract), ADR-0113 (grant refcount + subscription revoke).
**Numbering note:** filed at the post-#130 ceiling (0268) from the
`chore/hygiene-package-standards` branch; a cross-branch collision renumbers at merge per
ADR-0088. Append-only; supersede with a later ADR, never edit. **Tags:** `billing`.

## Context

The Plans page sells the Developer plan ($499/yr, ADR-0106) with "Framework and module updates
as they ship" and "New-edition access on release", and its FAQ promises "access to new modules
on release" — but `packages/pricebook/src/plans.ts` ships `entitlements: []` (credits only).
Nothing in the billing path makes any of those claims true. The operator locked the direction:
make the plan GRANT what the copy sells; never walk the copy back.

Two per-entitlement gates exist for one-time buyers (both ADR-0255-family, both keyed by
PURCHASED id): the **updates window** (version axis — `publishedAt ≤ updatesWindows[id]` at the
Worker) and the **member snapshot** (member axis — `entitledSince[id]` filters bundle members
that joined later). ADR-0255 already states the subscription posture: "Subscription-sourced
entitlements carry NO window entry — their own `expiry` claim governs." The Compliance-Updates
plan already re-grants `compliance` as a `source_kind:'subscription'` grant
(`apply-billing-event.ts` invoice.paid → `grantEntitlements`).

## Decision

1. **The Developer plan re-grants, as subscription-sourced grants, every entitlement the buyer
   ALREADY OWNS via an active `one_time` grant — on every granting invoice
   (`subscription_create` / `subscription_cycle`), keyed to the Developer subscription.** This
   is the Compliance-Updates mirror made dynamic: same `grantEntitlements` idempotency (a
   renewal re-confirming the same set collapses to the existing rows; a module bought
   mid-cycle joins at the next cycle), same `subscription.canceled` revoke path (ADR-0113 —
   exactly these rows flip, the underlying one_time grants survive by refcount). Plan-book
   shape: a new `coversOwnedEntitlements: boolean` (Zod default `false`) on `planBookEntry`;
   `true` on the developer rows only. Scope is **`one_time`-backed ids only** — never ids
   borrowed from another subscription, never `admin_comp` rows: "already owns" means bought.

2. **The issuer's claim computation drops the `updatesWindows` AND `entitledSince` keys for
   any pair also backed by an ACTIVE subscription grant** (alias-group-tolerant match, the
   `extendUpdatesWindow` W7 convention). This implements ADR-0255's stated rule at the pair
   level: while a subscription backs an entitlement, its access is subscription-sourced — the
   token's own `expiry` governs, no window binds, no member-snapshot filter applies. The
   existing re-mint comparison (ADR-0251 D3 / ADR-0255 D4) already handles the lifecycle: the
   first /issue after the re-grants mints an unbounded claim; the first /issue after
   `subscription.canceled` revokes them re-binds the one_time-derived window — with the lapsed
   time never resurrected (the stored `updates_expires_at` / `granted_at + 12 months` bound is
   untouched by any of this; it merely stops being SIGNED while covered).

3. **"New-edition access on release" is DEFINED as: new releases (versions) of, and new member
   modules joining, the bundles/modules the buyer already owns, while the subscription is
   active** — i.e. exactly the two gate-lifts of Decisions 1+2. It is **NOT** a grant of new
   bundle ids the buyer never bought (rejected: a $499/yr plan handing out future bundles
   would cannibalize the $2,059 Everything bundle and mint a perpetual-grant class ADR-0255
   deliberately avoids). It is never perpetual: cancel → re-grants revoked → gates re-bind.

4. **The Compliance-Updates plan inherits Decision 2's fix for free:** an owner+subscriber
   (compliance bought one_time + the updates subscription) previously kept their
   one_time-derived window key — the subscription never actually lifted the gate it sells.
   With the pair-level drop, "evidence-pack regeneration on every framework revision" and
   "new-framework slots" (member joins) are true while subscribed. No change to its static
   `entitlements: ["compliance"]` row.

Recommended-shape confidence at lock: medium-high (per the kickoff); nothing here was judged
fork-shaped beyond that recommendation — the mechanism reuses ADR-0255's stated semantics and
the shipped Compliance-Updates precedent, and adds no new vocabulary, no new token claim, no
edge change (the Worker/registry-schema filters are untouched; they simply see fewer keys).

## Consequences

- `packages/pricebook/src/plans.ts`: `coversOwnedEntitlements` field (default false; strict
  parse unchanged for existing rows) + `true` on both developer rows (placeholder + live).
- `services/license/src/entitlement-store.ts`: `readOneTimeEntitlements` (the "already owns"
  read) + the subscription-covered key drop in `computeUpdatesWindows` / `computeEntitledSince`.
- `services/license/src/apply-billing-event.ts`: the invoice.paid dynamic re-grant, inside the
  same `withTenant` transaction as the credit grant (commit-or-rollback together).
- The re-granted ids join `grantedEntitlements` (the Discord role push input) — idempotent and
  convergence-friendly, same as the static Compliance-Updates path on a renewal.
- The site Plans copy becomes TRUE on merge (the sibling site session aligns wording; recorded
  in the PR body). The dashboard renewal display (ADR-0257 §4) is unaffected.
- Follow-up inherited, not created: the renewal refund un-extend (ADR-0251 §Consequences)
  stays open; a Developer-plan refund mid-cycle rides `subscription.canceled` semantics.
