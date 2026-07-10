# ADR-0304 — D3 anchor level: hold Compliance $1,049 / Everything $2,059

**Status:** accepted · 2026-07-10 (operator-locked, Kickoff-J pricing picker). Append-only;
supersede with a later ADR, never edit. **Tags:** `pricing`.

## Context

ADR-0297 held the D2/D3 bundle price levels for the Cookiy quant data. The quant panel proved
off-ICP (62–68% role "Other") — it can never validate the anchor at any fill — so the picker
ran on qual(final) + frame-test + ladder per the Kickoff-J charter, with the WTP memo
(`outputs/research/wtp-memo-2026-07-10.md`) as the decision input. Evidence summary (memo F1):

- Qual: zero price resistance in 40 synthetic reactions; every volunteered build-cost proxy
  (3–6 engineer-months, ~$15k) sits far above $1,049; latent too-cheap-to-trust skepticism —
  the binding constraint is proof + terms, not level.
- Quant ladder (directional, off-ICP): 58% rate $1,049 fair-or-would-consider when shown the
  rung (69% at $649, 46% at $1,499) — presentation dominates gut pricing; supports anchoring
  against build cost on-page, not a cut.
- Comparables: ceiling comps $1,276–1,499 carry commodity feature sets; zero comps ship
  WORM/field-crypto/OSCAL. Fresh counter-pressure: AuditKit.dev live at $99–999/mo
  subscription on the compliance wedge (crawled 2026-07-09) — a reason not to raise, not a
  reason to cut (different motion: rent vs own).
- The memo's explicit caveat: headroom-above evidence is synthetic-only — never raise on it.

## Decision

**Hold Compliance at $1,049 and Everything at $2,059.** No change to any other bundle price.
This is a "don't touch it on this evidence" lock, not a "this is the proven number" lock — no
real ICP buyer has yet reacted to either anchor.

## Consequences

- The committed price matrix (`docs/gtm/pricing-packaging.md`, `apps/site/lib/pricing.ts`)
  stands unchanged; no Paddle work.
- The design-partner 40% composition table stands (partner Compliance $629.40 — the near-miss
  with list Local-first $629 remains; see the WTP memo F5 flag).
- Named reopeners: (1) real-ICP anchor reactions from the Cookiy live-interview study
  (019f4a11, 12 recruits launched this sitting) or design-partner conversations; (2) a live
  checkout funnel naming price as the drop-off; (3) a code-ownership competitor undercutting
  at parity.
- The CLAUDE.md "Still open: pricing FINAL adjustments" line narrows: the anchor question is
  decided on current evidence; display forks stay closed (ADR-0082).
