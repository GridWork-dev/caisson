# @caisson/service-intel

The standing operator intelligence daemon. It watches a fixed set of external signals —
compliance-framework updates, competitor pages, GitHub traction, product analytics, production
errors, and (ADR-0369) this repo's own dependency/toolchain pins — detects a change cheaply and
deterministically first (a content hash, a release-version compare, or a set difference — zero
tokens spent), and appends the result as a durable finding in the admin database's `intel`
schema. An optional LLM enrichment pass can run on top of a detected change, but it is off by
default: every cadence tick that finds nothing changed spends no tokens at all. Production-error
and dep-digest signal additionally route through `@caisson/alerting` to the operator's Telegram
bridge and an auto-filed Linear issue (`error` through the full dedup/rate-cap/quiet-hours
pipeline; `dep-digest` through the lighter immediate-delivery path — its own watch_state dedup
already guarantees each event alerts once).

This is a producer only. It pushes findings into Postgres over an authed connection string; it
never accepts an inbound API call beyond a loopback health check. The admin control-plane app
reads the `intel` schema to render the findings feed — that page is a separate, later piece of
work and is not part of this service.

## What it watches

| watcher      | default cadence | detects                                                                                                                                                                                                                                                                           |
| ------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance` | 24h             | NIST OSCAL + oscal-content release bumps, EU AI Act (EUR-Lex + AI Office guidance) content changes, new HHS OCR breach-portal entries                                                                                                                                             |
| `soc2`       | 30d             | AICPA SOC 2 resources-page content changes                                                                                                                                                                                                                                        |
| `competitor` | 24h             | content changes on a configured list of competitor pages                                                                                                                                                                                                                          |
| `github`     | 12h             | star/fork gains across the `caisson-sh` org's public repos                                                                                                                                                                                                                        |
| `analytics`  | 24h             | a daily rollup from PostHog + Plausible (always emits one dated row)                                                                                                                                                                                                              |
| `error`      | 15m             | new or spiking PostHog error-tracking groups, routed through the alerting pipeline                                                                                                                                                                                                |
| `dep-digest` | 7d              | ADR-0369: stalled Renovate PRs (>14d open), toolchain/pinned-dep major bumps (typescript/tsc-native/next/zod/turbo/react/better-auth) + bun releases against npm/GitHub, release-age ("held") annotation, direct buyer-impact — routed through the alerting pipeline like `error` |

Every watcher is also independently runnable without the scheduler:

```
bun run src/cli.ts run <compliance|soc2|competitor|github|analytics|error|dep-digest>
```

This is the seam a Claude Code Routine or a hosted cloud agent can drive on its own cadence in
place of the daemon's internal scheduler, per the operator's preferred substrate order.

## Data model

An additive `intel` Postgres schema (`migrations/0001_intel_schema.sql`) — three tables:
`findings` (the append-with-dedup incident store), `watch_state` (the deterministic-detection
memory that survives restarts), and `runs` (one row per watcher invocation, pruned past a 90-day
retention window). It never references or alters any commerce/public-schema table. The runtime
role is provisioned by `migrations/provision-role.sql` — DML on the `intel` schema, explicitly
revoked from `public` — see Deploying below for the exact apply order.

## Environment

Full list mirrored in `.env.example`. Required: `INTEL_DATABASE_URL`. Every other var is
optional and its watcher leg self-skips (fail-soft, not fail-closed) when absent — a missing
`POSTHOG_API_KEY` disables the `analytics` PostHog leg and the whole `error` watcher, for example.

| var                                                                                                        | default                                     | purpose                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTEL_DATABASE_URL`                                                                                       | — (required)                                | the dedicated Postgres DSN for the `intel` schema                                                                                               |
| `INTEL_HEALTHZ_PORT` / `INTEL_HEALTHZ_HOST`                                                                | `8791` / `0.0.0.0`                          | the local health endpoint bind                                                                                                                  |
| `INTEL_SCHEDULER_ENABLED`                                                                                  | `true`                                      | the internal per-watcher interval scheduler                                                                                                     |
| `INTEL_MIGRATE_ON_BOOT`                                                                                    | `false`                                     | apply the schema migration at boot — dev/local convenience only; the production runtime role is DML-only and can't run it (see Deploying below) |
| `INTEL_CADENCE_*_MS` (seven vars, one per watcher)                                                         | see table above                             | per-watcher interval override                                                                                                                   |
| `INTEL_COMPETITOR_URLS`                                                                                    | —                                           | comma-separated competitor page list (data, not code)                                                                                           |
| `INTEL_GITHUB_ORG`                                                                                         | `caisson-sh`                                | the GitHub org whose public repos are watched                                                                                                   |
| `GITHUB_TOKEN`                                                                                             | —                                           | raises the GitHub API rate limit; unauthenticated works too                                                                                     |
| `POSTHOG_API_KEY` / `POSTHOG_API_HOST` / `POSTHOG_PROJECT_ID`                                              | — / `https://us.posthog.com` / `493539`     | analytics rollup + error tracking                                                                                                               |
| `PLAUSIBLE_API_KEY` / `PLAUSIBLE_API_HOST` / `PLAUSIBLE_SITE_ID`                                           | — / `https://plausible.io` / —              | the Plausible half of the analytics rollup                                                                                                      |
| `TG_BRIDGE_ALERT_URL` / `TG_BRIDGE_ALERT_TOKEN`                                                            | —                                           | the operator's Telegram push sink for error alerts                                                                                              |
| `LINEAR_API_KEY` / `LINEAR_TEAM_ID`                                                                        | —                                           | auto-filed Linear Triage issues for error alerts                                                                                                |
| `INTEL_ALERT_RATE_MAX_PER_WINDOW` / `INTEL_ALERT_TZ` / `INTEL_ALERT_QUIET_START` / `INTEL_ALERT_QUIET_END` | `3` / `UTC` / `0` / `0`                     | the alerting pipeline's rate-cap + quiet-hours policy                                                                                           |
| `INTEL_LLM_ENABLED` / `OPENROUTER_API_KEY` / `INTEL_LLM_MODEL`                                             | `false` / — / `anthropic/claude-sonnet-4.5` | the tier-2 enrichment seam — off unless both are set                                                                                            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                                              | —                                           | tracing export; unset is a fully dormant no-op                                                                                                  |

