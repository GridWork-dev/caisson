---
"@caisson/alerting": minor
"@caisson/jobs": minor
---

`@caisson/alerting` adds a fifth network channel, `createDiscordChannel` (SSRF-guarded, maps an
`AlertEvent` to a Discord webhook embed colored by severity), plus a `deliverImmediate` helper for
callers with no persisted incident/rate-cap state of their own. `@caisson/jobs`' pg-boss driver
adds an optional `alerting` port (`JobAlertingDeps`) to `createPgBossJobQueue`: a `work()` task
failure now reports through it before re-throwing (pg-boss's own retry/dead-letter machinery is
untouched), and the underlying `PgBoss` instance's `error` event — previously unhandled, a process-
crash risk per pg-boss's own docs — is now wired via the new `wireBossErrorHandler`. Both additions
are additive and optional; every existing caller keeps compiling unchanged.
