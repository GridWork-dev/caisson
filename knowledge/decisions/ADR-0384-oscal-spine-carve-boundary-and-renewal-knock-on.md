# ADR-0384 — `oscal-spine` carve boundary, license, and the Compliance renewal knock-on

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked, successor closing ADR-0383's two "Not decided here" items)
- **Parent:** ADR-0383 (the $249 price, Compliance membership, and $1,649 reprice this executes) ·
  ADR-0363/0364 (the spine that shipped as an axis inside two packages) · ADR-0260 §5 (the
  flat-40%-X9 renewal ladder) · ADR-0094 (the open-core boundary) · ADR-0006 (append-only)

## Context

ADR-0383 priced `oscal-spine` and left two questions to its execution wave: the package's license
classification, and whether $249 implies a `RENEWAL_BOOK` row. Scoping the wave surfaced a third
question ADR-0383 did not ask — **where the carve line actually falls** — and one consequence it
did not notice.

`packages/compliance-core/src/index.ts` exports six OSCAL modules, and only one of them is the
spine. `oscal-catalog-export.ts` is the ADR-0363/0364 catalog-model emitter; the other four
(`oscal-export.ts`, `oscal-export-xml.ts`, `oscal-assessment-plan.ts`, `oscal-iso27001-soa.ts`) are
the SAR/POA&M and assessment-plan export that shipped under ADR-0179/0180, long before the spine,
and that `apps/compliance` consumes today via `toOscalBundle`. "Carve the spine out" therefore had
two defensible readings that buy the $249 buyer very different things.

## Decisions

### 1. The whole OSCAL surface moves to `@caisson/oscal-spine`

**Operator pick, overriding the recommendation** to move only the ADR-0363/0364 spine and leave the
pre-existing SAR/POA&M export in `compliance-core`.

Every `oscal-*` module moves into the new package, together with the vendored NIST SP 800-53 rev5
catalog and the OLIR mapping rows currently in `frameworks-pack`. Both parents take
`@caisson/oscal-spine` as a dependency and **re-export it**, so no consumer of either package
breaks — `apps/compliance`'s `toOscalBundle` import keeps resolving, and neither parent needs a
major bump for a removed export.

**The trade this accepts, recorded plainly.** A `compliance-core` buyer pays $299 and receives the
$249 `oscal-spine` package through the re-export; the same is true of `frameworks-pack` at $249.
The standalone SKU therefore addresses a buyer who wants OSCAL expression **without** either
parent's control model or framework packs — it is the cheaper entry point to the OSCAL axis, not an
upsell to existing module buyers. The Compliance bundle lists `oscal-spine` among its members
(ADR-0383 decision 2), so a bundle buyer receives it directly rather than incidentally.

The alternative — a hard carve with no re-export — would have made the $249 SKU exclusive, at the
cost of a breaking change to two shipped commercial packages and a retroactive removal of value
from anyone who bought either. With zero buyers that cost is currently hypothetical, but the
re-export keeps the public API of both parents stable for good, which is the property that outlives
the launch.

### 2. `@caisson/oscal-spine` is `LicenseRef-Caisson-Commercial`

Closes ADR-0383's first "Not decided here" without an operator pick, because the answer is forced
rather than chosen. ADR-0094's open Base substrate is Apache-2.0 **and free**; a $249 SKU cannot sit
inside it. All five sibling compliance packages — `frameworks-pack`, `compliance-core`,
`trust-page`, `access-review`, `risk-register` — carry `LicenseRef-Caisson-Commercial`, and the
standards gate enforces the open↔commercial no-depend-up boundary against exactly this.

The two parents and `oscal-spine` are all module-tier commercial packages, so a parent depending on
the new package is a **sideways** dependency, not a package depending "up" on a bundle (ADR-0003).

### 3. Renewals follow the locked formula — no number is set here

Closes ADR-0383's second "Not decided here", also without an operator pick: there was no number to
set. `renewalAmount` (`apps/site/lib/pricing.ts:421`) already derives every renewal price as a flat
40% of list, floored to the nearest X9 point (ADR-0260 §5), and
`tools/paddle-catalog-recreate.ts` creates the Paddle rows from that same function so display and
charge cannot drift.

- `oscal-spine` renewal = **$99** — `floor(249 × 0.40) = 99`, already an X9 point.
- Standard 1-year tenor. `RENEWAL_BOOK` gains one row; `years` stays unset, which
  `renewalYears()` reads as 1. The multi-year lever stays unarmed (ADR-0251 R6 rider).

**The knock-on ADR-0383 did not notice, now locked.** Repricing Compliance $1,449 → $1,649 moves
its renewal through the same formula: `floor(1649 × 0.40) = 659`, an X9 point, so **the Compliance
renewal goes $579 → $659**. `tools/paddle-catalog-recreate.ts:439` hard-asserts
`renewalCents("compliance") === 57900`; the wave updates it to `65900`.

**Operator pick: let the formula run** (matching the recommendation), over pinning the renewal at
$579 while the list price moved. Pinning would have bought a cheaper renewal on a
just-repriced bundle at the cost of the formula's single-source property — from that point on every
renewal price becomes a hand-maintained number per SKU, and "display and charge never drift" stops
being structurally true and becomes a thing someone has to remember. There are zero buyers, so
nothing is retroactive either way.

## Consequences

- The wave's step 1 (ADR-0383) is now fully specified: a new commercial package holding the whole
  OSCAL surface, with both parents depending on and re-exporting it, and no consumer break.
- `RENEWAL_BOOK` moves 32 → 33 rows. The catalog's 35/66 → 36/68 count (ADR-0383 step 3) is
  confirmed by this: one new product, two new prices — the purchase and the renewal.
- Two money assertions move in the same change as the pricebook: Compliance renewal
  `57900 → 65900`, and the new `oscal-spine` purchase/renewal rows. The price-authority gate keeps
  them consistent or fails.
- Sequencing is unchanged from ADR-0383 and confirmed at this picker: the wave runs **after** the
  reconcile, off a clean `main`, not as a fifth concurrent branch. Ops-level, tracked in
  `docs/state/outstanding-work.md`.

## Not decided here

- Whether `oscal-spine` ever gets a multi-year renewal row. The lever exists and stays unarmed for
  every SKU (ADR-0251 R6); arming it is one operator decision for the whole catalog, not per module.
