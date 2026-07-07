# ADR-0269 — Developer plan covers owned entitlements: subscription-sourced re-grants extend the per-entitlement updates + snapshot gates to the paid coverage horizon while active

**Status:** accepted · 2026-07-06 (hygiene-package-standards session; the DIRECTION was
operator-locked 2026-07-06 — "the Developer plan should actually grant updates, not have its
copy walked back" — with the grant SHAPE delegated to this ADR's recommendation, per the
session kickoff `outputs/kickoffs/hygiene-package-standards.md` §T5. Decisions 2/5/6 were
HARDENED pre-merge by the same session's SHIP security audit — fable, 2026-07-06 — which
found the original key-DROP shape unbounded in perpetual offline tokens; this draft never
landed on `main` in the drop shape, so the hardening is a pre-merge amendment, not a
supersession). **Extends** ADR-0255
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

2. **The issuer's claim computation EXTENDS the `updatesWindows` AND `entitledSince` values —
   never drops the keys — for any pair also backed by an ACTIVE subscription grant carrying a
   coverage horizon** (alias-group-tolerant match, the `extendUpdatesWindow` W7 convention).
   Every granting invoice stamps its subscription grant rows with a horizon of
   `updates_expires_at = now() PLUS one plan cadence` — the instant that payment covers
   through — and each renewal EXTENDS it (GREATEST, monotone; a replay can never shrink it).
   A covered pair's signed bound is the MAX of its own one_time-derived bound and that
   horizon: present, offline-verifiable, and bounded by the LAST PAID period. _Why not the
   original "drop the key" shape:_ one_time buyers' tokens are perpetual (`expiry: null`) and
   the Worker verifies offline treating an absent key as unbounded — a covered token minted
   once would have granted unbounded updates plus an unfiltered member snapshot FOREVER,
   surviving cancel, dunning, and out-of-order webhook replays with no revocation path
   (2026-07-06 audit P1; the same bound also caps the out-of-order
   `invoice.paid`-after-`canceled` race and the Paddle pause-without-cancel dunning hole to
   the period the buyer actually paid for). The stored one_time bound is untouched by any of
   this — once the subscription stops extending horizons, the first re-mint converges the
   pair back to it, with lapsed time never resurrected. A revoked subscription grant row is a
   tombstone on its uniqueness key: a late re-grant can never resurrect it.

3. **"New-edition access on release" is DEFINED as: new releases (versions) of, and new member
   modules joining, the bundles/modules the buyer already owns, while the subscription is
   active** — i.e. exactly the two gate-lifts of Decisions 1+2. It is **NOT** a grant of new
   bundle ids the buyer never bought (rejected: a $499/yr plan handing out future bundles
   would cannibalize the $2,059 Everything bundle and mint a perpetual-grant class ADR-0255
   deliberately avoids). It is never perpetual: cancel → re-grants revoked → gates re-bind.

4. **The Compliance-Updates plan inherits Decision 2's fix for free:** an owner+subscriber
   (compliance bought one_time + the updates subscription) previously kept their
   one_time-derived window key — the subscription never actually lifted the gate it sells.
   With the pair-level horizon fold, "evidence-pack regeneration on every framework revision"
   and "new-framework slots" (member joins) are true while subscribed — bounded by each paid
   period. No change to its static `entitlements: ["compliance"]` row (its rows now carry the
   same horizon stamp; a pre-existing NULL-horizon row lifts nothing until its next renewal
   stamps it).

5. **Coverage mirrors are MARKED and refund-reconciled.** The dynamic re-grants of Decision 1
   carry the sentinel `line_item_id = 'covered'` (never collides with a real `txnitm_…` line;
   keys mirrors separately from a plan's static grant of the same id). Every one_time revoke
   path — the `refund.completed` webhook (whole-transaction AND per-line) and the admin
   `purchase_revoke` action (ADR-0225) — runs `reconcileCoverageGrants` in the same
   transaction: any ACTIVE mirror whose entitlement id no longer has an active one_time
   backing (alias-group-tolerant) is revoked with it. _Why:_ without the sweep, a fully
   refunded product stayed fully accessible subscription-sourced for the life of a $499
   subscription (2026-07-06 audit P1). Static subscription grants are never swept (the
   subscription itself pays for those); refcount holds — a mirror survives while ANY sibling
   purchase still backs its id.

6. **Known bound, accepted:** an out-of-order `invoice.paid` processed after
   `subscription.canceled` can insert a fresh grant row for an id never before granted under
   that subscription (a cancel redelivery is an idempotent no-op and never re-runs the
   revoke). Under Decisions 2+5 its effect is capped at one paid period of horizon-lift for
   ids the buyer anyway owns, and any refund sweeps it — accepted as-is rather than building
   subscription-state tracking into the license service. The same reasoning covers a Paddle
   dunning configuration that pauses instead of cancels: horizons stop extending, coverage
   lapses at the last paid period end. The STATIC-entitlement variant of the ordering race
   (a late first invoice minting a plan's fixed grant after cancel) predates this ADR and
   stays a platform follow-up.

Recommended-shape confidence at lock: medium-high (per the kickoff); nothing here was judged
fork-shaped beyond that recommendation — the mechanism reuses ADR-0255's stated semantics and
the shipped Compliance-Updates precedent, and adds no new vocabulary, no new token claim, no
edge change (the Worker/registry-schema filters are untouched; a covered pair's keys simply
carry a later — horizon-extended — instant while coverage is live).

## Consequences

- `packages/pricebook/src/plans.ts`: `coversOwnedEntitlements` field (default false; strict
  parse unchanged for existing rows) + `true` on both developer rows (placeholder + live).
- `services/license/src/entitlement-store.ts`: `readOneTimeEntitlements` (the "already owns"
  read), `upsertSubscriptionGrants` (horizon stamp + monotone extension + mirror marker),
  `reconcileCoverageGrants` (the refund sweep), and the horizon fold in
  `computeUpdatesWindows` / `computeEntitledSince`. No schema migration: the horizon reuses
  the ADR-0251 `updates_expires_at` column (previously always NULL on subscription rows).
- `services/license/src/apply-billing-event.ts`: the invoice.paid static + dynamic grants ride
  `upsertSubscriptionGrants`, inside the same `withTenant` transaction as the credit grant
  (commit-or-rollback together); both refund branches reconcile. The admin `purchase_revoke`
  (`admin-mutations.ts`) reconciles identically.
- The re-granted ids join `grantedEntitlements` (the Discord role push input) — idempotent and
  convergence-friendly, same as the static Compliance-Updates path on a renewal.
- The site Plans copy becomes TRUE on merge (the sibling site session aligns wording; recorded
  in the PR body). The dashboard renewal display (ADR-0257 §4) is unaffected.
- Follow-up inherited, not created: the renewal refund un-extend (ADR-0251 §Consequences)
  stays open; a Developer-plan refund mid-cycle rides `subscription.canceled` semantics.
