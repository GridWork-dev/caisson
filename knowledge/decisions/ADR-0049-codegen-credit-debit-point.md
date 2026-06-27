# ADR-0049 — Codegen credit-debit integration point: debit-before-spend at generation entry

Status: accepted · 2026-06-27 (Wave-0 shared-substrate session, Fork 6. Where a generation meters
a credit, under ADR-0004/0007/0024.)

ADR-0004 fixed that **every generation meters a credit debit**. This ADR fixes _where_ the debit
fires and _where_ the idempotency key comes from, on the already-implemented `packages/credits`
`debit()`.

## Decision

**Debit-before-spend at the generation entry, keyed by a caller-supplied per-generation
`idempotency_key` (UUID).**

- Both `create-caisson` (CLI) and the buyer MCP **mint or accept one `idempotency_key` per
  generation** and call `credits.debit({ accountId, amount, eventType: "codegen_debit",
idempotencyKey })` **inside `withTenant`, BEFORE any file is written**.
- A **short balance returns 402** (`InsufficientCreditsError`) and the transaction rolls back —
  **nothing is written**. A runaway agent loop cannot generate without paying (the market gap is
  exactly missing circuit-breakers).
- A **retried generation with the same `idempotency_key` debits once** — ADR-0024's internal debit
  path (`(account_id, idempotency_key)` partial-unique, 23505 → idempotent success).

## Rejected

- **Debit-after-success** — violates debit-before-spend; a failed/looping generation that already
  wrote files never gets billed. Reject.
- **Record a `generation` row first, debit from an async job/webhook** — splits the atomic debit
  from the act and races the 402 gate. Reject — the debit is synchronous + atomic in the same
  `withTenant` transaction.

## Binding

The codegen debit is synchronous + atomic inside the same `withTenant` transaction, fired **before
any file write**; the idempotency key is a caller-supplied per-generation UUID scoped
`(account_id, idempotency_key)`; a short balance raises `InsufficientCreditsError` (402) with nothing
written; a same-key retry debits once. Wave 0 ships this as the tested `meter.ts` seam
(`meterGeneration`); the full generation drive that consumes it is P5. Evidence: ADR-0024; ADR-0007;
`packages/credits/src/credits.ts`.
