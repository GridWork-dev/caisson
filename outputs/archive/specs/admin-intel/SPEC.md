# SPEC — admin intelligence layer (`services/intel`)

Implements ADR-0286 (admin intelligence layer). This SPEC locks the data model, the
daemon↔admin contract, the per-watcher cadences, and the env surface **before** any code.
The build follows it. Tags: `infra`, `observability`, `external-system`.

## Goal

One standing Bun service on the box that watches a fixed set of external signals
(compliance frameworks, competitors, GitHub traction, product analytics, production
errors), detects change **cheaply and deterministically first**, and appends the result
as durable **findings** in a dedicated `intel` schema of the admin Postgres. The future
admin intel page reads that schema; production-error signal additionally pushes through
`@caisson/alerting` to the operator's Telegram bridge and an auto-filed Linear issue.

Non-goals: the admin intel **page** (owned by another track, builds after the admin merge
queue drains); deploying the container (operator DEPLOY act); an LLM analysis layer beyond
a clearly-marked, env-gated, off-by-default seam.

## Scope boundary

- Owns: `services/intel/**` + its `migrations/0001_intel_schema.sql` +
  `migrations/provision-role.sql` + compose/Dockerfile.
- Never touches: `apps/admin`, `apps/site`, `services/license`, `.github/workflows`,
  `registry/**` (a service is not a sold package — the registry index is untouched).
- The migration is **additive**: `CREATE SCHEMA intel` + three tables. It never references
  or alters any commerce/public-schema table.

## Two-tier detection (the core discipline)

Every watcher runs **tier 1 = zero-LLM deterministic detection** on every cadence tick:
a content hash, a release-version compare, or a set-difference of ids against the last
persisted state (`intel.watch_state`). Only when tier 1 yields a finding does **tier 2 =
an optional LLM enrichment pass** run — and tier 2 is **off by default** (`INTEL_LLM_ENABLED`
unset ⇒ a no-op that returns the finding unchanged). No cadence tick ever spends an LLM
token on an unchanged source.

## Data model — `intel` schema (migration `0001_intel_schema.sql`)

Single-operator admin DB: these tables are **not tenant-scoped** and carry **no RLS**
(RLS is the multi-tenant commerce contract; this schema is operator-only). Integer counts,
`uuid` ids (`crypto.randomUUID()`), `timestamptz` timestamps.

### `intel.findings` — the append-with-dedup incident store

| column       | type                                          | note                                                                             |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `id`         | `uuid` PK                                     | `crypto.randomUUID()`                                                            |
| `source`     | `text`                                        | watcher name: `compliance`\|`soc2`\|`competitor`\|`github`\|`analytics`\|`error` |
| `kind`       | `text`                                        | e.g. `framework_update`\|`page_diff`\|`traction`\|`rollup`\|`error_group`        |
| `severity`   | `text` CHECK in (`info`,`warning`,`critical`) |                                                                                  |
| `title`      | `text`                                        | one-line buyer-neutral headline                                                  |
| `body`       | `text`                                        | deterministic brief (+ LLM prefix only when enriched)                            |
| `dedup_key`  | `text` UNIQUE                                 | stable per incident; re-seen reinforces, never duplicates                        |
| `seen_count` | `integer` DEFAULT 1                           | incremented on each re-observation                                               |
| `first_seen` | `timestamptz` DEFAULT now()                   |                                                                                  |
| `last_seen`  | `timestamptz` DEFAULT now()                   | bumped on re-observation                                                         |
| `run_id`     | `uuid`                                        | the run that last touched it                                                     |
| `payload`    | `jsonb` DEFAULT `'{}'`                        | structured detail (urls, counts, ids)                                            |

**Dedup contract:** `INSERT … ON CONFLICT (dedup_key) DO UPDATE SET last_seen=now(),
seen_count=findings.seen_count+1, run_id=excluded.run_id, severity/title/body/payload
refreshed … RETURNING seen_count`. `seen_count === 1` ⇒ newly inserted; `>= 2` ⇒
reinforced. Append-only in spirit (a finding is never deleted by the daemon).

**HARD REQUIREMENT for the future admin intel page (forward note — not this build):**
`findings.title` / `findings.body` / `findings.payload` carry attacker/buyer-influenced text
(an error message, a scraped page fragment, an LLM enrichment paragraph). The page MUST render
every one of these fields as **plain text only** — never interpreted as Markdown or HTML. Any
markdown/HTML rendering of stored finding content is a stored-XSS vector on the operator
control-plane. This constraint binds the page phase; it is not optional design latitude.

### `intel.watch_state` — the deterministic-detection memory

