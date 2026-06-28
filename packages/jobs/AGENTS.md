# @caisson/jobs — agent usage note

Provides the provider-agnostic background-job queue port: enqueue interface, in-memory test driver, and the Trigger.dev production driver (ADR-0018).

## Key surface

- Import the `JobQueue` port and enqueue billing/credit side-effects through it — never process them inline in a request handler.
- Use the in-memory driver in tests (`createMemoryJobQueue()`); swap in the Trigger.dev driver in production via dependency injection.
- Job payloads are validated with `z.object().strict()` at the enqueue boundary.
- Idempotency keys (`crypto.randomUUID()`) are required for every enqueue call.

## Scope

Job enqueueing and the queue-port abstraction only. The billing domain logic belongs in `@caisson/billing`; credit accounting belongs in `@caisson/credits`.
