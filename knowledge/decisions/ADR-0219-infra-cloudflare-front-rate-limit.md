# ADR-0219 — infra: Cloudflare front rate-limit + WAF for the Railway fleet

**Status:** accepted · 2026-07-02 (deferred-respec picker round, operator-locked).
**Relates:** SPEC `outputs/specs/deferred-respec/SPEC-cloudflare-front-rate-limit.md` (the locked
draft) · realizes the DEPLOY-class edge deferral filed by ADR-0204 · does **not** supersede
ADR-0204's app-level `X-Real-IP` + `checkGlobal` limiters (they stay, unchanged — the edge is
additive defense-in-depth).

## Context

The Railway fleet fronts caisson.sh/www/admin through Cloudflare (proxied) while `docs-api` and
`license` are grey/DNS-only. ADR-0204 shipped app-level rate limiting and deferred the edge layer.
The Paddle webhook must never be rate-limited or challenged.

## Decision (two forks, operator-locked)

- **CF-1 = (a):** flip `docs-api` to proxied; **`license` stays grey/DNS-only** — its grey posture
  already satisfies "Paddle is never challenged", so zero webhook-class risk is introduced.
- **CF-2 = Free tier now:** ship the Free-plan rate-limit rule + WAF managed rules immediately;
  evaluate Pro only once real traffic exists. Dollar pricing was NOT verified in research — the
  operator confirms plan cost at upgrade time, not now.

**Prerequisite:** the `CLOUDFLARE_API_TOKEN` scope must be widened with Zone:WAF:Edit before
`cloudflare_ruleset` applies (current scope is DNS+Pages only; terraform 403s without it).

**DEPLOY boundary:** authoring the terraform + rules is EXECUTE-class; `terraform apply` and the
docs-api DNS flip are DEPLOY-class — operator-executed, never inside the autonomous cycle
(doctrine: SHIP stops at the merged PR).

## Rejected

- **(b) flip both + Paddle source-IP skip rule** — requires Business-tier skip rules and an
  ongoing Paddle IP re-sync obligation for coverage the grey posture already provides.
- **(c) rules-only on already-proxied hosts** — leaves docs-api unfronted; the (a) flip is cheap
  and webhook-safe.
