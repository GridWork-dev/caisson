---
"@caisson/service-license": patch
"@caisson/platform-migrations": patch
---

Partial refunds now reduce what a purchase counts as paid.

The amount recorded against a purchase was stamped once and never revisited, so after a partial
refund an upgrade quote could still credit the full original charge. Refunded amounts are now
tracked alongside the original charge, and the paid figure an upgrade credit reads is the two
netted together, floored at zero. The original charge itself is never rewritten, so the record of
what was billed stays intact.

Receiving the same refund notification more than once no longer counts it twice. Each refund is
recorded against the adjustment that caused it, so a repeated delivery is ignored while two
genuinely separate partial refunds on the same line both apply.

A purchase whose amount could not be attributed to a single item continues to be treated as
unknown rather than as zero, and still credits at the full list price.

Adds one database migration. Existing rows are unaffected until a refund is recorded against them.
