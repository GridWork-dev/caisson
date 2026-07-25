# T3 · Product-Craft Critic — memorandum (2026-07-23)

Walkthrough basis: scraped copy (E-B2/E-B3/E-B4) cross-read against the deployed source at
`caisson-audit-ro` @ `f6df03f9` (`apps/site/app/(marketing)/page.tsx`, `components/dual-door-hero.tsx`,
`components/cart-view.tsx`, `components/cart-checkout-panel.tsx`, `app/(marketing)/partners/page.tsx`,
`app/(marketing)/login/page.tsx`). Persona for every verdict: a skeptical first-time ICP visitor with
90 seconds. Per the E-I2 correction, the ADR-0378 site is critiqued as final.

## Key points

**1. The site's two terminal conversion actions both dead-end for a real visitor today, on a page
that is now publicly reachable.** — OBSERVED — E-B2 (spot-audit correction: CF-Access gate no longer
up), DEMAND-LEDGER §0/§3/§7.
The hero and the "Get started" section both present `bunx @caisson-sh/cli@latest` as the first
action (`dual-door-hero.tsx:119-121`, `page.tsx:658-665`) — but no `@caisson-sh/*` package has ever
been published (DEMAND-LEDGER §3: "0 — never published"), so the first command every technical
champion runs **fails**. Downstream, "Checkout" routes to `/dashboard/cart` behind a login gate and a
Paddle overlay that is sandbox-only with no live processor (DEMAND-LEDGER §7); the button renders
"Checkout unavailable" or opens a non-production checkout (`cart-checkout-panel.tsx:175-183`). This
is maximally damaging _because of_ the site's own trust strategy: a page whose spine is "Every claim
is a check in CI" and "no diagrams standing in for behaviour" (E-B3) hands the skeptical visitor a
falsifiable claim as its very first interaction — and it falsifies. ADR-0082/0237's own floor is
"artifacts true-to-built"; with the gate down, the install line and the pay button are the two
artifacts currently violating that floor.

