---
"@caisson/jobs": patch
---

Clear two dependency advisories.

`nanoid` moves to 3.3.18 via the root override (custom generators loop indefinitely when
size is zero). It is a single hoisted resolution, so the one override covers every consumer
— including the exact `3.3.8` that `@trigger.dev/core` pins.

`@trigger.dev/core` moves to 4.5.10 (prototype pollution through run-metadata operations,
escalating to a process-wide cross-tenant denial of service). Core is not declared anywhere
in this repo; it is pinned exactly by `@trigger.dev/sdk`, so the fix is a floor on the SDK
range rather than an override — an override would desync the pair. The range now starts at
the first fixed release so a future lockfile regeneration cannot resolve back under it.

The resolver stopped at 4.5.10 rather than the newest 4.5.11 because the seven-day
release-age floor held it back, which is the floor doing its job.
