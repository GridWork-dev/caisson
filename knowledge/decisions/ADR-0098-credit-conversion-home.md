# ADR-0098 — The credit denomination lives in @caisson/kernel (resolves ADR-0089 SD-3)

Status: accepted · 2026-06-29 (operator lock, picker) · resolves the **SD-3** open sub-decision left
operator-owned by ADR-0089 (`outputs/specs/billing-x2/DESIGN.md §6`). Amends nothing; refines the
ADR-0089 binding "exactly one definition of the denomination exists across the codebase" by naming the
home. Implemented in the same change (code-wiring **B1**).

## Context

ADR-0089 created `@caisson/pricebook` (the commerce price-book) and required that its `centsToCredits`
grant path and `@caisson/ai-meter`'s per-ai-call cost path share **one** credit denomination — the
integer unit `1 credit = 1000 micro-USD = $0.001` (`microUsdPerCredit: 1000`) — with **exactly one
definition** so the two books can never drift. It deliberately left **where** that one definition lives
(SD-3) to the operator: (a) move it to `@caisson/kernel` (recommended), or (b) own it in
`@caisson/pricebook` and have `ai-meter` import it.

The constant lived in `ai-meter` (`packages/ai-meter/src/pricebook.ts`,
`DEFAULT_CREDIT_CONVERSION`). `ai-meter` is an **edition-tier** member (commercial, P3 AI-Kit) and
`pricebook` is a **base** package; ADR-0003 forbids a base package depending "up" on an edition, so
`pricebook` cannot import the constant from `ai-meter`. The shared home therefore must sit at or below
both consumers in the dependency tower.

## Decision

**The credit denomination moves to `@caisson/kernel`** — the base-of-base every package already depends
on. `packages/kernel/src/credit-conversion.ts` owns `CREDIT_CONVERSION`, `creditConversionSchema`,
`CreditConversion`, `parseCreditConversion`, and `centsToCredits` (round-**down** for a grant — never
over-grant). Both `@caisson/ai-meter` (cost path, rounds up) and `@caisson/pricebook` (commerce path,
rounds down) import it. `ai-meter`'s local `DEFAULT_CREDIT_CONVERSION` is deleted and re-exported from
kernel under the canonical name `CREDIT_CONVERSION`, so exactly **one** definition exists.

Rationale (operator-picked, recommendation A, high confidence): kernel is already a runtime dependency
of both consumers, so this adds **zero** new dependency edges; kernel already owns the credit-adjacent
error model (`InsufficientCreditsError`); both consumers import strictly **down** (no ADR-0003
violation, no open↔commercial up-dep — kernel is open/Apache-2.0 and a legal dep for any package).

## Rejected

- **Own the denomination in `@caisson/pricebook`** (SD-3 alt) — viable (ai-meter would import down from
  pricebook) but adds a new `ai-meter → pricebook` edge and puts a money constant in a commercial
  package that the open kernel arguably should anchor. kernel is the lower, dependency-free home.
- **Leave it in `ai-meter` + have pricebook import it** — illegal: `pricebook` (base) would depend "up"
  on `ai-meter` (edition), violating ADR-0003.
- **Two definitions (one per book)** — violates the ADR-0089 binding; the two unit-of-account values
  could silently drift, mis-pricing every grant or charge.

## Binding

- `@caisson/kernel` is the single home of the credit denomination: `CREDIT_CONVERSION`
  (`microUsdPerCredit: 1000`) + `centsToCredits` (round-down grant). Exactly one definition exists
  across the codebase; `ai-meter` and `pricebook` both import it (down-only).
- A re-introduced second definition of the denomination (in any package) is an ADR-0089/0098 violation.
- `centsToCredits` rounds **down** (grant — never over-grant); the ai-meter cost path rounds **up**
  (never under-bill). Integer-only, BigInt internally (ADR-0007/0002).

## Numbering note

Recorded as **ADR-0098** on the code-wiring lineage (the highest ADR on `feat/w1-open-core`/
`feat/w2-migrate` is 0097). The parallel design-marketing track also drafts `0097–0100`; per the
established convention (ADR-0088), whichever track merges **second** renumbers its colliding ADRs
by-meaning at integration. This append-only record stands regardless of the final number.

Evidence: ADR-0089 (§2 + binding, SD-3), ADR-0003 (down-only), ADR-0094/0097 (open-core; kernel is
open). Code: `packages/kernel/src/credit-conversion.ts`, `packages/ai-meter/src/pricebook.ts`
(re-export), `packages/pricebook/src/conversion.ts` (re-export).
