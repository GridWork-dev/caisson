# SPEC — Perf-wave follow-ups (CAISSON-81 session-hint cookie · CAISSON-82 NFT trace)

**Status: DRAFT — operator lock required; this SPEC does NOT authorize building.** Two Linear
follow-ups minted by the Kickoff-I perf/mobile SHIP audit. Neither is urgent: `/` is at 0.95 with
floors enforced at error level; these are the parked "do it properly" halves of two audit calls.

- **Surface:** `apps/site` (owned-items fetch path, auth cookie mint), `services/license` (the
  dynamic registry path NFT traces), `next.config` tracing config.
- **Tags:** `frontend`, `auth` (the cookie touches the session boundary — security audit fires).

## Item 1 — CAISSON-81: server-minted session-hint cookie (ADR-0310 slice b, the reverted P1)

The hydration diet tried to skip the owned-items fetch for signed-out visitors by reading the
better-auth session cookie client-side — but the cookie is `HttpOnly`, so `document.cookie` reads
empty for EVERYONE and the gate silently disabled owned-item marking for signed-in buyers (the
double-pay guard). The SHIP audit reverted to the unconditional fetch. The proper fix: mint a
**non-HttpOnly, no-PII hint cookie** (`caisson_sess_hint=1`, `Secure`, `SameSite=Strict`, same
expiry as the session) alongside the real session cookie at sign-in, clear it at sign-out; the
owned-items provider skips the fetch when the hint is absent. Fail-open: hint present but session
dead → the fetch runs and returns empty, marking degrades to none — never a false "owned".

Tasks: mint/clear in the better-auth cookie hooks · provider gate reads the hint · regression
test: signed-in marking works with HttpOnly session cookies (the exact failure the audit caught)
· signed-out renders zero `/api/purchases` requests.

## Item 2 — CAISSON-82: NFT whole-project trace (services/license dynamic registry path)

`next build` emits `Encountered unexpected file in NFT list` on the
`apps/site/app/api/ask/route.ts → services/license/dist/server.js` chain —
`services/license/src/server.ts` resolves `registry/index.json` dynamically, so Next's file
tracing walks the whole project. ADR-0311 already added `outputFileTracingRoot` + excludes
(measured-honest); the residual is the license-side dynamic `resolve()`. Fix per the issue:
`turbopackIgnore` (or an explicit static import boundary) on the dynamic path so tracing stops
treating the project root as reachable. Verify: `next build` clean of the NFT warning, standalone
image size unchanged or smaller (the 181MB standalone was the ADR-0311 finding).

## Verify

Item 1: the audit's regression test green + a live signed-in owned-marking check on the next
deploy. Item 2: warning-free `next build` in CI logs.

## Effort / value

S each. Value: item 1 removes a per-visitor wasted authed fetch (the last parked hydration-diet
slice that's actually safe); item 2 kills a build warning that masks real NFT regressions.
