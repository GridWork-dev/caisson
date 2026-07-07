# ADR-0286 — Admin intelligence layer: local standing daemon, surfaced on admin.caisson.sh

**Status:** accepted · 2026-07-07 (operator-locked, eighth-sitting picker over the
admin-intel/catalog/roadmap research memo — `outputs/research/admin-intel-catalog-roadmap-memo-2026-07-07.md`).
Extends ADR-0140 (admin control-plane) and ADR-0151 (alerting pipeline). Append-only;
supersede with a later ADR, never edit. **Tags:** `infra`, `observability`, `external-system`.

## Context

The research fanout found the gap is wiring, not building: exa `/monitors`, `tg-bridge /alert`,
the PostHog MCP (error-tracking domain unused), a built-but-dormant `packages/alerting`
pipeline, the `gw dream` synthesis pattern, two never-scheduled intel agents, and the inert
`aeo-probe.yml` all exist. Prod errors land nowhere durable; competitors, compliance-framework
updates, and GitHub traction have no watcher. The memo's lean default (wire-dormant only, no
new surface) was overridden by the operator: hosting a standing daemon locally on `<host>`
makes the marginal cost of the full build ~zero, and the findings belong on the admin
control-plane, not in Telegram alone.

## Decision

1. **Standing intel daemon, local container.** One containerized service on `<host>`
   (single container, docker-compose managed, env from the sanitized-mirror pattern) that owns
   ALL watcher/analyzer legs: competitor watch (exa monitors), compliance-framework watch,
   GitHub traction, analytics rollups (PostHog + Plausible), error triage, and the weekly
   synthesis. Cheap deterministic detection first; an LLM pass fires only on a detected change
   (two-tier pattern).
2. **Framework coverage = all four + monthly SOC2:** OSCAL `releases.atom` (zero-LLM version
   bump) · EU AI Act (EUR-Lex RSS + AI Office guidance page) · HIPAA breach portal
   (`ocrportal.hhs.gov`) · monthly AICPA SOC2 resources-page check. A detected change triggers
   a Claude pass against `packages/compliance` mappings ("does our mapping still hold").
3. **Error triage:** PostHog error-tracking (and/or OTel/SigNoz traces) → dogfood
   `packages/alerting` (dedup/rateCap/quietHours) → `tg-bridge /alert` + an auto-filed Linear
   Triage issue with a Haiku root-cause brief (the ADR-0206 escalation pattern).
4. **Surfaced on admin.caisson.sh.** The daemon PUSHES findings to the admin Postgres
   (Railway) over an authed write path — the tailnet-only box can reach Railway, never the
   reverse. A new admin intel page renders the findings feed (competitor diffs, framework
   changes, error rollups, traction, AEO); `tg-bridge` remains the push-alert channel.
   **Sequencing:** the admin page builds AFTER the current admin merge queue (OAuth ADR-0283 +
   catalog ADR-0284) drains — no third parallel writer on `apps/admin`.
5. **Scheduling substrate (operator preference order):** Claude Code Routines / hosted cloud
   agents where the job fits (≥1h cadence, no tailnet dependency) → otherwise the local
   container's own scheduler. GitHub-Actions crons are NOT the home (rejected option);
   `aeo-probe.yml` stays where it is and just gets armed.
6. **Dormant wiring rides the program:** arm `aeo-probe` (repo secret), point exa monitors at
   the competitor set, schedule `gw-market-intel` + `gw-product-insights` dispatches.

## Consequences

- A new standing surface holding operator credentials (exa, PostHog, Linear, OpenRouter, the
  admin-DB write path) runs on the box: it lands rows in gridwork-core
  `identity/security-surfaces.md` (sanctioned binds + egress sinks) in the same change that
  deploys it, per the standing invariant. Deploy to the box is an operator-gated DEPLOY act.
- The admin DB gains an intel schema (findings, runs, sources) — additive, never touching
  commerce tables.
- SPEC before code: `outputs/specs/admin-intel/SPEC.md` locks the data model, the daemon↔admin
  contract, and the per-watcher cadences; the build follows it.
- Rejected: GitHub-Actions-as-cron-home (fork 3), wire-dormant-only and daemon-less shapes
  (fork 1) — superseded by this full-stack lock. Sentry-Seer-style buy stays the fallback if
  error volume ever outgrows the triage pipeline.
