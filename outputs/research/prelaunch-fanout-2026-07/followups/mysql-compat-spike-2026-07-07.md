# MySQL Compatibility Scoping Spike — Decision Doc

```yaml
title: "Spike M — MySQL compatibility cost + honest Postgres-required/DB-agnostic split"
date: 2026-07-07
status: spike (decision doc only — no code, per SPEC non-goal)
spec: outputs/specs/research-response/SPEC.md (Spike M)
grounds:
  - knowledge/decisions/ADR-0272-research-response-site-wave.md (§2 stack-fit adapter matrix)
  - knowledge/decisions/ADR-0266-orm-adapter-family-drizzle-prisma.md
  - knowledge/decisions/ADR-0014-database-orm-migrations.md
  - knowledge/decisions/ADR-0005 (fail-closed RLS, cited inline in packages/tenancy-rls/src/rls.ts)
  - outputs/research/prelaunch-fanout-2026-07/cookiy-deep-analysis-2026-07-07.md (the af3-5cff scar)
  - outputs/research/prelaunch-fanout-2026-07/cookiy-extractions-45-2026-07-07.json (verbatim scar quote)
```

## The scar this spike is grounded in

A synthetic buyer transcript (`af3-5cff`) describes almost exactly Caisson's current architecture back at us:

> "We use a WORM audit trail approach. About a year back, we adapted a library meant for Postgres while our client used MySQL. We had to write a thin abstraction layer, which led me to be wary of infrastructure assumptions in any new tools." — `outputs/research/prelaunch-fanout-2026-07/cookiy-extractions-45-2026-07-07.json:626`

That is not a hypothetical for us — it is a description of `packages/audit-worm` today (see classification below). The buyer's stated evaluation lens — "check for infrastructure assumptions, or if it's too rigid" — is the correct lens to apply to this repo.

---

## 1. Repo shape

`ls packages | wc -l` → **51** packages, `ls apps | wc -l` → **7** apps, `ls services | wc -l` → **3** services (61 workspace projects total; the "~40" in the prompt likely refers to the product-facing module count in the registry, not the full internal workspace). Below is every project that touches a database at all, or that a buyer would reasonably expect to.

## 2. Per-package classification

**Key mechanism (read this first):** the security boundary for _every_ multi-tenant table in the repo is `withTenant()`/`TenantExecutor` in `packages/tenancy-rls/src/rls.ts`. It does `SET LOCAL ROLE app` + `SELECT set_config('app.current_account', $1, true)` inside one transaction, and every tenant table ships a migration-time `ALTER TABLE … ENABLE ROW LEVEL SECURITY; … FORCE ROW LEVEL SECURITY; CREATE POLICY … USING (account_id = current_setting(...))` (the generator is `buildTenantPolicySql`, `packages/tenancy-rls/src/rls.ts:153-166`). This is **Postgres-only, no exceptions found** — MySQL 8 has no `CREATE POLICY`/RLS primitive (verified: MySQL 8.0 Reference Manual §8.2 covers only Roles and Partial Revokes, not row-level policies; the pattern buyers reach for on MySQL is bolt-on views+session-variables, e.g. the AWS "Implement row-level security in Aurora MySQL" blog post and a Medium writeup titled "Building PostgreSQL-like RLS with Views, Functions" — both frame it as a manual emulation, not a native feature `[CITED: dev.mysql.com/doc/refman/8.0/en/roles.html, aws.amazon.com/blogs/database]`).

### postgres-by-design (RLS/GUC/advisory-lock is the mechanism itself — no MySQL equivalent without a different security model)

