# ADR-0415 — Ratify the apps/admin Cloudflare Access re-coupling; Access is a startup requirement again

- **Date:** 2026-08-25
- **Status:** Accepted (operator lock in the caisson-8f session pane, ask CAI-ASK-4, 2026-08-25 — "Ratify with an ADR")
- **Supersedes (in part):** ADR-0283 — specifically its claim that `apps/admin` "no longer depends
  on [Cloudflare Access] either way". The better-auth session gate ADR-0283 introduced is
  **unchanged and still authoritative**; only the no-dependency claim is retired.
- **Parent:** ADR-0140 (edge-alone posture) · ADR-0204 (CF-Access-JWT middleware) · ADR-0283
  (better-auth session gate, code-live-first / gate-drop-second) · the T20/T21/T22/T27 Cloud Run
  prerequisites shipped in PR #448
- **Ships in:** PR #448 (`498b279c`), already merged. This ADR records a decision the code already
  made; it does not change behaviour.

## Context

PR #448 rewrote `apps/admin/src/proxy.ts` for the Cloud Run topology. The rewritten
`createAdminProxy` resolves **two** configurations at module load:

```ts
const originGate = options.originGate ?? loadOriginGateConfig(process.env);
const access = options.access ?? loadCloudflareAccessConfig(process.env);
```

`loadCloudflareAccessConfig` throws `ConfigError("Cloudflare Access requires a team domain and
application audience")` when `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` is absent, and it
deliberately mirrors the origin gate's fail-closed arming: an absent mode stays armed, and **no
production value can disable Access**. Only an exact development/test opt-out bypasses it. The
proxy then calls `verifyCloudflareAccessRequest` on every request that is not the `/healthz` canary.

The proxy this replaced was 77 lines and contained **no** `loadCloudflareAccessConfig`, **no**
`loadOriginGateConfig`, and no `CF_ACCESS` reference at all. Its header comment stated the
ADR-0283 position directly:

> CF-Access can keep gating at the edge in parallel during the ADR-0283 rollout window
> (code-live-first, gate-drop-second) — **this app no longer depends on it either way.**

So #448 reversed a locked ADR's stated direction without a superseding ADR. Nothing failed as a
result — `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` were already present on
`caisson-admin`/production (pre-existing, confirmed against the applied service by gridwork-infra),
so admin boots.

**The cost was not an outage; it was diagnostic.** When the post-merge `deploy-railway` run failed,
three sessions spent real time on a missing-`CF_ACCESS` hypothesis precisely because the source and
the locked ADR disagreed about whether admin depends on Access. The actual cause was unrelated (see
below). A contradiction between a locked ADR and shipped source is not inert — it is a trap that
costs time at exactly the moment when time is short.

## Decision

**Ratify the re-coupling.** `apps/admin` requires Cloudflare Access configuration at startup and
verifies an Access assertion per request, in addition to the ADR-0283 better-auth session gate.

Rationale, in the order that decided it:

1. **The Cloud Run topology puts admin behind Access.** #448 exists to prepare that topology.
   Edge-plus-application verification is the stronger posture there, and the fail-closed arming
   matches the origin gate's, so the two gates now behave consistently rather than one silently
   degrading.
2. **Reverting would weaken security to preserve a document.** The alternative on the table was
   making the Access load non-fatal to keep ADR-0283 literally true. That trades a real control for
   documentary tidiness, which is the wrong direction.
3. **The defect was the undocumented reversal, not the code.** Recording it costs one file.

### What ADR-0283 still owns

ADR-0283's substance is untouched. `apps/admin` renders cross-tenant business data, every route is
gated, and **better-auth session verification remains the authorization mechanism** — Access is a
second, earlier gate, not a replacement for it. `/api/auth/*`, `/login`, and the health canary
remain the only session-exempt routes. The "gate-drop-second" plan is retired: the edge gate stays.

### Not decided here

The health-path question is **separate and still open** (CAISSON-208). The failed post-merge Railway
deploy was caused by the origin gate now covering `/healthz` — `apps/site/lib/origin-gate.test.ts`
asserts a header-less `/healthz` returns 403 at exactly the deployed configuration, and Railway's
internal probe cannot carry `x-gridwork-origin-secret`. That is deliberate, tested behaviour that
happens to be incompatible with Railway's probe; it is not a Cloudflare Access question and this
ADR does not settle it.

Also not decided: whether `apps/demos` should arm the origin gate at all. Nothing routes to it
publicly and the Worker never sends the header, so an armed gate there refuses every request,
including `apps/site`'s internal `DEMOS_ORIGIN_URL` calls. Tracked on CAISSON-208.

## Consequences

- `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are **operational requirements** for
  `caisson-admin` in production. Removing either takes admin down at startup, not at request time.
  They are Railway service variables, invisible to a repository grep — that invisibility is itself a
  documented hazard (CAISSON-208 carries the same note for `ORIGIN_SECRET`).
- Any future move to drop Access from admin now needs its own superseding ADR. "Gate-drop-second"
  is no longer a standing plan that a later change can quietly execute.
- The Cloud Run deploy path inherits both gates. A Cloud Run revision without the Access pair fails
  readiness rather than serving unauthenticated.

## Why this is worth an ADR at all

The generalizable form, and the reason the operator ruled to file rather than defer: **a locked ADR
that contradicts shipped source is a live defect in the decision record, even when the code is
right.** It reads as an unresolved question to every future reader, and it sent three sessions down
a dead hypothesis on the night it shipped. The record is a load-bearing artifact, not a courtesy.