| column       | type                        | note                                                                                  |
| ------------ | --------------------------- | ------------------------------------------------------------------------------------- |
| `key`        | `text` PK                   | e.g. `compliance:oscal:version`, `competitor:<sha1(url)>:hash`, `github:<repo>:stars` |
| `value`      | `text`                      | last seen version / content hash / count                                              |
| `updated_at` | `timestamptz` DEFAULT now() |                                                                                       |

Survives daemon restarts — it is what makes "detect change since last run" real.

### `intel.runs` — one row per watcher invocation (90-day retention)

A row per invocation is otherwise unbounded growth (six watchers, cadences from 15m to 30d —
the 15m error watcher alone is ~35,000 rows/year). `pruneRuns()` deletes rows older than 90 days,
called best-effort at daemon boot (a failure here logs and never blocks startup — it's a cost
concern, not an availability one).

| column                       | type                                     | note                              |
| ---------------------------- | ---------------------------------------- | --------------------------------- |
| `id`                         | `uuid` PK                                |                                   |
| `watcher`                    | `text`                                   |                                   |
| `started_at` / `finished_at` | `timestamptz`                            |                                   |
| `status`                     | `text` CHECK in (`running`,`ok`,`error`) |                                   |
| `findings_count`             | `integer` DEFAULT 0                      |                                   |
| `error`                      | `text` NULL                              | truncated message; never a secret |

## Daemon ↔ admin contract (the push path)

The tailnet-only box can reach Railway, never the reverse (ADR-0286 §4). The daemon
therefore **pushes**: direct authed Postgres writes to `intel.*` over a **dedicated DSN**
(`INTEL_DATABASE_URL`). No inbound API on the daemon accepts findings. The DSN's role
(`intel_role`) holds DML on the `intel` schema and nothing else — **provisioned as an artifact,
not prose**: `migrations/provision-role.sql` (`CREATE ROLE` + `GRANT`/`ALTER DEFAULT PRIVILEGES`
on `intel` + explicit `REVOKE ALL ON SCHEMA public`), applied once by the database owner before
`0001_intel_schema.sql`. An opt-in boot-time self-check (`checkRoleIsolation`, gated behind the
production `INTEL_MIGRATE_ON_BOOT=false` posture) proves a read against `public.accounts` is
rejected — belt-and-suspenders on the SQL-level containment, never a hard boot dependency.

The admin app (future page) is a **read-only** consumer of `intel.*`. This SPEC ships the
producer only.

## Watchers + cadences

| watcher      | default cadence                     | tier-1 detection                                                                                                                                                       | finding on                                              |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `compliance` | 24h (`INTEL_CADENCE_COMPLIANCE_MS`) | OSCAL + oscal-content `releases.atom` version-bump (zero-LLM); EU AI Act EUR-Lex RSS + AI-Office guidance content-hash; HIPAA OCR breach-portal new-report-id set-diff | a newer release tag, a changed hash, or a new breach id |
| `soc2`       | 30d (`INTEL_CADENCE_SOC2_MS`)       | AICPA SOC 2 resources-page content-hash                                                                                                                                | changed hash                                            |
| `competitor` | 24h (`INTEL_CADENCE_COMPETITOR_MS`) | per-URL content-hash over a **config** list (`INTEL_COMPETITOR_URLS`, data not code)                                                                                   | changed hash                                            |
| `github`     | 12h (`INTEL_CADENCE_GITHUB_MS`)     | stars/forks/open-issues delta vs `watch_state` for `caisson-sh` org repos (public API, token-optional)                                                                 | any positive delta                                      |
| `analytics`  | 24h (`INTEL_CADENCE_ANALYTICS_MS`)  | PostHog query-API daily rollup + Plausible aggregate; **always** emits one dated rollup finding (dedup on the date)                                                    | every run (rollup, not change)                          |
| `error`      | 15m (`INTEL_CADENCE_ERROR_MS`)      | PostHog error-tracking issues; new/spiking groups → `@caisson/alerting` (dedup/rateCap/quietHours) → tg-bridge + Linear + a finding                                    | a new or spiking error group                            |

Cadences are env-overridable; the internal scheduler is the default runner. Each watcher is
also **independently invocable** as `bun run src/cli.ts run <watcher>` so Claude Code
Routines / cloud agents can drive a single leg without the daemon (ADR-0286 §5).

## Error triage → alerting (ADR-0286 §3, dogfooding)

New/spiking PostHog error groups map to `@caisson/alerting`'s `AlertEvent` (tenantId/recipient
= `"operator"`, `dedupeKey` = the error fingerprint) and run through `processAlert` with two
**custom `AlertChannel`s**:

- **tg-bridge** — POST `TG_BRIDGE_ALERT_URL` with `Authorization: Bearer <TG_BRIDGE_ALERT_TOKEN>`,
  `fetchWithTimeout`, `redirect:"error"`, no response body in errors. It is a **trusted
  operator-configured internal sink** (loopback/tailnet), so it deliberately does **not** run
  the buyer-URL SSRF guard the built-in alerting channels use (those guard buyer-supplied
  destinations; this URL is operator env).
