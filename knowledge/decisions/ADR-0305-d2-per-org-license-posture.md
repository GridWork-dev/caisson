# ADR-0305 — D2 resolved: licensing is already per-organization; no seat concept exists — surface it as advantage copy

**Status:** accepted · 2026-07-10 (operator-locked, Kickoff-J pricing picker, corrected
mid-round after the operator's clarifying question). Append-only; supersede with a later ADR,
never edit. **Tags:** `pricing`.

## Context

The D2 fork asked "seat allowance at Local-first $629 / AI-Production $739, or counter-copy?"
— but the fork's premise was wrong. The shipped EULA (`apps/site/app/legal/eula/page.tsx`
§Entitlement) already reads: _"Entitlement is per purchasing entity… may be used by personnel
you authorize to work on Your Products."_ **There is no seat concept in Caisson's license at
all** — every bundle is per-org with unlimited authorized personnel. The SYNTHESIS §2
"single-seat bundles" framing (repeated in the WTP memo F2) mischaracterized the license; it
described the pricing PAGE's silence, not the terms.

Verified fresh 2026-07-10: competitor "seats" = developer access to the vendor's repo/updates
(Supastarter Solo $349 = 1 seat, Startup $799 = 5 seats, Agency $1,499 = 10 seats). Caisson at
$629/$739 per-org-unlimited is therefore MORE generous than the $799 five-seat tier — the
market-shape "mismatch" is actually an unstated advantage.

## Decision

**Affirm the per-org, no-seat license as the posture (no packaging change — none is possible;
the EULA already grants it) and surface it as explicit advantage copy:** a line on the bundle
pages / pricing surfaces stating "licensed per organization — your whole team works with the
code, no per-seat pricing," positioned against the category's 5-seat tiers. The copy line
rides the CAISSON-75/77 copy pass (next site sitting).

D2 closes. The "seat allowance" option is void — there is nothing to allow; the license
already exceeds it.

## Consequences

- No entitlement/EULA engineering ever contemplated again under this fork; the
  licensing-ambiguity veto surface stays untouched.
- SYNTHESIS §2 and WTP memo F2 are hereby corrected for posterity: read "single-seat" there
  as "seat-silent display," not as a license term.
- The live interview study (019f4a11) tests the corrected framing — whether per-org-unlimited
  registers as an advantage against per-seat alternatives (guide question updated; one early
  interview may carry the stale premise — discount its seat answer).
- Reopener: none needed on licensing; if real buyers say per-org isn't legible or credible,
  that's a copy iteration, not a terms fork.
