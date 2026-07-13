---
updated: 2026-07-13
status: archived
---

# Security round-2 findings — 2026-07-10 (Kickoff K)

Round-2 targets **round-1's own coverage gaps** (`strix-findings-2026-07-01.md` §Coverage gaps):
admin black-box (new GitHub OAuth), authed buyer/owner/seat flows, the support-bot command surface,
the registry Worker, DoS/body-size, and supply-chain — plus the close-out's open **registry-Worker
429 live-proof** item. Round-1's 6 findings stay fixed; this pass hunts what round-1 missed.

Two methods run in parallel: a **white-box multi-agent audit** (in-harness Claude Code agents,
Opus finders + per-finding adversarial Fable verdicts on the money/license/crypto seams — the
authoritative result, full source access) and a **bounded Strix black-box run** (external attacker,
ChatGPT-sub engine, all 7 live surfaces — the cross-check). Findings adversarially verified before
any change; fixes landed in-branch through the in-session SHIP-audit lane.

## Precondition gate (the scan is invalid without these)

| #   | Precondition                                                                      | Status                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CF-Access service-token (`CAISSON_E2E_CF_CLIENT_ID`/`_SECRET`) for the e2e-prober | ✅ present in `~/.gridwork/caisson.env`                                                                                                                                                                                                                                                                                                                          |
| 2   | Admin OAuth allowlist scan identity                                               | ⚠️ **partial** — `ADMIN_GITHUB_ALLOWED_USER_IDS` is set on `caisson-admin` but holds **1 id** (the operator's own). Admin auth is GitHub-OAuth-only (no scriptable sign-in), so an authenticated admin session can't be minted by an automated probe. The authed-admin black-box leg is closed **white-box + unauth fail-closed probe** instead (see §Coverage). |
| 3   | `codex login --device-auth` for the Strix runner                                  | ✅ valid token (refreshed 2026-07-09), ChatGPT bridge up (`gpt-5.4`)                                                                                                                                                                                                                                                                                             |

## Result summary

**No money / license / crypto / authz vulnerability found.** The highest-risk seams
(admin OAuth + allowlist, registry-Worker license filtering, support-bot billing-grant, authed
site owner/seat flows) audited **clean**. The three confirmed findings are all DoS / supply-chain
**hardening**, fixed in-branch. The registry-Worker rate limit is **proven firing live**.

| Finding                                                               | Seam         | Sev (verified) | Disposition                                        |
| --------------------------------------------------------------------- | ------------ | -------------- | -------------------------------------------------- |
| K-01 · apps/site unbounded request body (`/api/ask`, `/api/waitlist`) | dos          | medium         | **fixed in-branch**                                |
| K-02 · license/docs Bun.serve inherits 128 MiB default body cap       | dos          | medium         | **fixed in-branch**                                |
| K-03 · Docker base images pinned to mutable tags, not digests         | supply-chain | info           | **fixed in-branch** (Renovate `docker:pinDigests`) |
| K-R1 · discord/backfill seat-visible role sync                        | authz        | — (refuted)    | not a vuln — dispositioned in-code                 |

## Confirmed findings + fixes

### 🟡 MEDIUM — K-01 · Unauthenticated routes buffer the whole body before any gate

- **Where:** `apps/site/lib/ask-ai/handler.ts` (`handleAsk`, was line 136) + `apps/site/app/api/waitlist/route.ts` (was line 47) — CWE-770.
- **Bug:** `apps/site` ships no `middleware.ts`/`proxy.ts` and sets no body-size option; a self-hosted Next App Router route handler imposes no built-in body limit (the 1 MB default is Pages-Router/Server-Action only, neither of which governs `app/**/route.ts`). Both routes are public + unauthenticated and call `req.json()` as their first action — for `/api/ask` that is _before_ the Turnstile gate. Neither has an inbound rate limiter, and the one CF edge rate-limit rule is scoped to `/query` + `/api/auth/*` only. Concurrent large POSTs buffer unbounded in memory → OOM the single Next process (marketing + docs + dashboard together).
- **Fix:** a content-length precheck + a `req.text()`-length check → 413 before parse, cap 16 KiB (generous for the bounded bodies), matching the repo's `registry/worker/revocations-put.ts` `MAX_BODY_BYTES` idiom. Regression test: `handler.test.ts` "413 on an oversized body, rejected before parse/Turnstile".

### 🟡 MEDIUM — K-02 · Bun.serve inherits the 128 MiB default request-body cap

- **Where:** `services/license/src/server.ts` (`Bun.serve`, was line 233) + `services/docs/src/server.ts` (was line 140) — CWE-770.
- **Bug:** `POST /webhook` on the license issuer is the Paddle MoR destination — the HMAC over the raw body _is_ the auth, so `await req.text()` buffers the body _before_ any credential check. `Bun.serve` was started with no `maxRequestBodySize`, inheriting Bun's 128 MiB default (~250× any real Paddle event). `license.caisson.sh` is DNS-only/grey (never CF-proxied), so no edge WAF caps it. The docs `/query` reads its body after the bearer check (not pre-auth) but shares the same missing cap.
- **Fix:** `maxRequestBodySize: 512 * 1024` on both `Bun.serve` calls — Bun rejects oversized bodies with 413 before buffering, 512 KiB matches the repo's `MAX_BODY_BYTES` precedent while sitting ~250× below the default. The docs `.reload()` swaps only the handler, so the server-level cap persists.

### ⚪ INFO — K-03 · Docker base images pinned to mutable tags, not digests

- **Where:** all 8 Dockerfiles (`apps/*`, `services/*`, `packages/cli/templates/deploy/*`) — CWE-1104. (All GitHub Actions verified **already SHA-pinned** — this gap is Docker-layer only.)
- **Bug:** base images pin by mutable tag (`oven/bun:1.3.14-slim`, `python:3.12-slim`, `ghcr.io/astral-sh/uv:0.11.18`), not `@sha256:` digest. A compromised upstream publisher (or a MITM'd pull) could re-push a backdoored image under the same tag with no CI signal. Defense-in-depth only — no in-repo exploit primitive, images already patch-pinned, Renovate already bumps them weekly.
- **Fix:** `docker:pinDigests` added to `renovate.json` (Renovate resolves + maintains the digests for the 5 first-party images). A `packageRules` entry keeps the 3 **buyer-facing** `create-caisson` scaffold templates tag-pinned — a frozen Caisson digest would rot in downstream buyer repos that have no Renovate to bump it.

## Refuted (dispositioned, not silently dropped)

### K-R1 · `POST /api/discord/backfill` seat-visible role sync — **not a vulnerability**

A seat member can sync the org's paid Discord roles onto **their own** linked Discord. Adversarially
verified as a **false positive**: the route writes no shared org state and derives the Discord id from
the caller's _own_ better-auth account list (never a request param), so it is not the CWE-863
owner/seat class the round-1 `vuln-0006` fix addressed (per ADR-0208, the owner-gate protects _writes
to shared org state_ — BYOK, attestations, subscription cancel). A seat inheriting the community roles
for the tier the org already paid for is correct product behavior; an owner gate would be a
product-policy fork, not a security fix. Dispositioned with an in-code comment on the route so a
future audit doesn't re-derive the same false positive.

## Registry-Worker rate-limit — live 429 proof (close-out open item → CLOSED)

The close-out's open verification: CF's native `simple` ratelimiter is per-edge-server approximate, so
round-1's 320-req burst produced **zero** 429s. Proven firing here with a **sanctioned** vegeta run
(documented constant rate, not a raw burst) against the catalog class (limit 300/60s per
`cf-connecting-ip`):

| Run (vegeta v12.12.0)  | 200 | 429  |
| ---------------------- | --- | ---- |
| 100/s × 20s (2000 req) | 340 | 1660 |
| 250/s × 20s (5000 req) | 301 | 4699 |

The 429 is the **Worker's** app-level deny — `HTTP/2 429`, body `{"error":"rate_limited"}` (24 bytes),
security headers matching `rate-limit.ts` `rateLimitedResponse()` — **not** a CF edge challenge. The
200s cap at ~300 (the 60s budget), everything past it is 429. Round-1's negative result was a
load-_shape_ artifact (too spread across the per-server-approximate limiter); a sustained single-IP
rate concentrates >300 on one CF edge machine in-window and the limiter denies. **The limit is real
and enforced — no re-tune needed.**

## Coverage — closed vs. still-open

- **Admin black-box (new OAuth):** unauth surface probed live — `/business` and every page route
  fail closed (307 → `/login`), `/healthz` ready; white-box audit of the allowlist parse
  (`admin-auth-config.ts`, fail-closed on empty/blank env, exact numeric-id match) + the
  session recheck + the `account.create.before` gate found no bypass. **Authed** admin black-box
  remains out of reach for an automated probe (GitHub-OAuth-only, no scriptable sign-in) — the fix
  is a one-time session-cookie capture harness (mirrors the buyer e2e `CAISSON_E2E_*` pattern);
  low marginal value on a tiny operator-only surface, tracked but not blocking.
- **Support-bot:** `/billing-grant` + `/escalate` are Bearer-authed (timing-safe SHA-256
  `compare_digest`), body pydantic `extra=forbid` + `client_max_size` capped, entitlement→role map
  fail-closed (priority-support is a standalone id a plain bundle can't grant). Clean.
- **Registry Worker:** entitlement filter fails **closed** to the base/community view on any
  absent/forged/expired/revoked token, returns the _signed purchased_ ids (never a trusted wire
  tier), npm routes reject scope-escape. Clean. Rate limit proven (above).
- **Authed site flows:** the vuln-0006 owner/seat class swept for siblings — the only session-only
  org-scoped mutation is the discord backfill (refuted above); byok, attestations, subscription
  cancel, member ops all owner-gated. Clean.
- **DoS/body-size + supply-chain:** the two confirmed findings above; fixed.

## Strix black-box cross-check

A bounded Strix run (`run-strix-chatgpt.sh -m standard -n`, `gpt-5.4`, read-only) was launched across
all 7 live surfaces (source tree + site + license + docs + admin + registry Worker + support-bot;
`_common.sh` extended this round to add the last three). It is a supplementary external-attacker
cross-check; the white-box audit above is the authoritative result.

**Outcome: inconclusive — engine mismatch, no findings.** The ChatGPT bridge only exposes the
`gpt-5.4` line, not the `gpt-5.5`/`gpt-5.6` round-1 used. `gpt-5.4` does not conform to Strix's
agent-lifecycle protocol: the run produced **312 `non-lifecycle final output` warnings** and stayed
stuck on turn 1 with **zero vulnerabilities filed** after ~40 min, so it was stopped to conserve the
ChatGPT-sub quota rather than churn. This is a runner/engine limitation, not a clean-scan result — it
neither confirms nor clears any surface on its own. **Re-run guidance:** use an engine that drives
Strix's lifecycle (the original OpenRouter `gpt-5.5` per-token path, or wait for the bridge to expose
`gpt-5.6`); GLM-5.2 (`run-strix-zai.sh`) is the cheaper alternative floor. The white-box audit stands
as the round-2 result regardless.

## Exit criteria

- [x] Round-2 findings triaged into **fixed-in-branch** (K-01/K-02/K-03) vs. tracker-parked
      (authed-admin harness) — nothing silently dropped; refuted finding dispositioned in-code.
- [x] The 429 limit **proven firing** on the prod Worker with sanctioned load — close-out item closed.
- [x] `docs/security/strix-findings-*` updated with the round-2 pass (this file).
