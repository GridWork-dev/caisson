# @caisson/credits — agent usage note

Provides the integer credit wallet: append-only ledger, debit-before-spend gate (returns 402 on insufficient balance), and idempotent transaction keys (ADR-0007/0020).

## Key surface

- **Credits are always integers** — never floats, never `number` where a fractional value could leak through. This is a hard invariant (ADR-0007).
- Debit operations are idempotent: pass a `crypto.randomUUID()` idempotency key per spend attempt.
- Ledger entries are append-only; there is no update/delete path.
- Credit checks run BEFORE the metered operation; a 402 response means the wallet is empty — do not retry without a top-up.
- Runs inside `withTenant` from `@caisson/tenancy-rls`; never query the ledger without a tenant context.
- Clawback reverses credits on a refund; it tracks the join key per line item so a partial refund reverses only the credits tied to that line, not the whole order.

## Scope

Credit accounting only. Billing top-ups arrive as `DomainBillingEvent` jobs; this package processes the ledger side of those events.
