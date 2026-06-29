# Caisson review standards

Repo-specific rules for Greptile, applied on every PR (additive to general best practices).
Source of truth: `CLAUDE.md`, `docs/adr-index.md`, `knowledge/decisions/`. When a diff violates
an invariant below, flag it and cite the ADR.

## Money + credits

- Credits and money are **integer units only** (ADR-0007). Flag any float, decimal literal, or
  `parseFloat`/`Number()` applied to a monetary or credit value.

## Security floor

- Every secret / token / license / HMAC comparison uses `crypto.timingSafeEqual` (or SHA-256
  digest then `timingSafeEqual` for variable-length values). Flag `===`, `!==`, `==`, or
  `Buffer.compare` on a secret.
- Every outbound `fetch` uses `fetchWithTimeout(url, init, ms)`. Flag a bare `fetch(` and any
  use of `AbortSignal.timeout` (forbidden on Bun).
- IDs are generated with `crypto.randomUUID()`.
- Tenant data access is fail-closed RLS: it goes through `withTenant(pg, accountId, fn)`. Flag a
  raw query against a tenant-scoped table that bypasses it. Credit gates return 402; license
  checks fail safe (never throw to open).
- No hardcoded keys, tokens, or secrets. Env vars or encrypted storage only.

## Boundaries + types

- Zod `.strict()` at every API / event / external boundary. Flag a boundary parser using
  `z.object(...)` without `.strict()`, and any external input consumed without validation.
- No `any` and no `console.log` in product code.
- Bun runtime/PM only. Flag `npm`, `yarn`, or `npx` invocations (use `bun` / `bunx`).

## Idempotency

- Idempotent upserts use `INSERT ... ON CONFLICT ... DO NOTHING RETURNING`. Flag a caught
  Postgres `23505` used as control flow — a caught unique-violation poisons the transaction.

## Open-core licensing (ADR-0094 / ADR-0097)

- Dependency direction is **down-only**: the open Apache-2.0 base packages (`kernel`, `auth`,
  `tenancy-rls`, `ui`, `billing`, `credits`, `jobs`, `email`, `ai-config`, `mcp-server`,
  `registry-schema`) must not import from commercial packages (the four editions, `cli`, the
  `registry` service, `migrate`, `pricebook`, `license`). Flag any open → commercial import.
- A package's SPDX license must match its tier. Flag a new base package that is not `Apache-2.0`,
  or a commercial package missing `LicenseRef-Caisson-Commercial`.

## Composition (ADR-0003)

- Editions are compositions, never forks; a package never depends "up" on an edition. Flag
  duplicated logic that should be a shared base import — e.g. a re-introduced migration assembler
  or `readPackageMigrations` copy instead of importing `@caisson/migrate` (ADR-0090).

## ADR fidelity

- Product behavior must trace to a locked ADR. Flag a behavioral change that contradicts, or has
  no referenced, ADR (catalog: `docs/adr-index.md`).
