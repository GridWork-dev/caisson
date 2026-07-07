# ADR-0272 — Research-response site wave: evidence, fit, trial framing, transparency + the 12-month-cliff terms rework

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round — all four surfaces +
"Full terms rework now"). Grounded in the Cookiy deep analysis
(`outputs/research/prelaunch-fanout-2026-07/cookiy-deep-analysis-2026-07-07.md`). Append-only;
supersede with a later ADR, never edit. **Tags:** `frontend`, `ui`.

## Context

The 45-transcript deep analysis found the top objection clusters are answerable with surfaces
over assets that already ship: proof artifacts exist but are not surfaced (22/40 demand them;
several call missing docs a non-starter); integration mismatch is where deals die (22/40,
~6 lived walk-aways); trial/sandbox is the volunteered de-risker (~11/40); social proof is
demanded (~31/40) with no owned answer pre-launch; and the 12-month updates cliff is the
largest single cluster (25/40), gating the initial sale, purely a terms/copy problem. All
evidence is synthetic-tier (the human panel never reached the pitch), but every action here is
cheap, reversible, and directionally safe.

## Decision

One site wave (apps/site, copy/surface work only — no new product engineering in this ADR):

1. **Evidence-pack page** — a public surface presenting the already-shipped proof artifacts:
   OSCAL conformance CI, threat models, test coverage, WORM live proofs, the standards-gate.
   (The packaged downloadable artifact is ADR-0275's work, and this page consumes it when it
   lands.)
2. **Stack-fit adapter matrix** — "does it fit my stack" (ORM bridges, auth/BYO providers,
   DB posture, no-hardcoded-infra) on the marketplace/compare surface.
3. **Trial-path emphasis** — surface the create-caisson + deploy-templates flow as the
   "prove fit in week one" path on module/bundle pages (framing now; the eval-license product
   is ADR-0274).
4. **Founder-transparency block** — open Apache Base + public changelog + who-builds-this,
   as the interim social-proof answer (the program is ADR-0273).
5. **Pricing-surface terms rework** — answer "what happens after 12 months?" prominently on
   the pricing page; reframe the Developer plan as security-patch continuity ("your patches
   keep coming; the source is yours forever"); add a support-responsiveness line; surface
   licensing/redistribution clarity at checkout.

## Consequences

- Copy stays inside the ADR-0080 copy laws and the ADR-0237 full-V1-live posture (no roadmap
  framing). Prices render from `pricing.ts` only.
- The wave runs as its own build track with SHIP audits; it queues behind PR #141.
- The quant legs (frame test 776545 · Van Westendorp 445432) may later refine door sub-claims
  and pricing copy — string-level swaps, no structural rework expected.
