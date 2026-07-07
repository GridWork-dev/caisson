# @caisson/service-intel

The standing operator intelligence daemon. It watches a fixed set of external signals —
compliance-framework updates, competitor pages, GitHub traction, product analytics, and
production errors — detects a change cheaply and deterministically first (a content hash, a
release-version compare, or a set difference — zero tokens spent), and appends the result as a
durable finding in the admin database's `intel` schema. An optional LLM enrichment pass can run
on top of a detected change, but it is off by default: every cadence tick that finds nothing
changed spends no tokens at all. Production-error signal additionally routes through
`@caisson/alerting` (dedup / rate-cap / quiet-hours) to the operator's Telegram bridge and an
auto-filed Linear issue.

This is a producer only. It pushes findings into Postgres over an authed connection string; it
never accepts an inbound API call beyond a loopback health check. The admin control-plane app
reads the `intel` schema to render the findings feed — that page is a separate, later piece of
work and is not part of this service.

## What it watches

| watcher      | default cadence | detects                                                                                                                               |
| ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance` | 24h             | NIST OSCAL + oscal-content release bumps, EU AI Act (EUR-Lex + AI Office guidance) content changes, new HHS OCR breach-portal entries |
| `soc2`       | 30d             | AICPA SOC 2 resources-page content changes                                                                                            |
| `competitor` | 24h             | content changes on a configured list of competitor pages                                                                              |
| `github`     | 12h             | star/fork gains across the `caisson-sh` org's public repos                                                                            |
| `analytics`  | 24h             | a daily rollup from PostHog + Plausible (always emits one dated row)                                                                  |
| `error`      | 15m             | new or spiking PostHog error-tracking groups, routed through the alerting pipeline                                                    |

Every watcher is also independently runnable without the scheduler:

```
bun run src/cli.ts run <compliance|soc2|competitor|github|analytics|error>
```

This is the seam a Claude Code Routine or a hosted cloud agent can drive on its own cadence in
place of the daemon's internal scheduler, per the operator's preferred substrate order.

## Data model

An additive `intel` Postgres schema (`migrations/0001_intel_schema.sql`) — three tables:
`findings` (the append-with-dedup incident store), `watch_state` (the deterministic-detection
memory that survives restarts), and `runs` (one row per watcher invocation). It never references
or alters any commerce/public-schema table. Apply it against `INTEL_DATABASE_URL` as a role that
holds DML on the `intel` schema and nothing else.

## Environment

Full list mirrored in `.env.example`. Required: `INTEL_DATABASE_URL`. Every other var is
optional and its watcher leg self-skips (fail-soft, not fail-closed) when absent — a missing
`POSTHOG_API_KEY` disables the `analytics` PostHog leg and the whole `error` watcher, for example.

| var                                                                                                        | default                                 | purpose                                                     |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `INTEL_DATABASE_URL`                                                                                       | — (required)                            | the dedicated Postgres DSN for the `intel` schema           |
| `INTEL_HEALTHZ_PORT` / `INTEL_HEALTHZ_HOST`                                                                | `8791` / `0.0.0.0`                      | the local health endpoint bind                              |
| `INTEL_SCHEDULER_ENABLED`                                                                                  | `true`                                  | the internal per-watcher interval scheduler                 |
| `INTEL_CADENCE_*_MS` (six vars, one per watcher)                                                           | see table above                         | per-watcher interval override                               |
| `INTEL_COMPETITOR_URLS`                                                                                    | —                                       | comma-separated competitor page list (data, not code)       |
| `INTEL_GITHUB_ORG`                                                                                         | `caisson-sh`                            | the GitHub org whose public repos are watched               |
| `GITHUB_TOKEN`                                                                                             | —                                       | raises the GitHub API rate limit; unauthenticated works too |
| `POSTHOG_API_KEY` / `POSTHOG_API_HOST` / `POSTHOG_PROJECT_ID`                                              | — / `https://us.posthog.com` / `493539` | analytics rollup + error tracking                           |
| `PLAUSIBLE_API_KEY` / `PLAUSIBLE_API_HOST` / `PLAUSIBLE_SITE_ID`                                           | — / `https://plausible.io` / —          | the Plausible half of the analytics rollup                  |
| `TG_BRIDGE_ALERT_URL` / `TG_BRIDGE_ALERT_TOKEN`                                                            | —                                       | the operator's Telegram push sink for error alerts          |
| `LINEAR_API_KEY` / `LINEAR_TEAM_ID`                                                                        | —                                       | auto-filed Linear Triage issues for error alerts            |
| `INTEL_ALERT_RATE_MAX_PER_WINDOW` / `INTEL_ALERT_TZ` / `INTEL_ALERT_QUIET_START` / `INTEL_ALERT_QUIET_END` | `3` / `UTC` / `0` / `0`                 | the alerting pipeline's rate-cap + quiet-hours policy       |
| `INTEL_LLM_ENABLED` / `OPENROUTER_API_KEY` / `INTEL_LLM_MODEL`                                             | `false` / — / a small model             | the tier-2 enrichment seam — off unless both are set        |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                                              | —                                       | tracing export; unset is a fully dormant no-op              |

Secrets are never committed. `.env.example` ships placeholders only; the real `.env` file is
gitignored and lives on the deploy host, injected into the container via `docker-compose.yml`'s
`env_file`.

## Running locally

```
bun install
INTEL_DATABASE_URL=postgres://localhost/intel_dev bun run src/server.ts
```

The server applies the migration on boot (idempotent), binds `/healthz`, and starts the scheduler.
With no other env set, every watcher still runs on its cadence — the source-specific legs (GitHub,
compliance, SOC 2, competitor) work with zero secrets; the PostHog/Plausible/alerting legs
self-skip until their keys are set.

## Deploying (operator act — not part of this build)

1. Apply `migrations/0001_intel_schema.sql` against `INTEL_DATABASE_URL` as the least-privilege
   intel role.
2. Copy `.env.example` to `.env` on the deploy host, fill in real values, and run
   `docker compose up -d` from this directory (build context is the repo root — see the
   Dockerfile header for why).
3. Land the sanctioned-loopback bind (`127.0.0.1:8791`) and the egress sinks this service talks to
   (GitHub, EUR-Lex, the AI Office guidance page, the HHS OCR breach portal, AICPA, the configured
   competitor URLs, PostHog, Plausible, Linear, OpenRouter when the enrichment seam is armed, and
   the admin-database write path) in gridwork-core's security-surfaces ledger in the same change
   that brings the container up — the standing invariant for any new bind or egress sink on the
   host.

## Testing

`bun test ./src` runs every watcher's tier-1 detection logic, the findings-store dedup contract,
and the alerting-pipeline wiring against fixtures — no live network calls. Live probes against the
real external sources are self-skipping `live/*.live.test.ts` files (`bun run test:live`), matching
the rest of the repo's convention for anything that talks to a real third party.
