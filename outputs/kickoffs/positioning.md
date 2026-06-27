# KICKOFF — Track 2: Positioning / hero / voice / branding

Paste this as the first message of a fresh Claude session in the `track/positioning` worktree.

---

You are running the **positioning / hero / voice / branding** session for the `stack` monorepo
(working name — your job includes deciding the REAL name). **Read first:** `SUMMARY.md`,
`outputs/research/market-research.md`, `outputs/research/capability-corpus.md`,
`specs/00-product-spec.md` (its positioning is PROVISIONAL), `specs/03-design-framework.md` (the
brand/voice section is deferred — that's this session), `outputs/research/decisions-log.md` (D14).

**This is the de-locked work (D14):** features + architecture are locked; **positioning, hero,
voice, name, and brand are NOT** — decide them here. Do NOT anchor on the "AI production codebase
starter" frame; it was provisional scaffolding only.

## Goal
Choose the **hero positioning across ALL the differentiators** (compliance / local-first AI /
AI-infra / production-rigor — not AI-only), define the **voice**, and decide the **real product
name**. Output: a positioning ADR + a naming ADR + a voice guide, and updates to `specs/00` + `03`.

## Inputs you already have (in outputs/research/)
- The ranked opportunities (`scores.json`): Compliance 8.28 (hero candidate, highest WTP — CPC 10–50×) ·
  AI-infra 7.06 · Local-first 6.70 · Agentic-Dev 6.68.
- Demand data (`demand-signals.md`): compliance carries the budget; generic boilerplate is
  saturated/branded.
- The market scan (`market-findings.json`): competitor positioning + the value-add menu.

## Do
1. **Research** the hero across the differentiators — use `refero-design` (reference research) +
   exa (positioning/naming/competitor messaging). Compare: lead-with-compliance vs
   lead-with-production-rigor vs lead-with-local-first vs an umbrella "production-grade library."
2. **Resolve the market-strategy review gaps** (from `outputs/research/review-findings.json`,
   market-strategy dimension) — these are positioning/GTM decisions:
   - The **compliance-update subscription** is the #1 retention lever — should be its OWN tier with
     its own WTP ceiling ($149–299/mo range), not bundled under codegen credits.
   - **Buyer-filter / ICP firewall** so the generic-competitive base doesn't undercut compliance
     hero pricing (D10 re-included generic — needs a segment story).
   - **EU AI Act Annex IV** (deadline Aug 2 2026) is the most time-sensitive demand signal — a
     positioning hook + a reason to scaffold its control-mapping early.
   - The 4-edition simultaneous launch vs a narrowing story.
3. **Decide:** the hero, the name, the voice (per gridwork-core `identity/voice.md` floor —
   evidence-forward, no AI-slop), the tagline, the ICP segments.
4. **Write:** `knowledge/decisions/ADR-00NN-positioning.md`, `ADR-00NN-product-name.md`, a
   `specs/04-voice-and-brand.md`, and amend `specs/00` §Positioning + `specs/03` §4.

## Rules
Never auto-decide a fork — board options on `docs/state/decisions-and-forks.md` with confidence +
evidence, recommend, and confirm with the operator before locking the name/hero. Doc-only session
(no product code). Atomic conventional commits (`docs(positioning): …`).
