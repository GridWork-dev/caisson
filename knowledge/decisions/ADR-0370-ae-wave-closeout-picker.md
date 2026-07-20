# ADR-0370 — A+E close-out wave picker (train ride, /updates section, aeo dispatch-only, four ride-alongs)

**Status:** accepted · 2026-07-19/20 (the "full A section + E" close-out picker, operator-locked
in two rounds). Extends ADR-0235 (glossary Fork-A lock convention) and ADR-0254 (AEO probe loop);
records the fork answers the consolidated close-out wave executed. Append-only; supersede with a
later ADR, never edit.
**Tags:** (none — site content + internal tooling surface; REVIEW-only at SHIP).

## Context

The operator directed a full execution pass over every ungated build item plus all repo-wide
hygiene residue ("full A section + E"), with operator-console acts (creds/dashboards) stacked
last and deploy/push/merge running autonomously. Four forks and a ride-along menu needed locks
before execution; a second round locked the glossary batch-3 term set. The wave was subsequently
consolidated onto one branch during the 2026-07-20 GitHub Actions outage (one PR instead of
three, atomic commits preserved).

## Decision

| Fork                        | Lock                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Version train**           | **Ride now** — dispatch `version-pr` so the accumulated changesets (auth minor, site patches, the 53-package cutover patch, the wave's additions) consume in one train rather than waiting for a later trigger.                                                                                                                                                                                                                                                   |
| **compliance-updates page** | The struck depth-page record's useful content lands as a **coverage-window explainer section on `/updates`** — no standalone catalog page for a subscription anchor (it is not a `MODULE_PRICES` id; the ADR-0368 strike right stands).                                                                                                                                                                                                                           |
| **AEO probe workflow**      | `.github/workflows/aeo-probe.yml` goes **dispatch-only** (cron removed). The cadence is local operator-key runs (`bun tooling/scripts/aeo-probe.ts` with the env-store OpenRouter key) — the GitHub-secret copy of the key is never provisioned; the 2026-07-19 baseline snapshot was produced exactly this way.                                                                                                                                                  |
| **Ride-alongs**             | ALL four menu items ride: **AuditKit-gap category research round** (competitor sweep → 5 draft SPEC stubs, `outputs/specs/compliance-gap-candidates/`, each awaiting its own operator SPEC-lock) · **dep-digest transitive v2** (bun.lock reverse-BFS buyer-impact, superseding ADR-0369's direct-only v1 scope) · **CAISSON-129 closed** with rationale (the finding it drafted was consumed by the same sitting's Renovate fix) · **glossary batch 3** (below). |
| **Glossary batch-3 Fork-A** | A **NEW Fork-A lock of all 7 candidate terms** per the ADR-0235 convention: `durable-outbox` · `idempotency-key` · `canonical-json` · `additional-authenticated-data` · `pii-redaction` · `prompt-injection` · `deterministic-replay`. Floor moves 43 → 50; the ADR-0235 content laws (40-60-token definitions, real snippet regen, same-cluster related links) apply unchanged.                                                                                  |

## Consequences

- The dep-digest watcher's buyer-impact leg reports `Direct: … · Transitive-only: …` (capped,
  explicit degraded-null state when bun.lock parsing fails); ADR-0369's "direct deps only, v1"
  scope row is superseded in that one respect — everything else in 0369 stands.
- The AEO tracking doc's cadence language changes from "monthly cron" to dispatch-only/local;
  cost framing becomes per-run, not per-month.
- The glossary count pin moves to 50; any future addition still requires a fresh Fork-A lock.
- ADR ceiling moves to 0370.
