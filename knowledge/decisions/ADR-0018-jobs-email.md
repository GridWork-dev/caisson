# ADR-0018 — Background jobs + transactional email

Status: proposed · 2026-06-27 (foundations track; resolves the open jobs/email fork)

**Jobs → Trigger.dev** (operator lock). Durable background jobs with first-class retries,
scheduling, and observability; **self-hostable**, so own-the-code is preserved (the buyer is not
locked to a hosted vendor). **Email → Resend** — modern API, great DX, React-Email templating.
Both are wrapped behind **provider-agnostic ports** so they are swappable and, critically,
**testable without network or secrets**.

**`@caisson/jobs` — `JobQueue` port.** `defineTask(name, payloadSchema, handler)` +
`enqueue(name, payload, opts)` with a **Zod-`.strict()` typed payload**. Drivers: a **Trigger.dev
driver** (prod) and an **in-memory/synchronous driver** (tests + the framework-agnostic reference)
so a unit test asserts "this event enqueued that task with that payload" with no daemon.

**`@caisson/email` — `Emailer` port.** `send({ to, template, data })` with typed templates. Drivers:
a **Resend driver** (prod) and a **capture driver** (tests — records sent mail in memory, asserts
recipient/template/data; never hits the network). `fetchWithTimeout` on the Resend call; no
provider key in code.

**Dispatch interface (the seam from billing/credit events).** Billing/credit domain events
(ADR-0017's `DomainBillingEvent`, ADR-0007's ledger writes) do **not** call email/jobs providers
directly — they **enqueue a typed job** via the `JobQueue` port (e.g. `credit.granted` →
`send-receipt` task → `Emailer.send`). This keeps the credit/billing write path synchronous +
transactional (the ledger row commits) while side-effects (email, downstream sync) run as durable
retried jobs, decoupled. Same pattern P3+ reuses for eval runs, evidence-pack generation, etc.

Rejected: a Postgres-backed queue (graphile-worker/pg-boss — own-the-code + transactional, the
runner-up; Trigger.dev chosen for durable-workflow DX + observability while staying self-hostable).
Inngest (hosted-leaning, vendor cost the buyer inherits). Calling Resend/Trigger inline from the
credit path (couples the transactional write to a flaky network call — must be enqueued).

Binding: jobs + email are ports with a test driver each (no network in tests); billing/credit
side-effects are enqueued, never called inline; payloads are Zod-`.strict()`; `fetchWithTimeout`
on every provider call; no provider key hardcoded.
