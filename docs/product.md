# Product

> **2026-09-26 — open-source pivot (ADR-0428).** Caisson is now free and open source under
> Apache-2.0 and nothing is sold. The commercial framing below (editions, bundles, pricing,
> licensing) is historical; the packages remain.

> impeccable strategic doc. Derived from the locked concept specs — `specs/03-design-framework.md`
> (design center), `specs/04-voice-and-brand.md` (voice), ADR-0040 (positioning), ADR-0041 (name
> Caisson). On conflict, those locked specs/ADRs win; this file operationalizes them for design work.

## Register

product

> Co-equal foundation (operator decision 2026-06-27): one token contract serves the marketing site,
> docs, product dashboards/cockpit, AND the shipped `packages/ui` floor every edition app inherits.
> The shared contract holds to the **stricter** (product) register — semantic-first, Restrained,
> accent reserved for action/state. The **marketing site overrides to `brand` per-task** when the
> deliverable is the website itself (brand permissions: distinctiveness, ambitious first-load motion,
> art-direction per section). Identity stays constant across both; only treatment-license changes.

## Users

- **Primary buyer (marketing + docs surfaces):** a technical founder or founding engineer building a
  SaaS that has to pass an audit — SOC2 / HIPAA / SEC 17a-4 / EU AI Act. They evaluate
  production-grade infrastructure the way they read code: skeptically, fast, looking for the
  load-bearing parts a boilerplate skips. They are a peer engineer, not a "customer to be wowed."
- **Buyer's app end-users (shipped `ui` package):** operators of regulated SaaS dashboards — dense,
  data-heavy, keyboard-driven workflows (credit ledgers, audit trails, entitlements).
- **Internal (the design gallery):** the operator, previously using a dedicated design-gallery app
  (retired in the open-source pivot, ADR-0428) to pick, document, and lock the design system — the
  same A/B/C decision-surface pattern proven in Wardfile.

## Product Purpose

Caisson is a compliance-grade infrastructure library (composable base + five module families + a generator).
The design system exists to make every Caisson surface **read as production-grade, not as a marketing
template** — because for this buyer, looking trustworthy IS a feature claim. The token contract gives
two things at once: coherence across marketing/docs/dashboards/editions, and re-skinnability for
buyers (re-theme = swap tokens, never fork components). Success: a developer lands on the site and
asks "how was this built?", not "which AI made this?" — and the studio lets the operator lock each
foundational decision with evidence, once, append-only.

## Brand Personality

Three words: **engineered · exact · load-bearing**. Full adjective set (from `specs/04` §7):
load-bearing, fail-closed, evidence-forward, exact, calm, dense, pro-tool, dark. The metaphor is the
name — a caisson is the watertight foundation sunk under pressure so the structure above holds under
load. Voice leans on _foundation / load / pressure / holds_; never explains the word. Confidence
through understatement and precision, not volume. No exclamation marks in a hero, no emoji.

## Anti-references

- **Happy-path boilerplate SaaS** (auth + Stripe + gradient hero, nothing load-bearing under audit) —
  the named enemy (ADR-0040). The site must not look like the thing it replaces.
- **Cream / sand / editorial-magazine AI default** — the warm-neutral body + display-serif-italic +
  ruled-column look. Wrong register entirely.
- **Generic neon-green "terminal-dark devtool" sameness** — dark-mode is locked identity (specs/03),
  but undifferentiated obsidian-plus-bright-green is the _second-order_ slop lane. Differentiate via
  the caisson concept (cold steel + depth + one instrument light) + real evidence, not via the theme.
- **Revenue-screenshot / metric-flex energy**, hero-metric template, identical icon-card grids,
  per-section uppercase eyebrows. Show the artifact (CI badge, RLS test, audit chain), not the brag.

## Design Principles

1. **Practice what you preach.** The site and studio are themselves a reference implementation of the
   rigor Caisson sells — real CI badges, real RLS tests, real audit artifacts on the page. The market
   gap is that nobody publishes test/OWASP results; Caisson does.
2. **Evidence over adjectives.** The artifact is the headline. A control + its clause + the signed
   evidence pack beats any "powerful / seamless / enterprise-grade" sentence.
3. **Earned confidence (restraint with intent).** Calm, dense, fast. Restraint here is a POV, not
   timidity — every element load-bearing, none decorative-by-reflex.
4. **Identity from concept, not category.** Palette, type, and copy derive from the caisson metaphor
   (foundation / load / pressure / holds), not from "dev tool → dark + mono" reflex.
5. **Accessibility is credibility.** A brand selling fail-closed rigor cannot ship inaccessible
   surfaces. AA is the floor, status is never color-alone (glyph + label), focus is always visible.

## Accessibility & Inclusion

WCAG 2.2 **AA** floor (operator decision): body text ≥4.5:1, large/UI ≥3:1, placeholder ≥4.5:1.
Visible focus ring on every interactive element. `prefers-reduced-motion` honored on every animation
(crossfade/instant alternative). Status and meaning never conveyed by color alone — pair with a glyph
and a label (the Wardfile functional-token discipline). Verify with tooling, not eyes.