Secrets are never committed. `.env.example` ships placeholders only; the real `.env` file is
gitignored and lives on the deploy host, injected into the container via `docker-compose.yml`'s
`env_file`.

## Running locally

```
bun install
INTEL_DATABASE_URL=postgres://localhost/intel_dev INTEL_MIGRATE_ON_BOOT=true bun run src/server.ts
```

`INTEL_MIGRATE_ON_BOOT=true` is the local/dev convenience — it applies the schema migration at
boot (idempotent) against a superuser-ish local connection. In production the migration is an
operator step, not a boot step (see Deploying below); leave the flag unset there. The server binds
`/healthz` and starts the scheduler either way. With no other env set, every watcher still runs on
its cadence — the source-specific legs (GitHub, compliance, SOC 2, competitor) work with zero
secrets; the PostHog/Plausible/alerting legs self-skip until their keys are set.

## Deploying (operator act — not part of this build)

1. **Provision the runtime role, as the database owner/superuser, in order:**
   `migrations/provision-role.sql` (creates `intel_role`, grants it `intel`-schema-only DML,
   explicitly revokes `public` schema access) THEN `migrations/0001_intel_schema.sql` (creates
   the tables — `ALTER DEFAULT PRIVILEGES` from the first file means `intel_role` inherits
   access automatically as long as the same owner role runs both, back-to-back). Set
   `INTEL_DATABASE_URL` to a connection string authenticating as `intel_role` — never the
   admin/app DSN. `INTEL_MIGRATE_ON_BOOT` stays `false` (the default): the daemon's own boot
   never attempts the schema DDL its runtime role can't perform.
2. Copy `.env.example` to `.env` on the deploy host, fill in real values, and run
   `docker compose up -d` from this directory (build context is the repo root — see the
   Dockerfile header for why).
