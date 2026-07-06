# @caisson/credits

Integer credit wallet + append-only ledger + debit-before-spend (402).

- **Layer:** base

Real src + tests: integer wallet, append-only ledger, 402 debit-before-spend, and an
idempotency index. Also handles clawback: reversing credits on a refund, tracked
per line item so a partial refund only reverses the credits tied to that line.
