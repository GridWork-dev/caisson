# ADR-0244 — Perpetual-license updates window: 12 months included, renewal for continued updates

**Status:** accepted · 2026-07-05 (Kickoff-A picker round, SOT-expansion session). Closes research
gap #1 (`outputs/research/monorepo-bigpicture-2026-07.md` §2 row 1): the one-time offer implied an
unbounded free-updates commitment by default. **Extends ADR-0095** (offer structure) and
**ADR-0106** (final pricing + grandfathering); constrains the checkout/EULA copy that ships at the
checkout flip. Append-only; supersede with a later ADR, never edit. **Tags:** none at lock
(policy); the checkout-flip implementation inherits `billing`.

## Decision

1. **Every one-time purchase (edition or module) is perpetual-use**: the versions you are entitled
   to keep working forever — offline Ed25519 verification, no phone-home (unchanged).
2. **12 months of updates included** from purchase date: the license entitles registry pulls of
   any entitled-package version published within `[purchase, purchase + 12 months]`, plus
   everything already pulled. AG-Grid-pattern evidence: scoped perpetual + renewal builds a
   recurring floor; Tailwind Plus's unbounded lifetime model collected all LTV on day one and
   left no floor (−80% from peak when traffic cratered).
3. **Optional updates renewal at ~40% of then-current list** for another 12 months of updates.
   Exact per-SKU cents are set at the checkout-flip session within a 35–50% band (clean price
   points); the POLICY — window + renewal — is what this ADR locks and the pricing page may state
   today. Non-renewal is never punitive: the license keeps working on everything already entitled.
4. **Subscriptions are untouched**: an active subscription includes updates while active
   (inherent); this window governs one-time purchases only.
5. **Timing law:** this policy MUST be in checkout + EULA copy before the checkout flip.
   Rejected alternatives: unbounded free updates (the named failure mode); major-version boundary
   (majors are rare for a continuously-hardened library → unbounded in practice).

## Consequences

- **Registry entitlement semantics**: the license/entitlement resolver and the Worker/registry
  gating (ADR-0136/0223) gain a version-publish-date window check at the checkout-flip build —
  named here, not built now. Grandfathering of pre-flip buyers follows ADR-0106 (operator-owned).
- `docs/gtm/pricing-packaging.md` documents the window as part of the offer; EULA + checkout +
  pricing-page copy carry it before the flip.
- The updates-renewal SKU family (per-edition/per-module renewal products in Paddle) is created
  at the checkout-flip session, not before.
