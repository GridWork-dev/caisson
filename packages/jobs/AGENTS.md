# @caisson/jobs — agent usage note

Provides the provider-agnostic background-job queue port: enqueue interface, in-memory test driver, and the Trigger.dev production driver (ADR-0018).

## Key surface

- Import the `JobQueue` port and enqueue billing/credit side-effects through it — never process them inline in a request handler.
- Use the in-memory driver in tests (`createInMemoryQueue(tasks)`); swap in the Trigger.dev driver
  in production via `createTriggerJobQueue(tasks, config)` — same `tasks` registry, dependency-injected
  `config` (`secretKey`/`apiUrl` sourced from `TRIGGER_SECRET_KEY`/`TRIGGER_API_URL` by the caller,
  never a module constant). `defineTask` maps to a real Trigger.dev `task()` (the deploy-side
  worker); `enqueue` maps to `tasks.trigger()`. Inject a fake `client` via `config.client` in tests
  — the package's own test suite never touches the network.
- Job payloads are validated with `z.object().strict()` at the enqueue boundary.
- Idempotency keys (`crypto.randomUUID()`) are required for every enqueue call.

## Scope

Job enqueueing and the queue-port abstraction only. The billing domain logic belongs in `@caisson/billing`; credit accounting belongs in `@caisson/credits`.
