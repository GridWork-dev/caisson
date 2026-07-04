# @caisson/jobs

Provider-agnostic background-job queue port: an enqueue interface with an in-memory
reference driver and a production driver.

- **Layer:** base

## Install

```bash
bun add @caisson/jobs
```

## Drivers

- `createInMemoryQueue` — synchronous test/reference driver. No daemon, no network.
- `createTriggerJobQueue` — the Trigger.dev production driver (ADR-0018). Env-gated via
  injected `config` (`secretKey`/`apiUrl`, sourced by the caller from `TRIGGER_SECRET_KEY` /
  `TRIGGER_API_URL` — never a module constant); tests inject a fake `client` instead, so the
  test suite never touches the network.
