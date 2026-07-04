# AGENTS — @caisson/alerting

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire alerting correctly.

## Invariants (do not violate)

- **Always run all five stages through `processAlert`**, not a hand-rolled subset — `dedup` ->
  `rateCap` -> `quietHours` -> `deliverAll` -> the audit write is the whole control; skipping a
  stage breaks the SOC2 CC7.2 story this package exists to satisfy.
- **`now` is always injected**, never `Date.now()` inside pipeline logic. `quietHours` is
  deterministically testable only because time flows in as a parameter.
- **Never import `@caisson/audit-worm` or `@caisson/kernel`'s `audit-chain` helpers here.** The
  audit row this package writes is plain Postgres logging (ADR-0135 Genericness), explicitly not
  tamper-evident WORM. Mixing the two products is the exact confusion ADR-0135 calls out.
- **A channel's `deliver()` must never be allowed to abort the others.** `deliverAll` catches per
  channel; if you add a new driver, either self-catch inside it (matching the shipped four) or rely
  on `deliverAll`'s isolation — never let one channel's rejection propagate past `deliverAll`.
- **Network drivers never leak the upstream response body** into the thrown error — it can echo a
  recipient address, webhook secret fragment, or bot token. Throw a `@caisson/kernel` typed error
  with a fixed message only (the same no-body-leak rule `@caisson/email`'s drivers follow).
- **`EventTypeRegistry` is a lookup table the caller consults, not something this package enforces.**
  `processAlert` takes an explicit `ratePolicy`/`recipientTz`/`quietPolicy` — resolve those from the
  registry (or your own policy source) before calling.

## Choosing channels

- **`createCaptureChannel`** — tests only; records deliveries in memory, no network.
- **`createEmailChannel(emailer)`** — reuse the app's existing `@caisson/email` `Emailer`; do not
  build a second Resend integration here.
- **`createWebhookChannel` / `createSlackChannel` / `createTelegramChannel`** — each takes injected
  config (URL/secret/chat id); never read a channel's endpoint from a module constant or env var
  directly inside this package — the caller injects it.

## Out of scope (this package)

No incident store (the caller supplies `openIncidents` and the recent-send count), no scheduling
(digest replay is a caller/`@caisson/jobs` concern), no live cloud call in tests, no WORM/audit-chain.
