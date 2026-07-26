---
"@caisson/service-license": minor
"@caisson/platform-migrations": minor
"@caisson/pricebook": minor
"@caisson/site": patch
---

Record what a buyer paid for each entitlement, and use it as the floor on an upgrade credit.

An upgrade credit is the retail of each owned item the buyer is trading in. That understates the
credit for anyone who bought before a price cut: they paid more than the item now lists for, and the
old behaviour credited them the lower number. The credit now takes whichever is greater, the item's
retail or what the buyer actually paid.

Paying for that needs the buyer's own price, which was never stored. It has always been on the
provider event, one charge per line, but only the whole transaction's total was persisted, and a
total cannot be split across a multi-item cart afterwards. A new nullable column on the entitlement
grant records the line's charge and currency at grant time.

The amount is recorded only when the line's charge is genuinely one item's price. A line bought at
quantity two charges twice for a single entitlement, and a provider that reports no per-line figure
sends zero. Both leave the column empty, which reads as unknown and credits at retail, rather than
inventing a per-item split.

The quote function takes the paid amounts as an argument, so the pricebook stays free of database
access and the tenant-scoped read stays with the caller. Each one is an amount together with its
currency, never a bare integer: a charge of 29900 is $299 in one currency and roughly twice that in
another, and the two cannot be told apart from the number alone. A charge in a currency the catalog
does not price in credits at retail rather than being converted, because converting it would mean
inventing an exchange rate.
