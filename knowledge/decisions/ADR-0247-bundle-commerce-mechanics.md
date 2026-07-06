# ADR-0247 — Bundle commerce mechanics: 25%-off-sum anchor, snapshot-at-sale growing bundles, self-serve upgrade crediting

**Status:** accepted · 2026-07-05 (catalog-rework picker F3/F7/F8, run in the SOT-expansion
session). **Extends** ADR-0137 (below-sum invariant lineage), ADR-0244 (updates window — F7 rides
its mechanics), ADR-0245 (credit policy untouched). Append-only; supersede with a later ADR,
never edit. **Tags:** none at lock; implementation inherits `billing`.

## Decision

1. **F3 = (a):** the bundle discount anchor stays **~25% off the member sum** (the top of the
   market's 10–25% band, already live practice per ADR-0137). The below-sum invariant remains
   binding for every bundle. The break-even framing (option b) was NOT adopted as a pricing rule;
   it may still appear as marketing copy without ADR weight.
2. **F7 = (a) — growing bundles are updates-window-gated, snapshot-at-sale:** a bundle purchase
   entitles the member set **as of sale date**, plus any member-package versions published within
   the buyer's ADR-0244 updates window. Packages ADDED to a bundle later are part of the bundle
   for **new** sales; an existing owner receives an added package only if it enters the bundle
   during their active updates window (initial 12 months or a renewal). Consequence of the
   window mechanics, stated plainly: **an updates renewal DOES deliver later bundle additions**
   during the renewed window — option (b)'s benefit falls out of (a) and belongs in renewal copy.
   Implicit free-forever growth is rejected (contradicts the paid-window model).
3. **F8 = (a) — self-serve upgrade crediting:** upgrading from owned modules/packages to a bundle
   credits `bundle price − sum of owned items' retail` at checkout, floor $0, using a
   pre-declared item×bundle credit map. The map lives in `pricebook` (Paddle has no bundle
   object); the checkout flow reads it, never computes ad-hoc. Unused-days proration and manual
   coupons rejected as the primary path.

## Consequences

- `pricebook` gains the credit map + snapshot metadata (bundle member-set effective dates) at the
  catalog-rework build; the entitlement resolver gains sale-date snapshot awareness.
- Renewal SKUs (ADR-0244) become the single lever for both continued updates AND bundle growth —
  one coherent story for the pricing page.
- All numbers flow from the pricing-revalidation pass (ADR-0246 §Consequences); this ADR locks
  mechanics only.