- **Linear** — `issueCreate` GraphQL mutation at `https://api.linear.app/graphql`,
  `Authorization: <LINEAR_API_KEY>` (personal-key convention, no `Bearer`), into
  `LINEAR_TEAM_ID`, with a deterministic brief. Missing key ⇒ sink skipped.

The brief is **deterministic** (group name, count, first/last seen, link). An LLM root-cause
paragraph is the same off-by-default seam. Dedup + rate-cap + quiet-hours state is sourced
from `intel.findings` (recent open error incidents; recent send count in the window).

## Env surface (Zod `.strict()` at the config boundary)

Required: `INTEL_DATABASE_URL`.
Ops: `INTEL_HEALTHZ_PORT` (8791), `INTEL_HEALTHZ_HOST` (`127.0.0.1` bare-run default; the
compose env sets `0.0.0.0` explicitly since the container's own bind must be reachable from the
host's port mapping), `INTEL_SCHEDULER_ENABLED` (true), `INTEL_MIGRATE_ON_BOOT` (false — the
runtime role is DML-only and can't run schema DDL; applying the migration is an operator step,
never a boot step, in production).
Cadences: the six `INTEL_CADENCE_*_MS` above, floored at 1,000ms (`MIN_CADENCE_MS`) — a
misconfigured near-zero cadence can't spin the scheduler's overlap guard into a tight skip-loop.
Sources/secrets (all optional; absent ⇒ that leg self-skips, fail-soft):
`INTEL_COMPETITOR_URLS`, `INTEL_GITHUB_ORG` (`caisson-sh`), `GITHUB_TOKEN`,
`POSTHOG_API_KEY`, `POSTHOG_API_HOST` (`https://us.posthog.com`), `POSTHOG_PROJECT_ID`
(`493539`), `PLAUSIBLE_API_KEY`, `PLAUSIBLE_API_HOST` (`https://plausible.io`),
`PLAUSIBLE_SITE_ID`, `TG_BRIDGE_ALERT_URL`, `TG_BRIDGE_ALERT_TOKEN`, `LINEAR_API_KEY`,
`LINEAR_TEAM_ID`.
Alerting policy: `INTEL_ALERT_RATE_MAX_PER_WINDOW` (3), `INTEL_ALERT_TZ` (`UTC`),
`INTEL_ALERT_QUIET_START`/`_END` (0/0 = off).
LLM seam: `INTEL_LLM_ENABLED` (false), `OPENROUTER_API_KEY`, `INTEL_LLM_MODEL`.
Observability: `OTEL_EXPORTER_OTLP_ENDPOINT` (`initObservability` gate).

Secrets live in env only — never in code or the committed compose file. Third-party read
responses are parsed with a field-picking Zod schema (NOT `.strict()`: providers add fields;
strict is the wrong posture for a read we don't control). `.strict()` guards the config and
the shapes we own.

## Health + ops

- `GET /healthz` → `200 {"ok":true}`; unauthenticated, bound loopback-only (the bind is the
  gate — a push-only daemon has no inbound authed surface, so no token comparison exists).
- Container: Bun, non-root, in-container `HEALTHCHECK` probing `127.0.0.1:PORT/healthz`.
- `docker-compose.yml` publishes `127.0.0.1:PORT:PORT` (host-loopback only), `restart:
unless-stopped`, env injected from the host sanitized-mirror file (not committed).
- DEPLOY (operator act, not this build): provision `intel_role`
  (`migrations/provision-role.sql`) as the database owner, apply `0001_intel_schema.sql` in the
  same connecting session, `compose up`, set env (`INTEL_MIGRATE_ON_BOOT` stays `false`); land
  rows in gridwork-core `identity/security-surfaces.md` — one sanctioned loopback bind
  (`127.0.0.1:PORT`) + the egress sinks (GitHub, EUR-Lex, HHS OCR, AICPA, competitor URLs,
  PostHog, Plausible, the tg-bridge `/alert` push, Linear, OpenRouter-when-enabled, the optional
  OTel/OTLP collector, and the admin-DB write path). See README.md "Deploying" for the full
  ordered runbook.

## Verification (goal-backward)

- `bun run check` at root green (turbo build/lint/test + standards-gate) with `services/intel`
  a workspace member; `registry/index.json` unchanged.
- Unit tests (fixture-driven, no live network): each watcher's tier-1 detection, the findings
  dedup, the alerting-pipeline wiring (capture channels + audit sink). Live API probes are
  self-skipping `live/*.live.test.ts` per repo convention.
- Every outbound fetch routes through `fetchWithTimeout`; no `any`, no `console.log`; secrets
  never logged.
