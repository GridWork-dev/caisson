# ADR-0251 — Updates-window enforcement: signed `updatesUntil` claim + edge per-version filter; renewal SKUs as one product with per-SKU prices; EULA/checkout copy posture

**Status:** accepted · 2026-07-06 (Kickoff-E picker round 1+2, independent-build-wave session).
**Extends ADR-0244** (the 12-month updates-window policy — this ADR locks its enforcement
mechanics), **ADR-0136/0223** (registry gating + npm delivery — gains a per-version date
predicate), **ADR-0110** (license issuer), **ADR-0113** (entitlement grants). Respects ADR-0010
(offline Ed25519, no phone-home) and ADR-0106 (grandfathering stays operator-owned). Append-only;
supersede with a later ADR, never edit. **Tags:** none at lock (policy/mechanics); the build
inherits `billing`.

## Decision

1. **Enforcement = claim + edge filter.** The license claims schema
   (`packages/license-verify` `licenseClaimsSchema`) gains a signed **`updatesUntil`**
   (ISO instant, nullable). The issuer computes it at `/issue` from DB truth
   (`entitlement_grant.granted_at` baseline + 12 months, extended by renewals — clause 3). The
   registry Worker and the ADR-0223 npm surface enforce it per-version:
   `version.publishedAt <= claims.updatesUntil` filters `/modules/:id`, the npm
   `abbreviatedPackument` **with `dist-tags.latest` recomputed to the newest in-window version**,
   and the tarball route. The offline single-token model is preserved — no second edge artifact.
   Rejected: a Worker-side `licenseId → updatesUntil` map (revocation-list pattern) — retro-editable
   windows are not worth a second TTL-cached fail-permissive edge surface; and a claim+artifact
   hybrid — two mechanisms from day one for a pre-launch product.
2. **Absent claim = unbounded** (verifier + Worker treat a missing `updatesUntil` as no window
   limit). With zero live buyers this is a moot pre-launch grandfather clause, not a loophole;
   post-flip licenses always carry the field.
3. **The idempotent `/issue` path is loosened to re-mint** when the computed window differs from
   the stored token's — a renewal purchase must produce a fresh token, not re-serve the stale one.
4. **Renewal SKUs = ONE "Updates Renewal" Paddle product carrying per-SKU prices** (~one price
   per renewable edition/module; sandbox now, **placeholder cents — Kickoff D owns every number**).
   A new fail-closed `RENEWAL_BOOK` in `packages/pricebook` (`providerPriceId →
{ renewsEntitlement }`); a price id lives in exactly one book. Rejected: a per-SKU renewal
   product family (dashboard sprawl) and extra prices on the original products (couples renewal
   repricing to the original product pages).
5. **A renewal extends the window per `(account_id, entitlement_id)`**: new nullable
   `updates_expires_at` on `entitlement_grant` (additive migration);
   `extendUpdatesWindow` sets `GREATEST(now(), COALESCE(updates_expires_at, granted_at)) +
12 months` on the active grant rows for that pair, **fail-closed on zero rows** (renewing an
   entitlement you don't hold throws; never silently mints a grant). Renewal SKUs grant zero
   credits. Rejected: per-grant-row windows disambiguated via checkout `custom_data` — Paddle
   custom_data is transaction-scoped, and duplicate-purchase ambiguity does not warrant a
   buyer-facing "which purchase" picker.
6. **Copy posture = mixed** across the 7 contradicting spots inventoried 2026-07-06: **fuller
   rewrites** on the two FAQ surfaces (license-page FAQ + procurement FAQ — both feed FAQPage
   JSON-LD); **minimal surgical edits** on the EULA definitions + fees sections, the license-page
   mechanics bullet, and the procurement body copy; the cart trust badge stays terse — "no
   renewal gate" becomes **"no forced renewal"**. All copy says "a reduced rate", never a
   percentage — no Kickoff-D dependency.

## Consequences

- Refund of a renewal ("un-extend") has no handler — flagged as a follow-up branch on
  `refund.completed`, queued in the execution spec, not built silently.
- The `marketplace/(hub)/plans` FAQ gains its renewal Q&A only when Kickoff D sets the
  renewal price point (the one copy spot with a real number dependency).
- Creating the actual sandbox renewal product/prices is an operator-side Paddle-dashboard/API
  act rides the build session main-thread; the code ships book-driven either way.
- **Erratum (2026-07-06, pre-merge, review-caught):** Decision 5's formula as first written used
  `granted_at` (the window START) as the COALESCE fallback — which made a first mid-window renewal
  extend from `now()` and silently drop the buyer's remaining months. The shipped formula uses the
  base window END: `GREATEST(now(), COALESCE(updates_expires_at, granted_at + interval
'12 months')) + interval '12 months'`. Same intent (extend from the current window end or now,
  whichever is later), corrected arithmetic. Relatedly, the npm packument for a fully
  out-of-window module is 404 (indistinguishable from unentitled), not an empty 200.
