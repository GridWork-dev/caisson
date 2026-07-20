# ADR-0372 — Post-release close-out picker: stranded-version prune, dud-tag deletion, pricing memo, audit fix batch

- **Status:** locked
- **Date:** 2026-07-20
- **Fork:** the four open items surfaced at the v2026.07.20.1 wrap (operator picker, one round,
  all four on the recommended option)

## Context

The v2026.07.20.1 release train went green end to end, but the post-release r2-parity probe
(run 29745214071) returned 61 advisory misses byte-identical to the pre-ride set — proving the
misses are structural: every one is a consume-superseded MID-CHAIN version, and the publish leg
stages only the tag tree's CURRENT versions, so no later train can ever upload them (the
ride-after-consume rule's permanent consequence). Alongside it sat the dud v2026.07.20 tag, the
unpriced reserved SKUs from ADR-0371, and three small findings from the compliance-wave SHIP
audits.

## Decisions

1. **Stranded mid-chain versions → version-delist PRUNE** (the ADR-0359 machinery, extended to
   this set). 60 of the 61 delisted in one append-only pass. **Carve-out:** 1
   version — the agent-runtime primitive at 0.3.0 — stays advertised because the CURRENT
   `agentic-dev@0.2.3` and `everything@0.2.5` served rows member-pin it exactly; delisting it
   would dangle those pins (the coverage gate correctly refuses). It delists in a follow-up
   prune after the next consume repoints the bundle member pins to a served version. The
   discovery that current bundle rows can member-pin an R2-404 version is recorded as a real
   (if narrow) buyer-path defect that the next consume heals naturally.
2. **Dud v2026.07.20 tag + GitHub Release → deleted in-session** (operator-authorized at the
   picker; same class as the ADR-0365 dud-tag deletions). One tag per real release.
3. **First-price round for the three reserved SKUs → memo dispatched now** (gw-pricing-analyst;
   competitor/WTP evidence + recommended ranges). The operator still sets every number; the
   reserved ids stay unarmed until then (ADR-0371 unchanged).
4. **SHIP-audit fix batch → build now, one PR:** (a) risk-register collector wording
   distinguishes a treatment plan ON RECORD from a mitigation IN FORCE (golden regen);
   (b) the `framework/next` generator template gets the same loud kernel-pin staleness guard the
   eu-ai-act template has, plus the pin bump; (c) module depth-page standalone prose prices
   derive from the canonical catalog amount instead of literal strings.

## Consequences

- The parity probe converges to green on the delisted set; the single carved-out miss stays a
  known, tracked residual with a named heal trigger (next consume → follow-up prune).
- `append-ledger.test.ts` gains the canonical `version === undefined` module-level delist
  filter — the last known consumer missing the ADR-0359 distinction.
- The template-pin follow-up class (version-pr automation does not ride generator template
  pins) now has both templates guarded loudly rather than one.
