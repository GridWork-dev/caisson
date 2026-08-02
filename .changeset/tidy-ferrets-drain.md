---
"@caisson/credits": minor
"@caisson/site": patch
---

Credits gains a browser-safe `./browser` entry point: the grant and debit event vocabulary and
`planFifoDebit`, the FIFO waterfall the wallet's own `debit()` walks, can now be imported inside a
client bundle. Given a list of grant remainders and an amount it returns which grant each credit
comes off, plus how much the remainders cover and how much they fall short. It reads and writes no
wallet, so nothing that touches a database or a tenant connection is on the new entry: `grant`,
`debit`, `clawback`, the balance and ledger reads, the expiry sweeps, and the schema SQL all stay
on the main entry, which is unchanged and still carries every browser-entry export. Credit amounts
are integers as before and no wallet, ledger, or 402 behavior changes: the server now calls the
same shared waterfall instead of its own copy, so a balance or a shortfall shown by a client is the
one a real debit computes. The site's credits interactive demo runs that shared logic directly
instead of a hand-maintained copy. The planner validates every supplied remainder before doing
money arithmetic, so malformed or fractional values fail closed instead of poisoning the reported
coverage, while drained and negative lines contribute no draw.
