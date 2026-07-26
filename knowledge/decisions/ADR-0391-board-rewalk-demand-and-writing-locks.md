# ADR-0391 — Board re-walk demand, instrument, and writing locks

- **Date:** 2026-07-26
- **Status:** Accepted (operator-locked)
- **Companion:** ADR-0390 (the four launch-readiness and Blacksmith-cost locks taken the
  same day)
- **Source:** `outputs/audit/2026-07-board/FORK-WALK-PREP.md` decisions D5, D6, D7, D11,
  D13, and D15

## Context

The 2026-07 board re-walk separated six coupled questions: what a discounted design-partner
close proves, how long the current wedge gets to run, which demand instruments produce
independent evidence, when the Article 50 article ships and where it lives, whose buying
process must be interviewed, and when learning and revenue clocks start.

The operator locked all six on 2026-07-26. Two choices — D5 and D7 — were taken plainly
**against the re-walk's own recommendation**. D11's timing followed the re-walk
recommendation, while its later publication-surface choice overrode the separate
recommendation to publish inside the existing compliance-docs collection.

## Decisions

### D5. A discounted design-partner close counts as list-price validation

The commercial ledger treats one close under the first-five design-partner offer as
positive validation of the displayed list price. The offer is 40% off for 12 months:
**$869.40 against the deployed $1,449 Compliance price**, or **$989.40 after the locked
$1,649 price deploys**. Every transaction record must name the then-live anchor it was
measured against.

This is **against the re-walk recommendation**, which had HIGH confidence in maintaining
two ledgers: one for reaction to the list-price anchor and one for conversion under the
discount. The operator exercised the authority to take option 3, chose the single-ledger
interpretation, and rejected both the recommended split and option 2's separate
list-confirmation supplement.

This choice forecloses separating discount sensitivity from list-price acceptance in the
current commercial instrument. There are still no full-price purchases. Any future claim
about full-price elasticity requires a new instrument rather than reinterpretation of this
ledger.

### D6. Run one bounded cycle under the current design-partner thesis

The current wedge gets one bounded commercial cycle. Its binding tripwire is:

> "zero paid partners at day 30 stops further product spend and reopens the wedge or pivot board"

This was chosen over declaring the thesis validated without a tripwire and over pivoting
before the bounded cycle runs. The lock forecloses both indefinite protection of the
current thesis and a pre-evidence pivot.

D5 materially changes the bar: one 40%-off partner sale clears the D6 tripwire. That is
easier than the re-walk assumed when it recommended separate list-reaction and
discounted-conversion ledgers, and the result must be interpreted with that limitation.

### D7. Use three demand instruments, with the buyer map first

The demand program has exactly three instruments, in order:

1. D13's economic-buyer and procurement map.
2. One commercial instrument covering the list-price reaction and discounted close that
   D5 deliberately collapsed.
3. Public developer distribution with its own denominator.

This is **against the re-walk recommendation**, which called for four separate instruments
with HIGH confidence. After D5 collapsed list-price reaction and discounted conversion
into one validation event, keeping four instruments would have represented one commercial
signal twice. The operator rejected both the recommended four-instrument design and a
mixed log without explicit denominators.

This choice forecloses four independent evidence logs and the diagnostic separation those
logs would have provided. It accepts the operating discipline of three logs. The commercial
instrument inherits D5's full-price blind spot; the buyer map and public-developer
distribution remain independently denominated.

### D11. Verify now, publish by 2026-08-01, and create `/writing`

The Article 50 article is verified now and publishes by **2026-08-01**. **2026-08-02 is the
AI Act's legal applicability date under Article 113, not a Caisson publication deadline.**
Factual/legal verification is a mandatory precondition.

The publication surface is a new `/writing` collection inside `apps/site`. The timing
matches the re-walk recommendation. The surface was locked later the same day over the
separate recommended option of one MDX page inside the existing compliance-docs collection,
and over off-site-only publication.

The operator rejected publishing an evergreen explainer after 2026-08-02, skipping the
article, using the existing compliance-docs collection, and publishing only off site. This
forecloses both the later evergreen schedule and reuse of the existing publication surface.
It accepts a six-day drafting, verification, and surface-build window, coupling the article
to a new public collection that does not exist yet. That build owes design, navigation,
schema.org markup, ADR-0079/ADR-0080 SEO-and-copy-law compliance, and an ongoing content
cadence. The `/writing` build remains a separate lane and is not part of ADR-0390's
implementation PR.

### D13. Interview three to five economic buyers and procurement actors

Recruit **three to five economic buyers or procurement actors** before interpreting the
commercial signal. The panel explicitly excludes a developer-only group. Each interview
must capture budget authority, procurement path, self-serve tolerance, and auditor
involvement.

The re-walk's confidence was MEDIUM in this method and NONE in the answer it will produce;
this lock preserves that distinction. The operator rejected folding the questions into the
existing design-partner developer panel and assuming that developer proximity stands in
for economic-buyer access.

This choice forecloses immediate commercial interpretation. Targeted recruiting and
calendar time become prerequisites before any commercial instrument runs, but the resulting
map can distinguish user enthusiasm from purchase authority.

### D15. Run separate learning and revenue clocks

The program has two clocks with separate start conditions:

- The **learning clock** starts after D10 produces four technical receipts. Its instrument
  reaches full exposure through the buyer interviews and five outbound emails.
- The **revenue clock** starts only after auditor acceptance, a real Paddle-to-Mercury
  transaction path, and a written cost-to-serve bar covering support, security, and auditor
  assistance.

The written cost-to-serve bar does not exist today. It is now a gating deliverable, not a
number this ADR invents.

The operator rejected one clock starting only after every prerequisite because it needlessly
delays non-transaction learning. The operator also rejected arming the 30-day revenue clock
now because that forecloses an interpretable null while most prospects cannot buy or be
measured. The chosen path forecloses a single shared date and requires two explicit state
transitions and two sets of dates to keep honest.

## Binding dependency order

Interpretation follows this order:

1. D15 defines the two clocks.
2. D13 names the buyer roles.
3. D5 defines what the discounted close means.
4. D7 constructs the three instruments from those roles and that label.
5. D6 evaluates the bounded thesis only after D7's evidence is available.

The learning clock waits for D10's four technical receipts. The revenue clock waits for
auditor acceptance, the real Paddle/Mercury rails, and the written cost-to-serve bar. A
40%-off close may clear D6, but it does not become evidence of full-price elasticity.

## Consequences

- The six board rows are closed and cite this ADR; no one may silently restore the
  re-walk's D5 or D7 recommendation during execution.
- Demand evidence has explicit roles, denominators, labels, and clock boundaries.
- The current wedge receives one cycle, not indefinite protection, and the tripwire stays
  verbatim.
- Article 50 publication now depends on both verified copy and the separate `/writing`
  surface lane.
- Revenue-clock readiness now has a named missing artifact: the written cost-to-serve bar.

## Not decided here

- Whether the current wedge survives the bounded cycle.
- A full-price elasticity claim or the shape of a future instrument that could support one.
- The buyer-map findings, the cost-to-serve threshold, or any resulting price change.
- The `/writing` information architecture, visual design, schema.org shape, or publishing
  cadence.
- The Article 50 article's final legal/factual conclusions or copy.
