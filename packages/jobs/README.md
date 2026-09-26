# @caisson-sh/jobs

Provider-agnostic background-job queue port: an enqueue interface with an in-memory
reference driver and a production driver.

- **Layer:** base

## Install

```bash
bun add @caisson-sh/jobs
```

## Drivers

- `createInMemoryQueue` — synchronous test/reference driver. No daemon, no network.
- `createTriggerJobQueue` — the Trigger.dev production driver (ADR-0018). Env-gated via
  injected `config` (`secretKey`/`apiUrl`, sourced by the caller from `TRIGGER_SECRET_KEY` /
  `TRIGGER_API_URL` — never a module constant); tests inject a fake `client` instead, so the
  test suite never touches the network.
- `createPgBossJobQueue` — the pg-boss production driver (ADR-0173), Postgres-native.
- `createBullMqJobQueue` — the BullMQ/Redis production driver (ADR-0287). Env-gated via
  injected `config.connection` (an ioredis connection the caller builds from `REDIS_URL` —
  never a module constant; must set `maxRetriesPerRequest: null` per BullMQ's Worker
  requirement). `idempotencyKey` maps to a native `jobId`; `singletonKey` maps to BullMQ's
  Simple-Mode `deduplication`. `close()` performs a graceful shutdown (workers, then queues).
  Tests inject `queueFactory`/`workerFactory` instead of a connection, so the suite never
  touches Redis.
- `createInngestJobQueue` — the Inngest v4 serverless driver (ADR-0379). The caller injects an
  already-configured `Inngest` client; construction registers each task with `createFunction()`,
  enqueue sends a same-name event, and `idempotencyKey` maps to a task-scoped native event `id`.
  Inngest v4 singleton `skip` covers only already-executing runs, not the port's stronger queued-or-
  active guarantee, so this adapter throws whenever `singletonKey` is supplied. The caller serves
  `client.funcs` through its framework adapter. This package never reads `INNGEST_EVENT_KEY` or any
  other ambient credential.
