---
"@caisson/billing": minor
"@caisson/billing-orchestration": minor
"@caisson/email": minor
"@caisson/service-license": patch
"@caisson/admin": patch
---

Your license now arrives on its own. After a purchase or a subscription renewal, your
license is issued and stored automatically — no more waiting on support to run it by hand.
Your purchase receipt now includes it directly when it's ready.

Payment notification retries are now handled cleanly. If your payment provider redelivers a
notification for a transaction that already went through, you will no longer see a duplicate
receipt email, and a subscription's included-updates window can no longer be nudged forward by
a retry that carries no new charge.

If a subscription is canceled or a purchase is refunded and it actually removes something you
had access to, you'll now get a short email saying so, instead of finding out only by noticing
it missing from your dashboard.

If your one-time purchase's included-updates window is about to lapse, you'll now get an
advance notice by email, the same way you already do for expiring credits.

A card dispute (chargeback) on your account no longer triggers any automatic change to your
access — an operator reviews it and reaches out before anything changes.

On the admin side, the process that publishes revoked-license information to the edge is now
ordered correctly when two revokes happen close together, closing a narrow window where the
older of the two could have briefly overwritten the newer one.
