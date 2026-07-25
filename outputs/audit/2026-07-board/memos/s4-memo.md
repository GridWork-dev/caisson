# S4 · Positioning Strategist — memorandum (caisson board audit, 2026-07-23)

Scope: category framing, competitive alternatives, wedge integrity. Corpus: EVIDENCE.md + all
indexed section files, DEMAND-LEDGER, OPERATOR-CONSTRAINTS, and the binding spot-audit
corrections; the pinned repo snapshot (`f6df03f9`) was read directly for deployed site copy,
framework coverage, and the comparison surface. No web access — nothing outside the pack and
the snapshot is cited.

## Key points (5)

**1. The locked hero frame (ADR-0040) is corroborated by the corpus — but the site's "against
what" omits the alternative a real buyer actually named: the $100/month DIY agent build.**
Tag: **CORROBORATED** (frame) / **OBSERVED** (the omission). E-ids: E-D3, E-D16, E-B2, E-D10.
The compliance-wedge-under-production-umbrella frame is one of the few things the corpus
actively validates (E-D3's reconciliation: platform-first wins first-screen comprehension,
compliance-first wins the acquisition click; E-D16's CPC/KD data), and the deployed dual-door
hero implements it faithfully (E-B2; repo: `apps/site/components/dual-door-hero.tsx`). But the
positioned alternatives are cheap boilerplates (the "umbrella" copy's ShipFast-class enemy —
which ADR-0040's anti-ICP already refuses to sell to) and GRC SaaS, while the only substitute a
real ICP buyer named in either study was "Codex/Claude on my $100 plan" (E-D10, Study 2 #3) —
the comparison that made $2,059 feel expensive was DIY-with-agents, not a competitor's SKU.

**2. Named contradiction (S4 rule 1): the site's standards grammar is SOC 2/HIPAA-led while
the interviewed buyers named GDPR/PCI DSS/ISO 27001 as their regimes — and the repo already
ships ISO 27001 + NIST 800-53 crosswalks that the Compliance door never names.**
Tag: **CORROBORATED**. E-ids: E-B4, E-D4, E-D7 + repo-observed
(`packages/frameworks-pack/src/crosswalks/regimes.ts` + `nist-800-53.ts`;
`apps/site/app/(marketing)/compliance/page.tsx`).
E-D4 is a verbatim, named dealbreaker (#7: GDPR/PCI DSS, "the biggest deal breaker would be if
it didn't cover either of those"); 5/12 named GDPR/PCI/ISO. The shipped redesign partially
fixed this — "PCI DSS · GDPR crosswalks" is now a chip on the door (repo-verified) — but the
bundle ships five regime crosswalks (soc2, pci-dss, gdpr, iso-27001, nist-800-53) and the door
copy says "ISO 27001" and "NIST 800-53" nowhere (only OSCAL-as-format). The federal buyer
grammar differs entirely (FedRAMP/800-53/FISMA; SOC 2/GDPR read as wrong-audience overreach) —
thin at n=1 (E-D7), so a direction to watch, not a segment bet.

**3. "Code-owned compliance" as a standalone category frame is invented — nobody searches it;
the entry frame must be the one buyers already search ("compliance automation software," $212
CPC / KD 10) walked in on the incumbents' documented expectation gap.**
Tag: **INFERRED** (the synthesis) over **OBSERVED** parts. E-ids: E-D16, E-B5, E-B6, E-D19.
Per S4 rule 2: there is no search behavior for "compliance starter kit / dev-kit" (E-D16: the
compliance SERP is owned by finished platforms — Vanta, Drata, Sprinto, MetricStream, Cynomi —
with zero dev-kits; E-B gaps #3: no vendor sells RLS-as-a-service and there is no demand
reference pool for the developer sub-frame). The door opens on documented incumbent complaints,
not on a new category name: "automation ≠ compliance" (auditor still $10–30K separately),
renewal escalators of 20–40%, coverage collapse from 70–80% to 40–60% on non-standard stacks
(E-B5), and Delve's 494 fabricated SOC 2 reports as the trust-collapse proof point (E-D19).
The RLS-footgun conversation (E-B6) validates the mechanism buyers respect, not a category
they type into a search box.

**4. Every WTP reaction in the corpus was gathered against a $1,049 anchor that no longer
exists — the live $1,449 (ADR-0373, superseding ADR-0304) has zero buyer reactions, and the
only price-credibility signal on record points upward, not down.**
Tag: **CORROBORATED** (the staleness — binding spot-audit correction) / **ASSUMED** (any
conversion claim — sufficiency gate). E-ids: E-D1, E-D14, E-D17 + EVIDENCE-spot-audit §D.
Nine of ten who heard $1,049 reacted neutral-to-strongly-positive; the single dissent (#12)
read it as a credibility-damaging *lowball* against tens-of-thousands GRC anchors — the only
directional price-credibility signal in the program favors holding or raising, not discounting.
The anchored ladder says presentation and anchoring dominate gut pricing (E-D14), and the
external strategy report recommended $2,999–4,999 (E-D17, WEAK tier). Positioning read, not a
pricing call (pricing stays EXPERIMENT-FIRST per the gate): $1,449 must be framed against the
$80k-build / $10K+-per-year GRC comparators (the site already uses "$80k," repo-verified),
never against boilerplates — and its first real test is a named ADR-0304 reopener (real-ICP
anchor reactions), which no instrument has yet delivered (E-D15).

**5. The only dated why-now is the EU AI Act Art. 50 correct-the-rumor window (obligations
apply 2026-08-02 — ten days out), and no frame or copy can fix the corpus's #1 conversion
blocker: zero third-party proof.**
Tag: **OBSERVED** (dates, zeroes) / **INFERRED** (window-closing urgency). E-ids: E-C6, E-D5,
E-B1, E-C1, E-C3 + DEMAND-LEDGER.
E-C6: the EC's own Art. 50 guidelines landed 2026-07-20, the date is confirmed unmoved, and a
"delayed to 2027" rumor is live and debunked — correcting it is the sharper hook, but copy
must not overclaim (one marking obligation has a Dec-2026 grace; spot-audit; ADR-0080 copy law
applies throughout). Meanwhile the frame is being crowded at speed: Sentrik closed most of the
positioning gap in nine days (E-C1), and AuditKit already _leads its homepage_ with the Delve
scandal that Caisson deploys as a mid-page argument (E-C3; Caisson's own use is repo-verified
on /compliance and /compare/delve). E-D5 + DEMAND-LEDGER bound everything above: 0 design
partners, 0 testimonials, 0 social mentions (E-B1) — third-party proof is the top-ranked
objection in the program and it is a proof problem, not a messaging problem.

## Recommendation (committed)

Keep ADR-0040's two-layer frame and reposition the Compliance door explicitly against the
**rented-evidence GRC subscription — the Vanta/Drata/Secureframe class (quote-only $10K+/yr,
20–40% renewal escalators, the "automation ≠ compliance" expectation gap, post-Delve trust
collapse: E-B5 / E-C8 / E-D19)** — with the **DIY agent build (E-D10's "$100 plan")** named and
defeated on the page as the secondary alternative: agents can write controls, they cannot make
evidence byte-deterministic, WORM-anchored, or independently verifiable by an auditor.
**Category frame: compliance automation you own** — entered through the searched GRC-alternative
frame (E-D16), never standing alone as an invented "dev-kit" category; the EU AI Act
correct-the-rumor hook (E-C6) runs before 2026-08-02 without overclaiming the grace nuance.
**One-line value claim (ADR-0080-safe): "The technical controls an audit checks for —
fail-closed RLS, WORM-anchored evidence, a byte-deterministic audit chain — as code you own and
your auditor verifies without trusting any vendor, at a one-time price under a single quarter of
a GRC subscription year."** Concrete surface moves, all copy-level (no redesign — ADR-0378 is
shipped and the hero file itself marks the door sub-claims string-swappable): (a) name the
shipped ISO 27001 + NIST 800-53 crosswalks on the Compliance door (point 2 — the product is
ahead of its own copy); (b) extend the comparison set — the snapshot ships 20 `/compare/*`
pages including vanta/drata/secureframe/delve/auditkit/comp-ai but nothing for Sentrik, Probo,
or the DIY-agent alternative (the DEMAND-LEDGER's "comparison program not built" note is stale
against this snapshot); (c) keep $1,449 anchored against the build-cost and GRC-subscription
comparators and treat the first design-partner price reactions as the ADR-0304-named reopener,
experiment-first per the gate. Deliberately not done here: no re-price (sufficiency gate), no
hero re-frame (ADR-0040 stands), and no claim that copy fixes conversion — the proof deficit
(E-D5) is closed by signing design partners under ADR-0297, not by adjectives.

## Confidence

**Medium.** The frame-keep, the named-alternative correction, and the standards-grammar fix rest
on STRONG/MODERATE corpus tiers plus live-verified competitor items and direct repo reads.
Everything conversion-flavored is sufficiency-gated to ASSUMED; Study 2's usable-n is 2–3 with
its mandatory probes mostly unexecuted (E-D8/E-D9); all Study-1 WTP sits one rung below the live
price; and eight baseline competitor rows were not re-verified this cycle (E-C12). High
confidence is not available at this evidence base.

## What would change my mind

One observable condition: **the first real buyer conversations reject the named-alternative
set.** Concretely — if ≥3 of the first 5 design-partner replies/calls from the ADR-0297 motion
(currently 0 confirmed sent per DEMAND-LEDGER), or the corpus's own named closer (a fresh
properly-screened ICP round, n≥5, per E-D15), say the thing they would actually spend against is
neither the GRC subscription nor the DIY-agent build but "a compliance consultant/auditor
relationship" or "nothing — we defer this until forced," then the incumbent-complaint wedge is
wrong and I would re-frame around the AI-spend-governance door (E-B7/E-B8), where the category
conversation is already practitioner-led and the complaint is fresh.