| Package                     | DB usage                                | Postgres-specific features                                                                                                                                                                                                                                                                                                                         | Evidence                                                                                                    |
| --------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/tenancy-rls`      | Owns the tenant-isolation seam          | `SET LOCAL ROLE`, `set_config`, `current_setting`, `ROW LEVEL SECURITY` + `FORCE`, `CREATE POLICY`, `pg_roles` catalog introspection                                                                                                                                                                                                               | `src/rls.ts:1-166`, `src/supabase.ts` (Postgres-wire-only pooler guard)                                     |
| `packages/jobs`             | Job queue                               | `pg-boss` dependency (Postgres-only queue lib, `SKIP LOCKED`/LISTEN-NOTIFY internals) + own `pg_advisory_xact_lock`/`pg_advisory_unlock` for producer dedup                                                                                                                                                                                        | `package.json` (`pg-boss`), `src/advisory-lock.ts:1-10`, `src/pgboss.ts`                                    |
| `packages/org-controls`     | Cross-tenant admin-write seam           | Its own RLS-bypass role model (`ADMIN_WRITE_ROLE`) layered on the same `FORCE ROW LEVEL SECURITY` mechanism, moved out of tenancy-rls per ADR-0257 §1.3                                                                                                                                                                                            | `src/admin-write.ts:29`                                                                                     |
| `packages/audit-worm`       | WORM audit chain + locked-version store | Three-layer immutability that is _specifically_ a Postgres privilege/RLS/trigger composition: withheld `GRANT` (no UPDATE/DELETE to `app`), `BEFORE UPDATE/DELETE` `plpgsql` trigger that `RAISE EXCEPTION`s, **plus** `FORCE ROW LEVEL SECURITY` — the migration comment says this explicitly ("enforced THREE ways so no single bug defeats it") | `src/migrations/0001_audit_chain.sql`, `0002_versions.sql` (uuid/jsonb/timestamptz + RLS + plpgsql trigger) |
| `packages/field-crypto`     | Encrypted-column store + key registry   | `drizzle-orm/pg-core` `customType` for the crypto column type; migrations ship RLS (`0001_field_keys.sql`, `0002_field_keys_rls_nullif.sql`)                                                                                                                                                                                                       | `src/column.ts:10`, `src/migrations/`                                                                       |
| `packages/compliance`       | Impersonation-session audit             | RLS migration (`0002_impersonation_session_rls_nullif.sql`)                                                                                                                                                                                                                                                                                        | `src/migrations/`                                                                                           |
| `packages/alerting`         | Alert audit trail                       | RLS migration (`0002_alert_audit_rls_nullif.sql`) — bakes literal RLS DDL into its own migration without even importing tenancy-rls at runtime, confirming RLS is a **schema-level convention**, not just a shared library call                                                                                                                    | `src/migrations/0002_alert_audit_rls_nullif.sql`                                                            |
| `packages/retention-runner` | Erasure scheduling + audit              | RLS migrations (0002/0003) + depends on `@caisson/jobs` (pg-boss) for scheduling                                                                                                                                                                                                                                                                   | `src/migrations/`, `package.json`                                                                           |
| `packages/auth`             | `account_member` org membership         | RLS-scoped store per `membership.ts`'s own comment ("Pure selection logic + RLS-scoped stores")                                                                                                                                                                                                                                                    | `src/schema.ts:18`, `src/membership.ts:3,43,61`                                                             |

### postgres-by-convenience (uses Postgres SQL dialect today — jsonb, `RETURNING`, `ON CONFLICT`, `$1/$2` — but the _business logic_ doesn't require RLS itself; all of them still sit on top of the postgres-by-design floor above via `withTenant`/`TenantExecutor`)

| Package                                | DB usage                                           | Postgres-specific syntax used                                                                                                                                                                | Evidence                                                                                                   |
| -------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/credits`                     | Credit ledger (grant/debit/clawback/expiry)        | `ON CONFLICT DO NOTHING/DO UPDATE`, `RETURNING`, `SELECT … FOR UPDATE`, `::int` casts                                                                                                        | `src/credits.ts:214,264,358,385,622`                                                                       |
| `packages/ai-kit`                      | BYOK credential store                              | `ON CONFLICT (account_id, provider)`                                                                                                                                                         | `src/byok-store.ts:70`                                                                                     |
| `packages/ai-meter`                    | Usage metering / circuit breaker                   | `ON CONFLICT`, `RETURNING`                                                                                                                                                                   | `src/breaker.ts:72,88`, `src/meter.ts:15`                                                                  |
| `packages/billing-orchestration`       | Processed-webhook idempotency                      | `RETURNING`, `ON CONFLICT`, `FOR UPDATE`                                                                                                                                                     | grep hits in `src/` (feature scan)                                                                         |
| `packages/platform-reads`              | Read-only dashboard queries                        | Thin `TenantExecutor` consumer, no exotic syntax beyond the port itself                                                                                                                      | `src/index.ts:17-20` ("Leaf by design: depends only on `@caisson/tenancy-rls`")                            |
| `packages/prompt-registry`             | Prompt template store                              | `jsonb` columns (`messages`, `var_spec`), `$5::jsonb` casts, `ON CONFLICT`                                                                                                                   | `src/schema.ts:28,30`, `src/registry.ts:80,153`                                                            |
| `packages/rate-limit`                  | Rate-limit counters                                | `ON CONFLICT`, `RETURNING`                                                                                                                                                                   | feature scan                                                                                               |
| `packages/cli`                         | `create-caisson` generator, local dev DB bootstrap | Bundles other packages' migration SQL verbatim (`migrations-bundle/`) — inherits their Postgres dialect + RLS                                                                                | `packages/cli/migrations-bundle/{compliance,field-crypto,alerting,retention-runner,audit-worm}/migrations` |
| `packages/migrate`                     | Migration runner + ledger                          | **Split**: the `MigrationApplier` port + checksum ledger (`schema_version`) is DB-agnostic; `pg-applier.ts` is the one concrete Postgres implementation (`Pool` from `pg`, type-only import) | `src/runner.ts:21` (port), `src/pg-applier.ts:15,30` (impl)                                                |
| `apps/admin`, `apps/base`, `apps/site` | Product apps                                       | `drizzle-orm/node-postgres`, raw `pool.connect()` + manual `BEGIN/COMMIT/ROLLBACK` (Drizzle's own `db.transaction()` doesn't expose the `PoolClient` `withTenant` needs)                     | `apps/site/lib/db.ts:1-40`                                                                                 |
| `services/license`                     | Entitlement/license grant ledger                   | `jsonb`, `RETURNING`, `ON CONFLICT`, `FOR UPDATE`, and its own RLS-scoped tables                                                                                                             | `pg` in `package.json`; feature scan                                                                       |
| `services/support-bot` (Python)        | Support-ticket escalation store                    | `asyncpg` (Postgres-only Python driver), `jsonb` column, `$1,$2,$3::jsonb` — **but already ships a port**: `InMemoryTicketStore` / `PostgresTicketStore` behind one interface                | `src/caisson_support_bot/escalation.py:7,24,93`                                                            |

