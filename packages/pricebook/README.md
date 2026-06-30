# @caisson/pricebook

The single **commerce** price-book (ADR-0089). Commercial base package.

- **plan-book** — `providerPriceId → { planTag, creditsPerCycle, cadence }`. Exact integer credits per
  cycle, never derived from the charged amount. `resolvePlan` is fail-closed (unknown id throws).
- **action-book** — flat per-action credit cost (e.g. `codegenRunCredits`). The per-ai-call cost is
  **not** here — that stays computed from token usage by `@caisson/ai-meter` (ADR-0060).
- **conversion** — re-exports the one credit denomination + `centsToCredits` (round-DOWN grant) from
  `@caisson/kernel` (ADR-0098). Exactly one definition of the unit exists across the codebase.

Versioned (`PRICEBOOK_VERSION`, append-only — a price change bumps the stamp, never edits a row).
Integer-only (ADR-0007). Depends only on `@caisson/kernel` (down-only, ADR-0003).

> The credit **numbers** are operator-owned and deferred (SD-6/ADR-0012). The shipped plan/action rows
> are clearly-marked **placeholders**; the operator replaces them with real Paddle price ids + final
> amounts when checkout goes live (ADR-0108 — provider switched from Stripe to Paddle).
