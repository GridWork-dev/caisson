# @caisson-sh/jobs — agent usage note

Provides the provider-agnostic background-job queue port: enqueue interface, in-memory test driver, and the Trigger.dev production driver (ADR-0018).

## Key surface

- Import the `JobQueue` port and enqueue billing/credit side-effects through it — never process them inline in a request handler.
- Use the in-memory driver in tests (`createInMemoryQueue(tasks)`); swap in a production driver via
  `createTriggerJobQueue` / `createPgBossJobQueue` / `createBullMqJobQueue(tasks, config)` — same
  `tasks` registry, dependency-injected `config` (secrets sourced from env by the caller, never a
  module constant). `defineTask` maps to a real Trigger.dev `task()` (the deploy-side worker);
  `enqueue` maps to `tasks.trigger()` / `boss.send()` / `queue.add()` per driver. Inject a fake
  `client`/`queueFactory`+`workerFactory` in tests — the package's own test suite never touches the
  network.
- `createInngestJobQueue(tasks, { client })` registers the task registry through Inngest v4
  `createFunction()` and maps enqueue to `send()`. The caller constructs and injects the SDK client,
  including credentials and serving configuration; this package never reads Inngest env vars.
  Inngest's native singleton only suppresses overlap after a run starts, so the adapter throws on
  `singletonKey` rather than silently weakening the port's queued-or-active contract.
- `createBullMqJobQueue`'s worker-building capability is resolved LAZILY (only when `work()` is
  actually called) — an enqueue-only caller never needs a `connection`/`workerFactory` just to
  construct the queue. Construction only requires a way to build the `Queue` half.
- Job payloads are validated with `z.object().strict()` at the enqueue boundary.
- Idempotency keys (`crypto.randomUUID()`) are required for every enqueue call.

## Scope

Job enqueueing and the queue-port abstraction only. The billing domain logic belongs in `@caisson-sh/billing`; credit accounting belongs in `@caisson-sh/credits`.