3. Land the sanctioned-loopback bind (`127.0.0.1:8791`) and every egress sink this service talks
   to in gridwork-core's security-surfaces ledger in the same change that brings the container
   up (the standing invariant for any new bind or egress sink on the host) — this list is the
   authoritative source for that entry:
   - GitHub API, EUR-Lex, the AI Office guidance page, the HHS OCR breach portal, AICPA
     (the `compliance`/`soc2`/`github` watchers)
   - the configured `INTEL_COMPETITOR_URLS` list (`competitor` watcher)
   - PostHog and Plausible (`analytics` + `error` watchers)
   - the tg-bridge `/alert` endpoint (`TG_BRIDGE_ALERT_URL`, Bearer-authed outbound push —
     `error` watcher's tg-bridge sink)
   - Linear's GraphQL API (`error` watcher's auto-filed Triage issue sink)
   - OpenRouter, only when `INTEL_LLM_ENABLED=true` (the tier-2 enrichment seam)
   - the optional OTel/OTLP collector endpoint, when `OTEL_EXPORTER_OTLP_ENDPOINT` is set
   - the admin-database write path itself (`INTEL_DATABASE_URL`)

## Testing

`bun test ./src` runs every watcher's tier-1 detection logic (including the empty-response-can't-
wipe-a-baseline guard), the findings-store dedup contract (`InMemoryStore`, plus a PGlite-backed
parity test proving `PostgresStore`'s real SQL upsert gives the identical `isNew`/`seen_count`
semantics), each watcher's `.run()`-level wiring (a mid-fetch throw must leave that source's
`watch_state` untouched), the alerting-pipeline wiring, and the scheduler's overlap guard +
never-throws guarantee — all fixture-driven, no live network calls. Live probes against the real
external sources are self-skipping `live/*.live.test.ts` files (`bun run test:live`), matching the
rest of the repo's convention for anything that talks to a real third party.

### Replay + live brief eval lane (`src/eval/`, CAISSON-101/102)

`bun run eval` replays the watcher cassettes deterministically, then composes each operator brief and
judges its actionability through live OpenRouter calls. CI runs this service's lane separately on a
GitHub-hosted runner with the provider key scoped to the eval step; the remaining repo evals stay
secretless and deterministic. With no green-only cassette set committed, this lane self-skips.

The lane grades a HYBRID rubric against a recorded run: **accuracy** (the replayed finding is
byte-identical to the recorded one) and **grounding** (every URL in a finding resolves to a host the
watcher actually fetched) are graded deterministically in code; **actionability** (does the brief tell
the operator what changed, why it matters, and what to do) is graded by a live LLM judge. Model
outputs and verdicts never enter the cassette. Two pooled `defineEval` runs gate against a committed baseline via
`@caisson/ai-evals` — `intel-replay` at threshold 1.0 and `intel-brief-quality` at 0.7, both with a
0.6 Wilson floor (deliberately below the lane's usual 0.8 — a small session-4 sample; raise once
n≥16 findings is proven). The always-run unit tests plus an end-to-end replay
over a handcrafted fixture (`src/eval/__fixtures__/competitor.fixture.json`, which lives OUTSIDE the
cassette dir so discovery never picks it up) keep the harness meaningfully tested with zero cassettes.

**Recording is an operator act** (never CI):

```
bun run src/eval/record.cli.ts [watcher ...]      # default: every watcher; needs live watcher creds
```

It writes one sanitized cassette per watcher to the **pinned path**
`services/intel/__cassettes__/<watcher>.json`, capturing the request/response exchanges (never request
headers), the watch_state it read (a recorded no-op on write — the live daemon's baselines are never
advanced), and the raw findings. **Scrub guarantee:** every known
secret value plus generic Bearer/key-prefixed/email patterns are stripped, and a fail-closed
`assertScrubbed` gate THROWS before write if any secret value survives anywhere in the serialized
cassette. The session-4 operator contract to arm the gate:

1. `bun run src/eval/record.cli.ts` — record cassettes live.
2. `bun run eval:validate` — require deterministic replay, live judged score, and Wilson floor to pass without weakening the missing-baseline gate.
3. Only after step 2 is green, `BLESS=1 bun run eval` — mint the baseline; review the diff.
4. Commit BOTH the cassettes and the baseline in one change. A red run commits neither.
5. **Assert the lane EXECUTES non-skipped** — a skipIf path mismatch is indistinguishable from a green
   pass, so confirm `bun test ./src/eval/intel-briefs.eval.test.ts` reports the case as RUN before
   trusting the gate.
