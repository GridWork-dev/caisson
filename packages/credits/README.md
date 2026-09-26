# @caisson-sh/credits

Integer credit wallet + append-only ledger + debit-before-spend (402).

- **Layer:** base

Real src + tests: integer wallet, append-only ledger, 402 debit-before-spend, and an
idempotency index. Also handles clawback: reversing credits on a refund, tracked
per line item so a partial refund only reverses the credits tied to that line.

## Entry points

- `.` — the full surface: `grant`, `debit`, `clawback`, the balance and ledger reads, the expiry
  sweeps, and the schema SQL. Every one of these takes a `@caisson-sh/tenancy-rls` `TenantExecutor`
  and runs inside `withTenant`; node-capable.
- `./browser` — the pure half, safe inside a client bundle: the grant/debit event vocabulary and
  `planFifoDebit`, the FIFO waterfall `debit()` itself walks (given grant remainders and an
  amount, it returns the per-grant draws plus the covered/shortfall split, and decides nothing
  about the database). No wallet is read or written from this entry. Every name on `./browser` is
  also on `.`.
