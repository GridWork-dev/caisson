# @caisson/pricebook — agent contract

The single **commerce** price-book (ADR-0089, provider rename ADR-0108): which provider (Paddle)
subscription grants how many credits per cycle, the flat per-action credit cost, and the shared
cents→credits GRANT conversion. Commercial base package. Distinct from `@caisson/ai-meter`'s
per-ai-call COST book — this is the COMMERCE grant table.

## What it does

The credit grant must answer two questions deterministically: which plan does a paid cycle map to,
and how many credits does it grant. This package owns both tables and the unit they share:

1. **plan-book** (`PLAN_BOOK`, keyed by `providerPriceId`) — `{ planTag, creditsPerCycle, cadence,
entitlements }`. EXACT integer credits per cycle, never derived from the charged amount (ADR-0089
   §5). `entitlements` is the PURCHASED IDS the plan grants (edition names / the `bundle` sentinel /
   à-la-carte module ids), NEVER the expanded member-slug leaf set — the registry index expands those
   at gate time (ADR-0071); a credits-only plan carries `[]`. `resolvePlan` is fail-closed: an unknown
   price id THROWS (never a guessed grant, ADR-0089 §6).
2. **action-book** (`ACTION_BOOK`) — flat per-action credit cost (e.g. `codegenRunCredits`). The
   per-ai-call cost is NOT here — that stays computed from token usage by `@caisson/ai-meter`.
3. **conversion** — re-exports the ONE credit denomination + `centsToCredits` (round-DOWN grant) from
   `@caisson/kernel` (ADR-0098). Exactly one definition of the unit exists across the codebase.

## Public API

| Symbol                                        | Use                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `PLAN_BOOK` / `resolvePlan(id)`               | Provider price id → plan entry (incl. `entitlements` purchased ids); unknown id throws (fail-closed). |
| `planBookEntrySchema` / `parsePlanBook`       | Strict-validate a plan-book override at a boundary.                                                   |
| `ACTION_BOOK` / `resolveActionCost(tag)`      | Action tag → integer credit cost (closed union; unknown tag throws).                                  |
| `actionBookSchema` / `parseActionBook`        | Strict-validate an action-book override at a boundary.                                                |
| `CREDIT_CONVERSION` / `centsToCredits(cents)` | The credit denomination + cents→credits round-DOWN grant (re-export from kernel).                     |
| `PRICEBOOK_VERSION`                           | Append-only version stamp — a row change bumps it, never edits in place.                              |

## Invariants

- **Integer-only** (ADR-0007): credits/money are integer units, never floats. BigInt internally.
- **Fail-closed**: `resolvePlan` / `resolveActionCost` throw on an unknown key (own-property checked,
  prototype-safe) — a plan launched without a row grants NOTHING, never a guessed amount (ADR-0089 §6).
- **Append-only + versioned** (ADR-0006/0012): a price change bumps `PRICEBOOK_VERSION`, never edits a
  row in place — a buyer pins the version bought on (grandfathering).
- **One denomination**: the credit unit lives in `@caisson/kernel` (ADR-0098); this package re-exports
  it. A second definition anywhere is an ADR-0089/0098 violation.
- **Down-only** (ADR-0003): depends only on `@caisson/kernel`, never "up" on an edition.

> The credit **numbers** are operator-owned and deferred (SD-6/ADR-0012). The shipped plan/action rows
> are clearly-marked **placeholders** (`price_…PLACEHOLDER` keys); the operator replaces them with real
> Paddle price ids + the final locked amounts when checkout goes live (ADR-0108).
