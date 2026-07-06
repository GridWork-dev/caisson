# ADR-0246 — Catalog rework structural locks: full per-package catalog, editions dissolve into bundles, compliance 3-SKU carve

**Status:** accepted · 2026-07-05 (catalog-rework picker, run in the SOT-expansion session against
`outputs/research/catalog-doctrine-2026-07.md` F1/F2/F6; the Kickoff-C tmp-dir session is
superseded — the picker happened here). This round is deliberately a RETHINK: the operator opened
it as brainstorm-class, **not bounded by prior packaging ADRs** — prior ADRs stay in force until
each superseding lock lands, but "we already decided X" is not an argument inside this program.
**Extends** ADR-0227 (the $799 display stands until re-priced); **supersedes ADR-0238's premise
for compliance** (the carve below creates exactly the separable artifacts 0238 said didn't exist);
edition-grant mechanics constraints per ADR-0223 unchanged. Append-only; supersede with a later
ADR, never edit. **Tags:** none at lock (structure policy); the builds it queues inherit
`billing` + `external-system`.

## Decision

1. **F1 = (b), operator override of the curated-display rec:** every commercial package is
   individually priced AND individually displayed on the site. The choice-overload risk the
   research flags (§3.3 "sellable ≠ displayed") is accepted and mitigated at DISPLAY-DESIGN level
   (grouping, filtering, bundle-first merchandising), not by hiding SKUs.
2. **F2 = (b) plus a bundle-set redesign mandate:** editions DISSOLVE into true bundle objects
   over the package catalog. The bundle SET is redesigned from the package library — explicitly
   NOT a 1:1 relabel of the four editions. Candidate bundle sets come out of the in-flight
   brainstorm (`outputs/research/catalog-rework-brainstorm-2026-07.md`) and lock in a follow-up
   picker. **Until that picker locks, the four current editions remain the displayed bundles** —
   no site change rides this ADR.
3. **F6 = 3-SKU carve, formula-priced:** `packages/compliance` carves into three sellable
   surfaces — compliance-core (meta), frameworks-pack (SOC2/HIPAA/EU-AI-Act catalog), and the
   signing primitive (per-tenant Ed25519 + RFC-3161). The compliance bundle price is **derived
   from the F3 discount formula off its member sum** (ADR-0247), not held by fiat; exact SKU
   numbers land in the queued pricing-revalidation research pass. The displayed $799 (ADR-0227)
   stands unchanged until that pass locks numbers.

## Consequences

- **Grant migration** (whole-edition grants → bundle grants) becomes a design work item of the
  catalog-rework SPEC; ADR-0113/0225 revoke/clawback semantics must survive the mapping.
- **Paddle product churn** (per-package products, bundle prices) executes only after the pricing
  pass — no sandbox changes now.
- The queued **pricing-revalidation research pass** (operator-commissioned this round) owns: all
  displayed numbers re-validated, the three compliance SKU prices, per-package price points for
  the newly displayed catalog, and the OSS gate/split pricing questions of ADR-0248.
