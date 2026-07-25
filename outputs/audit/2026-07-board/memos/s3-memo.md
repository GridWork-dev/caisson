# S3 memo — Voice of Buyer (Phase 1, caisson board audit 2026-07-23)

Seat: S3 · Engine: CLAUDE · Contract: personas.md shared contract; EVIDENCE-spot-audit
corrections honored (operative Compliance price = $1,449 per ADR-0373; all Study-1 WTP
data read as tested-one-rung-below-current; sufficiency gate E-P1/2 TRIPPED).

We speak only for what real ICP humans actually said in the corpus — Study 1 (n=12,
n=10 heard a real price), Study 2 (n=5 completes, usable n≈2–3), and their screen-outs.
Where the corpus is silent, we say "no buyer has told us." That silence is our most
important finding class.

---

## Key points (5)

### 1. None of us has ever seen the price you are actually charging.

**Claim:** Every price reaction we ever gave was at $1,049; the live Compliance price is
$1,449 (38% higher, ADR-0373, 2026-07-20), and zero buyers have reacted to it — the
warm read at $1,049 ("no-brainer / extremely attractive / sweet spot," 9 of 10
neutral-to-positive) is evidence about a price that no longer exists.
**Tag:** OBSERVED (the reactions and the reprice) · **E-ids:** E-D1, E-D15, E-B2,
spot-audit §5 correction (binding).
One nuance cuts the other way: the only Study-1 dissent (#12, DX/tooling lead) called
$1,049 a credibility-damaging "lowball" against tens-of-thousands/yr GRC anchors — the
reprice moves _toward_ the one objection on record. But that is one voice, and nobody
has confirmed $1,449 lands inside the same acceptance band. Per the binding WTP anchor
gap, Study-1 data may not be cited as validation of the current price — so today the
live price is, from where we sit, untested.

### 2. The thing we all asked for before paying $1,000+ still does not exist.

**Claim:** Third-party proof — testimonials, case studies from regulated verticals, a
working demo — was the single highest-frequency objection across the whole program
("verifiable customer testimonials or case studies from established companies in
healthcare or fintech" before a $1,000 purchase), and the demand ledger confirms none
of it can exist yet: zero customers, zero design partners, zero public repo.
**Tag:** OBSERVED (the objection, three independent analytical passes converge) ·
**E-ids:** E-D5, DEMAND-LEDGER §§1,7, E-B3.
The site's transparency-through-code (real snippets, directory tree, "the repository is
the artifact," E-B3) answers the _technical champion's_ half of the trust map — several
of us do audit code before buying. It does not answer the _economic buyer's_ half:
someone like us, in a regulated vertical, who already paid and passed an audit. Only
design partners can mint that artifact, and (point 5) none has even been contacted.

### 3. You lead with the wrong compliance names for the buyers you interviewed.

**Claim:** Five of twelve Study-1 buyers named GDPR / PCI DSS / ISO 27001 as their
actual regime — none led with HIPAA — and one made it an explicit dealbreaker: _"The
biggest deal breaker would be if it didn't cover, um, either of those [GDPR or PCI
DSS]"_ (#7, UK ERP); the federal buyer (#1) went further — SOC 2/GDPR read as
wrong-audience _overreach_, the credible names are FedRAMP / NIST 800-53 / FISMA,
absent from the copy, and generic "compliance flagship" language is _"marketing
language until proven otherwise."_
**Tag:** OBSERVED (Study 1, n=5/12 direct); the federal grammar is OBSERVED but n=1 —
the source itself forbids treating it as market validation · **E-ids:** E-D4, E-D7,
E-B2/E-B4 (live copy leads SOC 2/HIPAA crosswalks).
Any fix must stay inside ADR-0080's copy law (plumbing, never a compliance guarantee)
— what we asked for is _coverage naming_, not certification claims.

### 4. Nobody has told us what happens in month 13 — and "you own the code" doesn't answer it.

**Claim:** The largest confusion cluster in the qual corpus is not the renewal price
(the 40% ratio drew essentially no pushback) but 12-month-window ambiguity — and both
studies independently converge on its deeper form: ownership ≠ self-sufficiency ("what
protections/support ship with the owned code so you don't need a third party," #5,
Study 2).
**Tag:** OBSERVED (the objection, both studies) · INFERRED (that the live site leaves
it unresolved — E-B2 records "perpetual — no kill switch" and $499–$1,499/yr plans but
no evidence of an explicit support-scope/month-13 answer on the pricing surface) ·
**E-ids:** E-D6, E-D11, E-B2.
Also on record from Study 2: a substitute you should hear verbatim — *"Codex/Claude on
my $100 plan"* (#3) is what $2,059 gets compared against by a below-anchor buyer
(E-D10). The support-scope answer is part of what beats that comparison.

### 5. No buyer has ever been asked to buy — everything you know about us, you paid a research platform for.

**Claim:** The corpus contains zero executed field contact with a real prospect: 0 of 5
drafted design-partner emails confirmed sent, 0 replies, 0 of 5 partner slots signed,
0 confirmed waitlist entries, $0 revenue — every human reaction on file is a paid
research participant, and the funded instrument is CLOSED (Study 2 operator-locked at
n=5, ADR-0352) with usable-n≈2–3 and its two highest-value probes delivered cleanly on
only 2 of 5 sessions.
**Tag:** OBSERVED (explicit zeroes) · **E-ids:** DEMAND-LEDGER §§1,3,7 + summary table,
E-D8, E-D9, E-D15.
Per the sufficiency gate, we add nothing about funnels or conversion — there is no
funnel to observe. What we can say: the "≥5-interview real-ICP round whose guide
reaches the pricing screen" is named in at least four documents as the standing closer,
and it has still never been run at any anchor — let alone the live one. And one thing
no buyer has told us anywhere in the corpus: that they want this cheaper. The recorded
price objections anchor *below* on expectation ($1,000/$1,200, E-D10), while the two
enterprise-anchored voices read the prices as cheap-to-lowball (#1 "surprisingly
cheap" at $2,059; #12's lowball). CONTESTED by sample: n is too small to conclude
either direction — which is precisely the point of the recommendation.

---

## Recommendation (committed)

Put real buyers in front of the real artifact at the real price before any other
GTM motion, and fix the two things we already told you in plain words. Concretely:
(1) send the five drafted design-partner emails this week — the terms exist
(ADR-0297), the drafts exist, and a signed partner is the only machine that can mint
the third-party proof every one of us named as the #1 blocker (E-D5); (2) run the
named-but-never-run ≥5-interview real-ICP round with the pricing screen at the LIVE
anchors ($1,449 / $2,059) — this is not a pricing re-litigation, it is executing
ADR-0304's own first named reopener ("real-ICP anchor reactions"), now urgent because
ADR-0373 moved the anchor 38% above everything ever tested; (3) in parallel, ship the
two copy fixes that are pure listening, not strategy: name GDPR / PCI DSS / ISO 27001
coverage where the copy now leads SOC 2/HIPAA (within ADR-0080's plumbing-not-guarantee
law), and answer the month-13 / support-scope question explicitly on the pricing
surface. We respect the WTP self-warning and the sufficiency gate throughout: nothing
here locks a price or claims demand — every step is the cheapest instrument that
replaces our silence with our voice, and all three fit the 30-day time-to-signal
preference in OPERATOR-CONSTRAINTS.

**Confidence:** HIGH that the five points above are what buyers said and did not say
(they are transcript-grounded or explicit-zero-grounded); MEDIUM on the
recommendation's yield (outreach may not convert — but at 0 sends, even non-response
is new information the corpus currently lacks).

**What would change my mind:** Three or more real ICP buyers giving clean verbatim
reactions to the live $1,449 anchor that land neutral-to-positive (or one signed
design partner at live terms) — that would dissolve point 1's "untested price"
finding and downgrade point 5 from the memo's spine to a closed gap.
