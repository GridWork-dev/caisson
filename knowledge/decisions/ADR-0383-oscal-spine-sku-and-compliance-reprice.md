# ADR-0383 — `oscal-spine` priced at $249, folded into Compliance, bundle repriced to $1,649

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked, same-sitting successor to ADR-0382 lock 3)
- **Parent:** ADR-0382 lock 3 (which locked the direction and explicitly owed this number) ·
  ADR-0364 F3 (the "extend in place, no new SKU" lock this supersedes on the SKU question) ·
  ADR-0381 lock 2 (whose $1,449 hold this supersedes) · ADR-0258 (bundle final numbers) ·
  ADR-0257 (bundle vocabulary + membership snapshot)

## Context

ADR-0382 lock 3 locked that the OSCAL axis becomes a priced SKU and deliberately deferred the
number, the package carve, and the catalog change to a successor rather than leaving a blank in an
append-only record. This is that successor.

The axis shipped as PR #278 (`d233afe0`): mapping data and a vendored NIST catalog in
`frameworks-pack`, generator and drift-check in `compliance-core`. It has no package boundary today,
and every `SKU_RETAIL` key in this catalog is a package.

## Decisions

### 1. `oscal-spine` lists at **$249**

Matching `frameworks-pack`, the package it is carved out of and whose fifth crosswalk axis it
literally is (ADR-0364 F2, the verbatim NIST IR 8278A OLIR vocabulary). Pricing the extracted half
below its parent would imply the OSCAL axis is the lesser one; pricing it at the top of the range
would be hard to defend against the $249 sibling. Operator pick, matching the recommendation.

For reference, the 2026-07-20 compliance-gap round landed at $149 (`trust-page`), $199
(`access-review`), and $279 (`risk-register`).

### 2. It joins the Compliance bundle's `members`

Consistent with every other compliance SKU — all ten current members are compliance capabilities,
and a compliance bundle that omits the OSCAL export would be a worse story than the price is worth.
Membership carries a join date in `BUNDLE_MEMBERSHIP_BOOK`, so the ADR-0257 snapshot filter handles
grandfathering without special-casing; with zero buyers nothing is retroactive either way.

### 3. Compliance is repriced **$1,449 → $1,649**

This **supersedes ADR-0381 lock 2's hold at $1,449.** Operator pick, overriding the recommendation
to fold the SKU in at the frozen price.

The number follows the convention already in force rather than being chosen freely. Compliance sits
at 70.0% of its member subtotal today ($1,449 of $2,070), and ADR-0381 recorded the earlier
1049 → 1449 move as holding "the same below-sum band." The enlarged subtotal is $2,319, so the band
lands at ~$1,623; $1,649 is the nearest figure in the catalog's committed X49 form, at 71.1%. The
alternative X49 figure, $1,599, sits at 68.9% — further from the standing ratio.

The below-sum invariant (`upgrades.test.ts`: bundle retail < Σ member retail) holds with room:
$1,649 < $2,319.

## Consequences

This is the largest surface of the three 2026-07-25 locks, and unlike the other two it cannot land
incrementally: the price-authority gate (`f6122de8`) fails on a catalog where the pricebook and the
display sheet disagree, so every price surface moves in one change or none does. Scoped as a
dedicated wave, tracked in `docs/state/outstanding-work.md`.

Ordered, because each step gates the next:

1. **Carve `@caisson/oscal-spine`** out of `frameworks-pack` (mapping data + vendored catalog) and
   `compliance-core` (generator + drift-check), with its own manifest, license classification,
   `tooling/` conformance, and changeset. Nothing else can reference the SKU until the package
   exists — `SKU_RETAIL` keys are packages, and the standards and registry-index gates enforce it.
2. **Pricebook:** `SKU_RETAIL["oscal-spine"] = 249`, a `BUNDLE_MEMBERSHIP_BOOK.compliance` entry at
   this date's constant, and `BUNDLE_RETAIL.compliance = 1649`.
3. **Catalog:** production recreation moves from **35 products / 66 prices** to 36 / 68, in
   `tools/paddle-catalog-recreate.ts` and every gate and runbook that asserts the count — the launch
   runbook's Act 6 plan among them.
4. **Registry:** regenerate `packages/cli/registry-index.json`; the index count moves with it.
5. **Price surfaces:** ~10 files carry $1,449 outside append-only history — `apps/site/lib/pricing.ts`
   and its tests, `build-vs-buy`, `nav-panels`, `packages/compliance/manifest.ts`,
   `packages/demo-registry`, and the license/site test fixtures.
6. **Answering services:** `services/docs` pricing corpus and the support bot must answer $1,649.
   The launch runbook probes both, and Act 1 asserts the old number today.
7. **State docs:** `docs/state/{package-catalog,production-readiness,outstanding-work}.md`,
   `docs/build-state.md`, `docs/ops/{launch-runbook,operator-walkthrough}.md`.

**The copy freeze is narrowed, not broken.** ADR-0380's freeze covers site copy generally; a price
the operator has repriced is a factual correction to a committed number, not a copy rewrite. No
other marketing prose moves with it.

**Deployed services carry the old number until they are redeployed.** Docs-RAG and the support bot
answer $1,449 from their live deployments, so the price change is not complete at merge — it
completes at the fleet deploy, which is behind the operator's external-system hold. Until then the
runbook's "docs/support must answer $1,449" probe is the correct assertion for the deployed fleet
and the wrong one for the repository; the wave updates the runbook to the new number and the probe
becomes a post-deploy check.

**Not started in this sitting.** Four branches are already open (`feature/full-state-completion`,
`feature/completion-lane-a`, `feature/module-depth-pages`, `feature/paddle-onboarding-setup`), and
ADR-0328 calls a reconcile at two or more. This wave is larger than either open lane and touches the
money seam that both the license service and the site read, so it gets its own lane after the
reconcile rather than a fifth concurrent branch.

## Not decided here

- Whether the OSCAL package is Apache-2.0 (open Base) or commercial. `frameworks-pack` and
  `compliance-core` are both commercial, so commercial is the inherited default, but the carve
  should confirm it against the ADR-0094 open-core boundary rather than assume it.
- Renewal-SKU pricing for the new module. `RENEWAL_BOOK` carries a row per updates-renewable SKU;
  whether $249 implies the standard renewal tenor and price is a catalog-wave detail.