### db-agnostic _by different engine entirely_ (not a Postgres/MySQL question — embedded SQLite via `bun:sqlite`, behind a port)

| Package                | DB usage                               | Evidence                                                                                                           |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/local-store` | Per-tenant embedded vector store       | `bun:sqlite` + `sqlite-vec` (`src/tenant-db.ts:11`, `src/store.ts:7,9`)                                            |
| `packages/local-sync`  | CRDT-style local-first sync            | `bun:sqlite`, entirely behind its own `port.ts` adapter (`src/changeset.ts:15`, `src/port.ts`)                     |
| `packages/local-ai`    | Local-first RAG store + crypto-at-rest | `bun:sqlite`, own numbered-migration ledger (`store/migrate.ts:56-188`, mirrors ADR-0014's pattern but for SQLite) |
| `services/docs`        | Docs RAG service                       | Consumes `@caisson/local-store` (SQLite/sqlite-vec), no server RDBMS (`package.json` deps)                         |

These four are **already** not-Postgres. A "MySQL lane" is a non-question for this family — they'd need to answer the same question if the ask were "SQL Server compat," but it's orthogonal to the Postgres/MySQL split.

### db-agnostic / no-db (no `@caisson/tenancy-rls` workspace dep, no raw SQL in `src/`, verified by two independent grep passes — feature-keyword scan + broad `INSERT|SELECT|CREATE TABLE|bun:sqlite|drizzle|pg-boss` scan)

`packages/kernel` (pure crypto/money/config/event-sink utilities — zero DB dep despite being the thing everything else depends on), `packages/billing` (webhook signature verify/parse only — persistence delegated to `billing-orchestration`/`credits`), `packages/registry-schema` (zod schemas + registry index), `packages/local-inference`, `packages/local-privacy`, `packages/license-issue`, `packages/license-verify`, `packages/signing-primitive`, `packages/mcp-server`, `packages/pricebook`, `packages/tool-exec`, `packages/guardrails`, `packages/frameworks-pack`, `packages/observability`, `packages/email`, `packages/compliance-core`, `packages/ai-config`, `packages/agent-dev`, `packages/agent-kernel`, `packages/agent-runner`, `packages/ai-evals`, `packages/audit-harness`, `packages/ui`, `packages/ui-pro`, `packages/brand`, and the **five bundle-manifest packages** `agentic-dev`/`ai-production`/`everything`/`local-first`/`provenance` (each is literally one `manifest.ts` composing a module list — verified `find packages/<name> -name '*.ts' | grep -v test` returns only `manifest.ts`). `apps/agent-dev`, `apps/ai-kit`, `apps/local-ai` are composition apps with no raw SQL of their own.

### The Drizzle/Prisma bridges — what ADR-0266 actually bridges

`packages/tenancy-rls/src/drizzle.ts` and `.../prisma.ts` are **query-generation convenience bridges, not database-engine bridges**. Both explicitly document the coupling in their own comments:

- `drizzle.ts:10-14`: "`$1`/`$2` positional placeholders **on the pg dialect**" — the structural type `DrizzleToSql.toSQL()` matches `drizzle-orm`'s `Query` shape, but every real caller in this repo writes SQL text against Postgres dialect (uuid/jsonb/timestamptz, `ON CONFLICT`) through it.
- `prisma.ts:16-18`: "matches the real `PrismaClient.$queryRawUnsafe`/`$executeRawUnsafe` signatures (variadic positional params, **Postgres `$1`/`$2` placeholders**)."

So a buyer reading "Drizzle bridge, Prisma adapter" on the fit-matrix page and inferring "therefore MySQL-flexible" would be wrong — both bridges assume the pg wire dialect and thread Postgres-only SQL text (including RLS-dependent DDL) through the same `TenantExecutor` floor documented above. This is the exact shape of the `af3-5cff` scar: an ORM name signals flexibility the underlying plumbing doesn't have.

---

## 3. Three scenarios, costed

### (a) Docs-only — honest fit-matrix rows, no code

**Cost: ~0.5–1 engineer-day.** Write the rows below (§5) into the Track S stack-fit adapter matrix, cite `packages/tenancy-rls/src/rls.ts` as the mechanism, and stop. Zero engineering risk, zero regression surface, ships inside the already-scheduled Track S wave (ADR-0272 §2, "Stack-fit adapter matrix … DB posture (Postgres-required vs DB-agnostic — honest, per the spike's eventual doc)").

### (b) MySQL support for "the DB-agnostic + convenience-bound subset"

**This scenario, as scoped in the prompt, does not actually exist as a phaseable middle tier — and that's the load-bearing finding of this spike.**

Every "convenience-bound" package in §2 (`credits`, `ai-kit`, `ai-meter`, `billing-orchestration`, `platform-reads`, `prompt-registry`, `rate-limit`, `cli`, `apps/admin`/`base`/`site`, `services/license`) has **zero tenant-isolation logic of its own** — each one calls `withTenant()`/`TenantExecutor` and trusts RLS to do the isolation. None of them could be "ported first, RLS deferred" without shipping multi-tenant tables with no isolation at all. The only packages that are independently portable _without_ touching the RLS floor are the ones already in the **db-agnostic** bucket (`local-store`/`local-sync`/`local-ai`, already SQLite) or the **no-db** bucket (irrelevant to this question).

So the real cost of "MySQL for everything except the by-design core" is: **you still have to solve tenant isolation without RLS first** (a by-design-tier problem), and only _then_ is the SQL-dialect rewrite of ~14 convenience packages (jsonb→JSON, uuid→CHAR(36)/BINARY(16), `$1`→`?`, `ON CONFLICT`→`ON DUPLICATE KEY UPDATE`, `RETURNING`→SELECT-after-write since MySQL 8 has no `RETURNING`) a bounded, mechanical ~2-3 week job. Rough sizing if the isolation problem is solved: 14 packages × ~0.5-1.5 days dialect rewrite + test-matrix rework (PGlite fixtures → a MySQL/MariaDB test container) ≈ **3-4 engineer-weeks**, _contingent on_ scenario (c)'s isolation redesign landing first.

### (c) Full parity including a tenancy story without RLS

**Cost: ~6-10 engineer-weeks, and a genuinely different security posture — name the trade-off explicitly.**

Components:

1. **App-layer tenant scoping** to replace `FORCE ROW LEVEL SECURITY`: every query wrapped by a query-builder middleware that force-injects `WHERE account_id = ?` (or an equivalent view-per-tenant scheme). **This is strictly weaker than what ships today.** `rls.ts`'s own doc comment states the value prop plainly: "a query that forgets its `WHERE account_id = …` still returns only the caller's rows" under Postgres RLS — that guarantee is DB-enforced and defeats a forgotten `WHERE` clause. An app-layer scoping wrapper only defeats a forgotten `WHERE` clause if _every single query in every package_ is forced through the wrapper with no raw-SQL escape hatch — a much larger, ongoing-maintenance surface, and the exact "near-miss with a configuration oversight during a staging deployment" pattern the compliance-audience buyers already worry about (`cookiy-extractions-45-2026-07-07.json:626`, tenant-isolation section).
2. Rewrite the immutability model in `audit-worm` (§2 by-design row) — MySQL 8 _does_ support `GRANT`-withholding and `BEFORE UPDATE/DELETE` triggers (no `plpgsql`, uses MySQL trigger syntax), so 2 of the 3 layers are portable; only the `FORCE RLS` layer has no equivalent and falls back to app-layer scoping per point 1.
3. `pg-boss` → a MySQL-compatible job queue (there is no MySQL-native equivalent with the same `SKIP LOCKED` semantics pre-8.0; MySQL 8.0+ does support `SELECT … FOR UPDATE SKIP LOCKED`, so a bespoke queue table is buildable, but `pg-boss` itself is not swappable — a rewrite, not a driver swap).
4. `pg_advisory_xact_lock` → MySQL `GET_LOCK()`/named locks (different semantics: session-scoped, not transaction-scoped — the producer-dedup logic in `packages/jobs/src/advisory-lock.ts` would need redesign, not just a syntax swap).
5. Every by-design + by-convenience package's SQL dialect rewrite (scenario b's tail).
6. A second full test-matrix leg: PGlite currently stands in for Postgres in CI (`@electric-sql/pglite` across `apps/admin`, `apps/site`, `apps/compliance`, `apps/ai-kit`) — MySQL has no equivalent embeddable-WASM test double, so CI would need a real MySQL/MariaDB service container, a second fixture set, and (per the `advisory-lock.integration.test.ts` `skipIf` pattern already in this repo for PGlite gaps) a second round of "which Postgres-tested behaviors don't actually reproduce" discovery.

## 4. Recommendation

**Ship (a) now, inside the already-scheduled Track S wave. Do not scope (b) as a standalone phase — it isn't one. Treat (c) as a separate, later ADR-gated decision, not something to greenlight from this spike.**

Confidence: **HIGH** on the classification (every claim above is grounded in a real file path, re-verified across two independent grep passes plus manual reads of the actual RLS/migration/bridge source). **MEDIUM** on the MySQL-side negative claims (no native RLS, no `RETURNING` pre-MariaDB-10.5) — verified via official MySQL 8.0 reference-manual search results, not a direct doc fetch; worth a follow-up `crawl4ai` pull of the MySQL 8.0 `dev.mysql.com` roles/privileges pages before this becomes a locked ADR claim.

Rationale: the SPEC's own non-goal already says "No MySQL port — the spike produces a decision doc, not code," and the honest finding here — RLS is universal across the multi-tenant surface, so there is no cheap partial port — is exactly the kind of finding that should stay a documented trade-off on the fit-matrix page (turning the buyer's own wariness into a transparency asset, per the Cookiy analysis's "founder-transparency" cluster) rather than trigger a half-scoped MySQL initiative that would still ship with a materially weaker isolation guarantee than what's live today.

## 5. Fit-matrix rows this doc supports (Track S §2, ADR-0272)

| Row                                | Honest claim                                                                                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database**                       | PostgreSQL required. Neon (default, swappable via `DATABASE_URL`), any Postgres 14+ host, or Supabase (session-mode pooler only — transaction-mode pooling breaks tenant isolation, enforced at connection time).                        |
| **Tenant isolation**               | Enforced at the database layer via Postgres Row-Level Security (`FORCE ROW LEVEL SECURITY`) — not application middleware. This is a security property, not a preference: a query that forgets its tenant filter still returns zero rows. |
| **MySQL / other RDBMS**            | Not supported. Postgres RLS is architectural, not a swappable driver choice — MySQL has no native row-level-security equivalent. No MySQL lane is planned; see the scoping spike for the full trade-off if this blocks your evaluation.  |
| **ORM flexibility**                | Drizzle and Prisma bridges ship (ADR-0266) — both let you write Drizzle/Prisma query syntax against the same Postgres-backed tenant-isolation floor. These are query-builder conveniences, not database-engine abstractions.             |
| **Local-first / embedded storage** | The local-first bundle (`local-store`, `local-sync`, `local-ai`) uses embedded SQLite (`bun:sqlite` + `sqlite-vec`), independent of the server Postgres requirement — this path has no Postgres dependency at all.                       |
| **Migration tooling**              | The migration _runner_ (numbered, checksummed, idempotent) is engine-agnostic by design; the _default applier_ and all shipped migration SQL are Postgres dialect.                                                                       |

---

**Files read (no edits made):** `packages/tenancy-rls/src/{rls,drizzle,prisma,supabase}.ts`, `packages/{jobs,audit-worm,field-crypto,credits,auth,org-controls,alerting,retention-runner,compliance,prompt-registry,platform-reads,migrate,local-store,local-sync,local-ai,billing,kernel,registry-schema}/src/*`, `apps/site/lib/db.ts`, `services/{license,support-bot,docs}/package.json` + `services/support-bot/src/caisson_support_bot/{__main__,escalation,telemetry}.py`, `knowledge/decisions/ADR-{0014,0266,0272}*.md`, `outputs/specs/research-response/SPEC.md`, `outputs/research/prelaunch-fanout-2026-07/cookiy-{deep-analysis,extractions-45}-2026-07-07.{md,json}`.
