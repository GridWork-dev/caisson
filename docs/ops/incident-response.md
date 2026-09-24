---
updated: 2026-09-24
status: live
grounds:
  - docs/ops/db-restore.md
  - packages/kernel/src/read-only.ts
  - infra/terraform/waf.tf
  - services/betterstack-adapter/README.md
---

# Incident response runbook (CAISSON-57)

A single-operator runbook: severity, who gets paged, and the concrete recovery levers this repo
actually has. This is a RUNBOOK — operator-executed, not autonomous (DEPLOY-class per
`identity/doctrine.md`'s Autonomy line). Nothing here runs inside the SPEC→PLAN→EXECUTE→VERIFY→
SWEEP→SHIP loop.

## Severity levels

| Level                   | Definition                                                                                                  | Example                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEV1 — service down** | A production surface is unreachable or returning errors for all/most requests. Revenue- or trust-affecting. | `caisson.sh` 5xx-ing site-wide; the license issuer down (buyers can't activate purchases); the Paddle webhook 5xx-ing (grants silently stop landing).                      |
| **SEV2 — degraded**     | The service is reachable but a real feature is broken or materially slow for a subset of requests/users.    | The dashboard's updates-window read is stale/wrong; one Railway service crash-looping while its siblings are fine; a job queue (pg-boss) backing up.                       |
| **SEV3 — minor**        | Cosmetic, isolated, or self-healing. No buyer-facing functional loss.                                       | A single transient 502 on cold start (see `docs/archive/429-root-cause-2026-07-09.md`'s "Not the same issue" section for a worked example); a stale admin dashboard chart. |

Severity can escalate — reassess if a SEV2/3 doesn't resolve within its expected window (a
crash-looping service that doesn't recover after 2-3 restart cycles is a SEV1, not a persistent
SEV2).

## Comms + escalation

This is a single-operator system — there is no on-call rotation. "Escalation" means: the alert
reaches the operator through every wired channel, redundantly, so a channel outage doesn't
silence a real incident.

**Alert reach (as of this wave, CAISSON-53):**

- **Discord `#ops-alerts`** — `packages/alerting`'s `createDiscordChannel`, wired into
  `services/license`'s pg-boss job-failure alerting and `services/intel`'s watcher-failure
  alerting (env-gated on `DISCORD_OPS_WEBHOOK_URL`).
- **tg-bridge** — the existing operator Telegram bridge (`services/intel/src/sinks.ts`'s
  `createTgBridgeChannel`); pre-dates this wave, still live for the `intel` error-triage watcher.
- **Better Stack (uptime) → email**, reshaped to the same Discord channel via
  `services/betterstack-adapter` (see its README) — external, black-box uptime checks on
  `caisson.sh` and the license `/health` endpoint, independent of anything running inside the
  Railway fleet (so a total-platform outage still pages).

A SEV1 gets triaged immediately on whichever channel fires first — do not wait for a second
confirming alert. A SEV2/3 can wait for the operator's next natural check-in unless it's trending
toward SEV1.

## Recovery levers

### 1. Generic Railway rollback (code-level regression)

For "the last deploy broke something" — revert the RUNNING CODE without a DB action.

1. **Identify the last-known-good deployment.**
   ```bash
   railway deployment list --service <service> --limit 20
   ```
   (aliases: `railway deployments`). Each row is `<deployment-id> | <STATUS> | <timestamp>` — find
   the last `SUCCESS` row before the regression.
2. **Roll back via the dashboard** (Railway Deployments tab → the three-dot menu on that prior
   deployment → **Rollback** → confirm). This is a dashboard-only action today — there is no CLI
   subcommand that reverts to an ARBITRARY prior deployment. Rollback restores both the Docker
   image and the custom variables that deployment ran with.
   - **Caveat:** deployments older than the plan's retention policy are not rollback-eligible (the
     option won't appear in the UI) — check the retention window before counting on an old
     deployment being available.
3. **`railway redeploy`** is a DIFFERENT, narrower tool — it only re-triggers the **current/latest**
   deployment (same code, fresh container). Use it for "the service crashed / picked up a stale env
   var and needs a clean restart," never as a substitute for rolling back to older code.

This covers the 6 Railway services in the fleet (`caisson-site`, `caisson-demos`,
`caisson-license`, `caisson-admin`, `caisson-docs`, `caisson-support-bot`) and the registry Worker (Cloudflare —
redeploy from the last-known-good commit via `registry/worker/deploy.sh`, there is no Cloudflare
dashboard rollback equivalent to Railway's).

### 2. Database restore (data-level incident — a bad migration, an accidental DROP/DELETE)

A code rollback does not undo a bad write. See **`docs/ops/db-restore.md`** — the operative,
rehearsed restore path is the logical `pg_dump`/`pg_restore` procedure (`docs/operations.md` §9).
Railway native PITR was evaluated and DECLINED at the 2026-07-11 backup picker (daily snapshots +
rehearsed logical restore instead); PITR's mechanics are kept in `db-restore.md` as reference only,
not the current procedure.

### 3. Read-only containment (data-integrity incident, buys time before a restore)

`packages/kernel/src/read-only.ts` ships `assertNotReadOnly(mode, action)` — a fail-closed gate a
mutation entrypoint calls FIRST, before touching the DB, so flipping a system mode to
`read_only` freezes every write the gate guards without taking the service down (reads keep
working). **LIVE since 2026-07-09 (ADR-0300, Kickoff-H W3):** wired to an admin-flipped mode
source (the latest `admin_action_log` `system_mode` row, `active` by default) via
`apps/admin/src/app/api/admin/system-mode/route.ts`. Flipping to `read_only` freezes every gated
write while reads keep working; the un-arming flip stays ungated so it can't brick itself.
Deliberately does NOT freeze on `subscription.past_due` (won't-fix per ADR-0300). This is the
fastest containment lever for "something is actively corrupting data and I need to stop writes NOW
while I figure out the restore target" — faster than a full service takedown, and it keeps the
site up in read-only mode for buyers browsing/checking status. The fallback containment (e.g. a
dunning-state trigger not covered by the admin flip) is pulling the affected service's traffic at
the Railway/Cloudflare level (effectively a SEV1-grade action — treat it as a last resort, not a
first response).

## After the incident

- Note what fired, what didn't, and how long detection took — feed it back into the alert wiring
  (a SEV1 nobody heard about for 20 minutes is an alerting gap, not just a service bug).
- A code-level fix always gets an atomic commit + (if it changed a security/auth/secrets/
  external-system/data-migration surface) a follow-up ADR per `identity/doctrine.md`'s tag
  taxonomy — even a hotfix rollback path is not exempt from the doctrine's audit-on-merit rule.
