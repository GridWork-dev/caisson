# @caisson/jobs

Background jobs / scheduler spine.

- **Layer:** base
- **Seeds (rebuild-clean):** health-service
- **Key ADR:** ADR-0002, ADR-0018

> **Built (thin seam)** — real src + tests (job seam). Live per-package status: ../../docs/build-state.md
> Build per `/plan.md`. Pro-private `media-pipeline` contributes patterns only, never code.

## Drivers

- `createInMemoryQueue` — synchronous test/reference driver. No daemon, no network.
- `createTriggerJobQueue` — the Trigger.dev production driver (ADR-0018). Env-gated via
  injected `config` (`secretKey`/`apiUrl`, sourced by the caller from `TRIGGER_SECRET_KEY` /
  `TRIGGER_API_URL` — never a module constant); tests inject a fake `client` instead, so the
  test suite never touches the network.
