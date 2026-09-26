# @caisson-sh/credits — agent usage note

Provides the integer credit wallet: append-only ledger, debit-before-spend gate (returns 402 on insufficient balance), and idempotent transaction keys (ADR-0007/0020).

## Key surface

- **Credits are always integers** — never floats, never `number` where a fractional value could leak through. This is a hard invariant (ADR-0007).
- Debit operations are idempotent: pass a `crypto.randomUUID()` idempotency key per spend attempt.
- Ledger entries are append-only; there is no update/delete path.
- Credit checks run BEFORE the metered operation; a 402 response means the wallet is empty — do not retry without a top-up.
- Runs inside `withTenant` from `@caisson-sh/tenancy-rls`; never query the ledger without a tenant context.
- Clawback reverses credits on a refund; it tracks the join key per line item so a partial refund reverses only the credits tied to that line, not the whole order.
- Two entry points: `.` is the full node-capable surface; `./browser` is the pure half only — the event vocabulary and `planFifoDebit` (`src/fifo.ts`), the FIFO waterfall `debit()` walks. The wallet/ledger writes never join `./browser`. A module joins it only if its whole value-import graph passes the static source-graph walk in `src/browser-safety.test.ts` (a bundler proves nothing — it substitutes a polyfill for a node builtin and exits 0), and every `./browser` name must also exist on `.`.

## Scope

Credit accounting only. Billing top-ups arrive as `DomainBillingEvent` jobs; this package processes the ledger side of those events.
