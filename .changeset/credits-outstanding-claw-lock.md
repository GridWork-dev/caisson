---
"@caisson/credits": minor
---

Add `outstandingClaw`, a shared account+purchase-scoped advisory-lock guard around the
`creditsGrantedBySource`/`creditsClawedForSource` read that every purchase-clawback caller now
routes through. Closes a read-then-claw race: two differently-keyed clawback attempts against the
same purchase (a whole-transaction refund, a per-line adjustment, and an operator revoke can all
key differently) could previously each read a stale "already clawed" amount and, once the wallet's
own balance-clamp kicked in, drain an unrelated purchase's unspent credits out of the same fungible
wallet. The lock serializes racing readers so the second always observes the first's committed
claw.
