---
status: locked
locked_by: ADR-0371
tags: [product, data]
date: 2026-07-20
---

# SPEC — General risk register

**Goal.** Generalize the shipped EU-AI-Act-scoped risk register into a framework-agnostic
register with likelihood/impact scoring. Binding guardrail: every field is either computed from
evidence or a WORM-attested decision — a bare freeform CRUD table is the category's failure mode.

**SKU posture (ADR-0371):** NEW catalog module on a **reserved id** (sold-unpublished pattern) —
not sellable, not displayed, until the pricing round arms it.

## Scope

1. Generalized schema: `riskId, subject, likelihood, impact, residual (computed, never
freeform), treatmentPlan, owner, evidenceDigest` — same shape discipline as the crosswalk's
   `verification` object.
2. Residual = likelihood × impact, computed. **An operator override is a WORM-logged exception
   record** (who/why/when, chained) — never a plain audit row, never a freeform edit.
3. Framework-agnostic; crosswalkable into any shipped framework pack via the `crosswalk[]`
   pointer pattern.
4. Evidence-pack export: a risk-treatment-plan artifact.
5. **EU-AI-Act collector REFACTORS onto this schema** (ADR-0371, operator override of the
   keep-separate rec): `ai-risk-register.ts` becomes an instance of the generalized model.
   Golden-file regeneration rides the build; the EU-AI-Act crosswalk pointers must survive, and
   the golden diffs get a dedicated review pass at SHIP.

## Non-goals

- No probabilistic/ML-inferred inputs. No general risk-management SaaS features beyond the
  existing `alerting` port.

## Verification

- Residual is derived in every path (attempting a freeform residual write is a type error).
- Override test: exception record chains and verifies; the computed value remains recoverable.
- Refactor regression: regenerated EU-AI-Act goldens reviewed row-by-row; crosswalk pointers
  byte-stable where content is unchanged.