**2. The lead door's price footnote now implies buyer validation the corpus says does not exist at
this number.** — OBSERVED — spot-audit §D binding correction; E-D1, E-D15; ADR-0373 vs ADR-0304.
The homepage sign-off footnote reads: "buyers we interviewed put the in-house build of the Compliance
bundle's foundations at four to eight engineering-weeks. $1,449, one-time, against that build"
(`page.tsx:375-380`). The attribution is ADR-0080-clean, but the juxtaposition invites the reader to
believe interviewed buyers weighed *this* price — every Study-1 reaction was gathered at $1,049, 38%
below the live anchor, and the spot-audit binds all personas to treat $1,049 data as
tested-one-rung-below-current. No copy change to the number is mine to recommend (pricing is not my
seat); the craft defect is the footnote's implied evidential pairing, which a diligent buyer who later
reads the research (or a design partner who's shown it) can catch as a stretch on a site that
promises "claims are scraped and dated, never invented" (`partners/page.tsx:39`).

**3. Message-match with the transcripts is mostly genuinely good — the two residual misses are the
buyers' single biggest objection cluster and one named regime.** — CORROBORATED — E-B2/E-B3 against
E-D4, E-D5, E-D6, E-D11.
The redesign demonstrably answered the corpus: the hero door claim now carries "mapped to SOC 2 and
HIPAA with PCI DSS and GDPR crosswalk exports" (answering E-D4's verbatim dealbreaker from #7);
"No logo wall yet. Here's what you can check instead" (`page.tsx:576-578`) is the honest concrete
answer to E-D5's #1 blocker; "support is included: a real person on email and Discord" plus the
continuity-terms footnote answer E-D11's "who supports me after I own the code." Two misses at the
concrete level: (a) **ISO 27001** — named by the E-D4 cohort alongside GDPR/PCI — appears only on
module depth pages, never in the hero-level crosswalk sentence; (b) E-D6's largest objection cluster
("what happens after month 12") is answered well — but only on `/marketplace/plans` (FAQ "What
happens after 12 months?", `plans/page.tsx:63,205`), three clicks deep; the homepage footnote
answers _perpetuity_ ("no phone-home, no kill switch"), which is the adjacent question, not the
updates-window question the buyers actually asked. The confused persona is Study-1's #11 — the buyer
who accepted the renewal ratio but wanted the month-13 mechanics spelled out before trusting it.

**4. The homepage spends its clarity budget on catalog taxonomy: four chooser surfaces compete on
one scroll before a first-time visitor resolves a single decision.** — INFERRED — E-D3, E-D8, plus
the observed page structure.
The scroll runs: two doors → "Module, bundle, or plan: same catalog, three shapes" → six bundle
cards → a SKU matrix → a "Pick a path" decision band — four distinct decision surfaces. The
tell is the lede sentence "Every price on this site now carries one of three labels"
(`page.tsx:258`): that is the site explaining its own labeling system — governance language pointed
inward, not buyer language. E-D3 says the platform frame won on _clarity_ (71.4% vs 47.7% "clear"),
not appeal — clarity is the scarce resource for this audience — and E-D8's #4 (the non-technical PM
who never achieved product comprehension) is the persona who hits "three shapes" plus "six bundles"
plus "pick a path" and bounces without ever reaching the one decision the page wants: open the
Compliance bundle. The doors and the decision band are both persona-routers; one of them is
redundant with the other on the same page.

**5. The site's only self-serve proof-generating engine terminates in a bare mailto that no traffic
has ever been sent toward.** — OBSERVED — DEMAND-LEDGER §1; E-D5.
`/partners` is well-crafted (terms honest, scarcity real per ADR-0297, case-study conditionality
clearly stated) and it is the page that manufactures the E-D5 trust artifact the whole site is
missing. Its CTA is `mailto:support@caisson.sh` (`partners/page.tsx:213`) — no form, no capture, no
instrumentation of intent — and the ledger records 5 drafted outreach emails, 0 sent, 0 replies.
Concrete craft point, not a GTM verdict: a mailto CTA loses every visitor whose mail client isn't
wired (a majority of first-visit browser sessions), and it is the one CTA on the site with no
analytics event, so even if the page works the corpus will never see it working.

## Recommendation

Hold every act of buying or seeding traffic behind a three-item, site-level readiness bar, in this
order: (1) make the first command true — either the npm flip lands or the hero/get-started install
line changes to an action that executes today (the current line is the single fastest way to lose a
technical champion inside the 90-second window, and it sits at the top of both the hero and the
closing section); (2) make the pay path resolve — live Paddle behind "Pay now," and until then the
gated-launch state should be expressed by the _reachability_ of the site (restore the access gate),
never by a dead button on a public page, because ADR-0082/0237's full-live posture is only honest
while the artifacts are true-to-built; (3) close the three copy-level message-match gaps that need
no new evidence: add ISO 27001 to the hero crosswalk sentence, surface the month-13 answer (one
sentence + link) next to the homepage perpetuity footnote, and replace the `/partners` mailto with an
instrumented form or at minimum a tracked click. Separately, re-cut the homepage's middle: fold the
"Pick a path" decision band and the "three shapes" section into one chooser surface, and rewrite the
"Every price on this site now carries one of three labels" lede in buyer language. None of this
waits on research, partners, or pricing decisions; all of it is executable this week against the
already-shipped ADR-0378 page structure.

**Confidence:** high on points 1, 2, 5 (direct source + ledger observation); medium on 3–4 (the
transcript base is n≈10–14 real reactions and the page-structure claim is inference from it).

**What would change my mind:** a session-replay or funnel read (PostHog, post-gate-down) showing ≥5
real non-operator visitors traversing hero → compliance → cart without bouncing at the install line
or the checkout gate — that would demote points 1 and 4 from launch-blocking friction to theoretical
friction, and I would re-rank the memo around the message-match residuals instead.
