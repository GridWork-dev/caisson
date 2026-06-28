# ADR-0080 — Copy & messaging expansion: per-surface laws over the specs/04 voice floor

**Status:** accepted · 2026-06-27 (Design·Brand·SEO·Copy session — operator "lock all copy as
recommended"). **Extends:** specs/04 (voice & brand — the floor, unchanged). **Relates:** ADR-0040
(positioning/firewall), ADR-0041 (name/metaphor), ADR-0087→0081 (pricing display). Evidence: `FORK-BOARD.md`
(copy forks C1–C26 + critic), research `current-state-copy.md` · `exa-competitor-compliance.md`.

specs/04 fixed the voice floor (evidence over adjectives, pro-tool register, banned list, the locked
tagline + hero H1). This ADR adds the **per-surface messaging laws** for the expanded site (home / 4
editions / pricing / programmatic pages). The floor is unchanged; this is additive.

## 1. Register

**Dev-kit-noun + code-promise**, never platform-verb. **Banish "platform"** (5 of 6 competitors say it — a
direct category collision) and **"automate compliance"** (Secureframe's owned phrase); use
**library / codebase / substrate / kit**. Leading the fold with a real fail-closed denial is more
differentiated than the platform pack. (C1, C3)

## 2. Proof strategy (zero customers)

Lead with **code-as-proof + coverage tiles** — the diff, a failing→passing golden test, a control→clause
map, `verifyChain` output, and the real counts (frameworks / controls / packages / tests). A **CI
green-checks proof strip** ("6/6 checks green: build·lint·unit·integration·standards-gate·golden-file",
ADR-0016) + a **claim strip** of verifiable artifacts substitute for the logo wall a pre-launch product
can't have. On AI-Kit, show the **failing eval gate** too. **Vary the proof types** — not every section a
terminal transcript (the copy side of visual hierarchy). A **named founder/engineer note now**,
design-partner quotes at beta; never fake stars or borrowed logos. (C5, C12, C13, C22)

## 3. Honesty laws (compliance = trust)

State the **technical-vs-administrative boundary** plainly and bindingly: Caisson ships the **technical
controls**; org controls (HR/vendor/IR) and the audit **remain yours** — never imply Caisson is itself
SOC 2/HIPAA certified; it **generates the evidence**. On the programmatic framework pages, a **precise-scope
guardrail**: "Caisson ships the technical controls CC6.x/CC7.2 require" — never "Caisson makes you SOC 2
compliant" (over-claim is a trust **and** YMYL legal risk). This governs all cert/medallion copy. (C6, C25)

## 4. Metaphor & differentiators

Use the caisson **sensation** — load-bearing, watertight under audit, holds under load — **never explain the
word** (ADR-0041). Add the sharpest incumbent contrast to /compliance: **"A scanner is a smoke detector.
Caisson is the fail-closed construction."** Show the real **retrofit figures** on /compliance ("SOC 2 from
scratch: $80k, 6–9 months. RLS + WORM + audit-chain retrofit into a live DB: months more. Both, wired on day
one."), keeping the plain "costs months" line on home for altitude. Add compact **control+clause tags** (SOC 2
CC6.1 · HIPAA §164.312(a)(1)) to the home evidence cards. (C7, C10, C11, C19, C9)

## 5. Conversion copy

- **CTA standardized by edition tier**, all routing to the waitlist (no checkout — ADR-0087/0081): paid
  editions → "Request early access" + ghost "Read the docs"; free AGPL flank → "Star on GitHub" + "Read the
  docs"; roadmap → "Join the list"; programmatic pages → intent-matched ("See how Caisson maps to
  {framework}"). (C14)
- **Pricing** now shows **indicative placeholder numbers** (ADR-0081) with a persistent **"indicative —
  final pricing set before launch"** line so the numbers read as honest-deferral, not a finished commit, and
  not an unfinished page. Keep "Own the code, or subscribe." + the why-subscribe sharpening ("Regulations
  don't hold still — Compliance Updates keeps the control mappings current."). (C15, C16, C17)
- **Resolve the Local-first AGPL contradiction** to one truth before launch: if the repo is public, drop the
  waitlist on that page and go GitHub/docs-led ("fork it today"); if pre-release, soften to "AGPL at launch"
  and keep the waitlist — never both. Verify the `/docs/local-first` + repo targets exist. (C18)
- **Tighten edition H1s to ≤7 words** (AI-Kit runs 8) and **add the Agentic-Dev hero its missing CTA**. (C2)
- **Consent microcopy** under the email field ("We'll only email you about early access. No spam — see
  Privacy.") linking the privacy page, and a **post-signup expectation** success state ("Check your inbox to
  confirm. We'll email when Compliance opens — roughly once, not a drip."). (C23-consent, C24)

## 6. Consistency & persona

- **Owned-vocabulary glossary** (fail-closed, load-bearing, audit-ready, evidence pack, holds under load) used
  consistently + a **competitor-term ban** (scanner, detective control, lifetime updates, "make $") except in
  explicit contrast. (C24)
- **Answer-first / FAQ blocks** on docs/guide/edition/framework pages (40–60-word openings; AI-citation lift;
  pre-empts the procurement questionnaire). (C23)
- **Ratify the 2-tier header pattern** (mono eyebrow label + sentence H2) into specs/04 §5 — the de-facto
  system. Run one **copy-consistency pass**: align "Local-first AI" (nav says "Local-first"), make the
  waitlist success message edition-specific via the existing `source` prop, expand the thin per-edition OG
  descriptions, adapt the "[claim]. Available today." signature for pre-launch ("Shipping to early access."),
  standardize the early-access verb, and pick one pending glyph (`○` vs `◷`). (C20, C26)
- **Persona paths:** developers primary (the buyer is the builder, ADR-0040 ICP-1) **+ a budget-holder /
  CISO procurement section** restating the technical-vs-administrative boundary, with a contact/procurement
  route distinct from the dev waitlist. (C8, C25)

## Rejected

Platform-verb register; "automate compliance"; scale/logo proof (impossible pre-launch); implying Caisson is
certified (false + legally fraught); naming competitors negatively (category-error bait); repeating the
"$199 kits" footnote on every page (drifts toward the banned comparison energy — keep it once on /pricing,
A/B one home one-shot); manufacturing FAQs purely for schema.

## Binding

Extends specs/04 (the floor stays). The banned list is unchanged and **expanded** with the competitor-coded
terms. The generic-base footnote stays **once, never a table** (ADR-0040 firewall). Precise-scope on
framework pages is **non-negotiable** ("flag, never guess"). Implementation lands in the **build session**;
specs/04 is amended in this session to carry §6/§9 updates.
