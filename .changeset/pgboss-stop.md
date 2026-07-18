---
"@caisson/jobs": minor
---

The pg-boss job queue driver gains a `stop()` method: it releases the client's maintenance
timers and its own connection pool if one was ever lazily started, and is a safe no-op
otherwise. Short-lived callers (a CLI command, a script) that enqueue at least one job
should call it during their own shutdown so the process can exit promptly instead of being
kept alive by pg-boss's background timers.
