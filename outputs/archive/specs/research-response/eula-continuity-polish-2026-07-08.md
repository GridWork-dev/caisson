# EULA continuity clause — polish pass (2026-07-08)

**Status:** PROPOSED EDITS ONLY — operator approves before any of this touches
`apps/site/app/legal/eula/page.tsx`. Input: `eula-continuity-draft.md` (variant A + N=12, both
LOCKED by ADR-0282 — none of the edits below change variant or N). Reviewer note: the pass was run
in-session (the cross-vendor PAL leg was blocked on OpenRouter credit exhaustion — flagged as an
operator-owed top-up); each edit is a before → after with a one-line rationale, ordered by
importance.

## 1. Bankruptcy: replace "intended to bind" with §365(n) + runs-with language (highest value)

**Where:** a.2 Successors paragraph.

**Before:** "…takes the Software subject to this Section, which is intended to bind Caisson's
successors and to survive Caisson's dissolution."

**After:** "…takes the Software subject to this Section. This Section runs with Caisson's rights
in the Software and binds Caisson's successors and assigns; Caisson shall make any assignment or
transfer of its rights in the Software expressly subject to this Section. The parties intend that
this Agreement is a license of 'intellectual property' as defined in Section 101(35A) of the U.S.
Bankruptcy Code, and that you retain the rights of a licensee under Section 365(n), including the
right to retain and use the Software as delivered."

**Why:** "intended to bind" does not bind a bankruptcy trustee; §365(n) is the actual statutory
protection for licensees when a debtor rejects an IP license, and invoking it expressly is the
standard, costless way to preserve it. This is the single spot where the draft's promise could
fail exactly when it matters.

## 2. Trigger (ii): close the buyer-manufactured trigger on a healthy product

**Where:** a.1 defined term, clause (ii).

**Before:** "(ii) Caisson ceases to make security patches or critical corrective updates for the
Software available to its licensees generally for a continuous period of twelve (12) months, and
no successor has assumed responsibility for doing so;"

**After:** "(ii) for a continuous period of twelve (12) months, Caisson fails to make available to
its licensees generally any security patch or critical corrective update for the Software despite
at least one publicly disclosed vulnerability or defect materially affecting the Software remaining
unremediated during that period, and no successor has assumed responsibility for doing so;"

**Why:** as drafted, a stable product that simply _needed_ no patch for 12 months arguably
satisfies "ceases to make available" — a buyer could claim self-help rights against a healthy
vendor. Conditioning on an unremediated material vulnerability makes the trigger fire only on
actual abandonment. (N stays 12; this narrows what counts, not how long.)

## 3. Tie self-maintenance to delivered versions

**Where:** a.2 additional-rights item 1.

**Before:** "The right to modify, fork, and patch the Software — including for security,
compatibility, and continued operation —"

**After:** "The right to modify, fork, and patch the Software as delivered to you — including for
security, compatibility, and continued operation —"

**Why:** items 2 and 3 both carry the "already delivered" scope and exclusion (e) restates it, but
item 1's bare "the Software" is the one a lawyer would try to read as reaching versions never
delivered. Four words align all three grants.

## 4. Cure semantics: work done during an event survives its cure

**Where:** a.2 additional-rights lead-in.

**Before:** "…effective automatically on and for as long as a Continuity Event subsists, Caisson
additionally grants you…"

**After:** "…effective automatically on and for as long as a Continuity Event subsists, Caisson
additionally grants you… If a Continuity Event is cured (including by a successor's assumption),
the rights in this paragraph terminate prospectively only: modifications made, copies shared, and
hosting established during the Continuity Event remain licensed as exercised."

**Why:** an insolvency proceeding dismissed on day 91+, or a late successor assumption, "cures"
the event — without this sentence, a fork made in good faith during the event is retroactively
unlicensed. Prospective-only termination keeps the vendor-side benefit (self-help ends when
service resumes) without stranding work already done.

## 5. "Affiliates" — verify the defined term exists

**Where:** a.2 additional-rights item 2 ("within your own organization, your affiliates, and
contractors…").

**Check, not an edit:** if the live EULA §1 does not define "Affiliate," either add the standard
definition (an entity controlling, controlled by, or under common control with you) or narrow item
2 to "your own organization and its majority-owned affiliates." An undefined "affiliates" is the
one term in the waiver a procurement lawyer will ask about, and the internal-copies waiver is the
clause's most sensitive grant.

## Not changed (reviewed, fine as-is)

- Trigger (i)/(iii)/(iv) wording, the 90-day windows, and the individual-vs-general lapse guard
  (the draft's own strongest sentence).
- Exclusions (a)–(e) — internally consistent with §5/§10/ADR-0260/ADR-0269; no edit.
- The c.4 consequential edits (survival-list addition, Last-updated bump) — correct.
