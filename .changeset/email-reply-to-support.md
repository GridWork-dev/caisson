---
"@caisson/email": minor
"@caisson/site": patch
"@caisson/service-license": patch
"@caisson/admin": patch
---

The Resend email driver gains an optional `replyTo` config field, sent as the `reply_to` field
on the wire so replies to a transactional send land in a real inbox instead of bouncing off a
no-reply sender. The three product senders (site magic links, license lifecycle notices, the
admin test-send) opt in with the support inbox, and user-facing contact copy on the refunds,
procurement, partners, and affiliates pages plus the ask-AI panel now points at the support
address; legal pages keep the accounts contact.
