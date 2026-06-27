# Design Framework — Concept Spec

**Status:** spec-committed (Gate 4); brand/voice locked in the positioning session 2026-06-27 (§4). **Scope:** (a) the visual system for Caisson's own
surfaces (marketing, docs, dashboard, cockpit); (b) the **design-token floor shipped in the
`ui` package** that every edition's reference app inherits. Brand floor per gridwork-core
`identity/design-system.md`; research-first per the `refero-design`/`impeccable` skills before build.

## 1. Design center

A **dark, technical, pro-tool aesthetic** — the buyer is a developer/founder evaluating
production-grade infrastructure; the design must _read as_ production-grade, not a marketing
template. Reference lineage: tessera's "Pigment" vanilla-extract pro-tool floor (the harvestable
design seed), Linear/Vercel/Resend-class developer-product polish. Anti-AI-slop: no generic
gradient-hero SaaS template look; dense, fast, keyboard-friendly, evidence-forward.

## 2. The `ui` package (the shipped token floor)

- **vanilla-extract typed token contract** (← tessera): color/space/type/radius/elevation as
  typed tokens, not ad-hoc CSS. One light + one dark theme; tokens are the contract every
  edition app themes against.
- **Primitives:** the headless+styled component set every reference app uses (buttons, forms,
  tables, command palette, data-dense lists). Ships as a buyer value-add (component library).
- **Why a contract, not a kit:** editions must look coherent while letting buyers re-skin; a
  typed token contract gives both (re-theme = swap tokens, not fork components).

## 3. Caisson's own surfaces

- **Marketing site:** differentiator-forward (compliance / AI-production / local-first as the
  three pillars), with the generic-base as the "and it's a better base than ShipFast" footnote.
  Evidence-forward (real code, real CI badges, real compliance artifacts — the market gap was
  "nobody publishes test/OWASP results"; we do).
- **Docs (Mintlify or self-host Starlight + RAG):** AI-native, `llms.txt`, agent-readable; the
  setup-guide spine of the core loop. Decision deferred to build (ADR placeholder).
- **Dashboard + cockpit:** data-dense, the credit ledger + generation history + entitlements
  front-and-center; the pro-tool token floor applied.

## 4. Brand + voice — LOCKED (positioning session 2026-06-27)

- **Name, positioning, hero, voice, and tagline are locked** → `specs/04-voice-and-brand.md` (full
  guide) · ADR-0013 (positioning) · ADR-0014 (name **Caisson**). Hero = the **Compliance wedge
  under a production-rigor umbrella**; tagline **"Compliance-grade infrastructure for regulated
  SaaS."**; hero H1 **"Fail-closed by construction."**
- The marketing site is **differentiator-forward, compliance-led**: compliance hero first, then the
  AI-production / local-first / agentic editions framed as "the same rigor, adjacent problem"; the
  generic base is a one-line footnote, **never** a comparison table (ADR-0013 buyer firewall).
  Evidence-forward — real code, CI badges, real compliance artifacts (the market gap: nobody
  publishes test/OWASP results; Caisson does).
- Floor unchanged: gridwork-core `identity/voice.md` + the `refero-design` → `impeccable` flow; no
  AI-slop. The **dark pro-tool design center + typed token-contract** (§1–2) are engineering
  decisions, separable and already fixed.

## 5. Deferred

The full design system (component inventory, motion, the marketing-site art direction) is a
**design-kickoff** under the `refero-design` → `impeccable` flow, post-Gate-4. This spec fixes
the token-contract approach + the dark pro-tool design center, not the pixels.
