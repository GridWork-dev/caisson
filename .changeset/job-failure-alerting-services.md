---
"@caisson/service-license": patch
"@caisson/service-intel": patch
---

Both services now alert on background-job/watcher failures: `service-license` threads an
`alerting` port into the credit-expiry pg-boss scheduler (a sweep/notice/tick task failure or a
pg-boss connection error notifies the operator, then the original failure still propagates
unchanged); `service-intel` alerts when a watcher tick fails. Both fan out to an operator Discord
channel when `DISCORD_OPS_WEBHOOK_URL` is configured; absent it, behavior is unchanged from
before. No public API changes.
