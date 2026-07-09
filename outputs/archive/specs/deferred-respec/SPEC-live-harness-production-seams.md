# SPEC — live-verification harness for the five production-wired external seams

**Status: DRAFT — operator lock required (no ADR filed). Does NOT authorize building.**
Six operator forks are open below and must be locked before any task runs: **F1**
(Paddle event-delivery method), **F2** (proof target — deployed fleet vs local),
**F3** (Discord grant proof depth), **F4** (analytics proof depth), **F5**
(automation/CI posture), **F6** (launch credential SOT — the one that collides with a
standing operator fact). This SPEC keeps the pre-lock proposal shape of the locked
deferred-respec set (Goal → Scope → Design → Tasks → Verify → Effort/Value), adding an
**Open forks** subsection under Design.

- **Surfaces:** `packages/billing`, `services/license`, `services/support-bot`,
  `apps/admin`, `apps/site` (each an owning home for one or more seams).
- **Type:** VERIFICATION harness — **new test files + `test:live` scripts only, no
  product code.** Every seam listed already ships and is env-gated; the gap is that none
  has an automated proof against its REAL external surface. This SPEC designs that missing
  layer by extending the ADR-0201 `live/` + `skipIf`-on-env convention from packages to
  service-level seams.
- **Relates:** **ADR-0201** (the live-transport `live/` + `skipIf` convention this
  extends — `packages/audit-worm/live/store.s3.live.test.ts`,
  `packages/ai-kit/live/gateway.live.test.ts`, `packages/local-ai/live/rented.live.test.ts`);
  ADR-0108/0116/0200 (Paddle MoR verify + sole buyer webhook mount); ADR-0203 (Discord
  role-grant push); ADR-0206 (Linear Triage sink); ADR-0207 (Grafana Cloud `/ops`);
  ADR-0118 (PostHog + Plausible analytics); ADR-0177 (Grafana sole OTLP).
- **Tags:** `external-system`, `billing`, `secrets`, `auth`, `ai` (support-bot escalation
  path), `observability`.

## Goal (WHAT + WHY)

The 2026-07-02 credential-readiness sweep found five external seams that are wired to
production and **exercised only by unit doubles or dormant env-gates — never by an
automated proof against the real remote surface**:

1. **Paddle sandbox checkout → webhook → grant** — the money path. The webhook route
   (`services/license/src/app.ts:263`), its verify+grant handler
   (`services/license/src/webhook.ts:37`), and the HMAC verifier
   (`packages/billing/src/paddle-webhook.ts:43`) are all covered by unit + integration
   tests with a hand-crafted signature and a fake provider — but **no test has ever put a
   REAL Paddle-signed delivery through our HMAC re-implementation**, and our HMAC scheme is
   hand-rolled with no `@paddle/paddle-node-sdk` dependency (`paddle-webhook.ts:1-8`), so a
   scheme drift on Paddle's side (colon-join, `ts:rawBody`, 5s tolerance) is exactly the
   class of defect only a live delivery surfaces.
2. **Discord role-grant** — `services/license/src/discord-notify.ts:78` POSTs
   `/billing-grant` on the support-bot (`services/support-bot/.../billing_grant.py:110`);
   the shared-Bearer auth, guild resolution, and `add_roles` call have never been proven
   against a real bot in a real guild.
3. **Linear Triage sink** (ADR-0206) — `services/support-bot/.../linear_client.py:51`
   files an `issueCreate` mutation with a verified no-`Bearer`-prefix auth quirk
   (`linear_client.py:68`); proven only against an httpx double.
4. **Grafana Cloud query surface** (ADR-0207) — `apps/admin/src/lib/grafana.ts:159`
   proxies TraceQL through the Grafana Cloud datasource; the client is env-gated INERT and
   its unit tests assert the dormant + mapping paths only (`apps/admin/src/lib/grafana.test.ts`).
5. **`NEXT_PUBLIC_*` analytics** (ADR-0118) — `apps/site/components/posthog-init.tsx:15`
   and `apps/site/components/plausible-init.tsx:12` are build-time inlined into the client
   bundle; no test proves the env→bundle→network-fire path at all.

**The deliverable is the harness that closes those five gaps** — a per-seam `live/` proof
that self-skips without credentials (the ADR-0201 convention) and, when credentials are
present, exercises the REAL remote. The launch context makes this load-bearing beyond
"more coverage": the operator's pre-launch plan is a full credential sweep/audit +
regenerate-every-scoped-key pass + a launch credential set with env parity. **A key
rotation is a silent break waiting to happen** — a wrong scope, a stale webhook secret, a
regenerated Discord/Linear token that never got mirrored will pass every existing unit test
(they use doubles) and fail only in production, on a real purchase. This harness is the
thing that **proves the post-rotation credential set actually works end-to-end**: run the
full live suite after every rotation; green means the launch creds are wired correctly, red
names the seam that broke. Env presence is no longer the blocker for the Railway-only seams
— `~/.gridwork/caisson.env` now mirrors all Railway vars locally — so a real proof is
reachable from a dev box for four of five seams; the fifth (browser checkout) is the one
genuine headless limit, forked below.

## Scope

**In:**

- One `live/` (or pytest live-marker) proof per seam that self-skips without its
  credentials and, when present, hits the real remote — following
  `packages/*/live/*.live.test.ts` verbatim in shape.
- A `test:live` script per owning package/service and one aggregate entry
  (`bun run test:live:all` + the support-bot pytest live marker) the rotation runbook calls.
- The Verify section defining the harness AS the post-rotation credential proof.
- A one-page runbook stub (`docs/state/live-harness.md`) tying "rotate a key → run the
  suite → read the seam that fails" together. (Doc only; not this SPEC's build.)

**Out:**

- **Any product-code change.** Every seam's handler, verifier, and env-gate already ships
  and is cited below; the harness adds test files + package scripts only. No edit to
  `app.ts`, `webhook.ts`, `paddle-webhook.ts`, `discord-notify.ts`, `billing_grant.py`,
  `linear_client.py`, `grafana.ts`, or the analytics components.
- **Running any live proof in CI.** Every proof is `skipIf`-gated and lives OUTSIDE the
  default suite (`bun test ./src` / `pytest tests`), exactly as ADR-0201 requires — CI's
  secret-free runners never execute them. (F5 forks a _manually-triggered_ rotation gate;
  it is never a push/PR job.)
- **Re-testing logic the unit suites already own.** `packages/billing/src/paddle.test.ts`
  already proves `verifyPaddleWebhook` against hand-signed payloads;
  `apps/admin/src/lib/grafana.test.ts` already proves the dormant + mapping paths; the
  support-bot `tests/test_*.py` doubles already prove the client shapes. The live proof adds
  only the one thing a double cannot: the real remote's real response.
- **The 1Password migration itself.** F6 tables _which_ store is the launch SOT; standing
  it up (if the operator picks 1Password over the existing mirror) is separate work.
- **New provider clients or SDKs.** Every seam reuses its already-shipped client
  (`createPaddleBilling`, `LinearIssueTracker`, `grafana.ts` `proxyGet`, `posthog-js`,
  `@plausible-analytics/tracker`). The Paddle simulator call (F1=A) is a thin
  `fetchWithTimeout` POST to `api.paddle.com/simulations` — no `@paddle/paddle-node-sdk`.

## Design

The item is a **verification harness**, not a build. `// ponytail: the seams are done —
this is five proofs + their run scripts, one per owning package.` The convention is already
proven three times over; this SPEC applies it, it does not invent it.

### The proven convention (cited — do not re-derive)

The self-skip idiom is fixed. In `packages/audit-worm/live/store.s3.live.test.ts:26-29`,
`HAVE_CREDS` is derived from a non-empty bucket plus a present AWS key, and
`liveTest` is `test.skipIf(!HAVE_CREDS)`; every leg runs through `liveTest`. That file's
header (lines 1-14) states the three invariants every live proof here inherits: it lives
OUTSIDE `./src` (so the default suite, CI, and the published tarball never see it), it
self-skips without prover creds, and it uses a **reserved proof tenant** with a per-run
UUID segment so re-runs never collide (`PROOF_ACCOUNT_ID` at line 34, `RUN = randomUUID()`
at line 36). The same `HAVE_KEY` self-skip repeats verbatim in
`packages/ai-kit/live/gateway.live.test.ts:41` and
`packages/local-ai/live/rented.live.test.ts:24-25`. Script wiring:
`packages/ai-kit/package.json:22`, `packages/local-ai/package.json:22`, and
`packages/audit-worm/package.json:22` each carry `"test:live": "bun test ./live"`. No
`services/*` package carries a `test:live` script today —
`services/license/package.json:18` is `"test": "bun test ./src"` only, and only three
packages have a `live/` directory at all. That absence is the gap.

### Seam-by-seam current state (cited) and the missing live leg

**Seam 1 — Paddle checkout → webhook → grant (billing + services/license).**

- Route: `services/license/src/app.ts:263` (`POST /webhook`), reads the `paddle-signature`
  header at `app.ts:279`, calls `handleBillingWebhook` at `app.ts:292`.
- Handler: `services/license/src/webhook.ts:37` — `provider.verifyAndParse(...)`
  (`webhook.ts:43`, throws `AuthnError` before any DB work) then
  `withTenant(pg, event.accountId, (tx) => applyBillingEvent(tx, event))` (`webhook.ts:53`).
- Verifier: `packages/billing/src/paddle-webhook.ts:43` — hand-rolled HMAC-SHA256 of
  `${timestamp}:${rawBody}` (`paddle-webhook.ts:58-60`), `safeEqualFixed`-compared to the
  header's `h1` values, 5s tolerance (`paddle-webhook.ts:47`). NO Paddle SDK
  (`paddle-webhook.ts:6-8`).
- Env (license side, `services/license/src/server.ts`): `PADDLE_WEBHOOK_SECRET` (`:67`),
  `PADDLE_ENV` (`:70-71`, `"sandbox"` vs `"production"`), `PADDLE_API_KEY` (`:74`). Env
  (browser side): `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV`
  (`apps/site/lib/paddle-checkout.ts:15,28`).
- Browser-only checkout: `apps/site/lib/paddle-checkout.ts:7` (`"use client"`) opens the
  Paddle.js overlay (`paddle.Checkout.open({ items, customData: { account_id } })`,
  `paddle-checkout.ts:72-78`). This is the one seam whose _front half_ cannot run headlessly.
- Existing tests (doubles): `packages/billing/src/paddle.test.ts` (hand-signed verify),
  `services/license/src/paddle-webhook.integration.test.ts`,
  `services/license/src/webhook-app.integration.test.ts`.
- **Missing live leg:** a REAL Paddle-signed delivery through the real
  verify→parse→`applyBillingEvent` grant, ending in a real credit + entitlement row for a
  reserved proof account. Method forked at **F1**; delivery target forked at **F2**.

**Seam 2 — Discord role-grant (services/license → support-bot).**

- Outbound: `services/license/src/discord-notify.ts:78` — `notifyDiscordGrant` POSTs
  `${config.url}/billing-grant` with a `Bearer` token (`discord-notify.ts:88-102`), NEVER
  throws (money path must not depend on Discord). Config from `SUPPORT_BOT_URL` +
  `SUPPORT_BOT_GRANT_TOKEN` (`discord-notify.ts:31-32`).
- Inbound: `services/support-bot/src/caisson_support_bot/billing_grant.py:110`
  (`_handle_billing_grant`), timing-safe Bearer at `billing_grant.py:53`, registered only
  when the token is set (`billing_grant.py:166-167`), resolves the guild
  (`billing_grant.py:64` `grant_guild`), the member (`billing_grant.py:78` `find_member` —
  targeted REST fetch, needs no privileged intent), then `member.add_roles`
  (`billing_grant.py:153`). Member-not-found → a clean 404 (`billing_grant.py:133`).
- Env (bot side, `services/support-bot/.../config.py`): `BILLING_GRANT_TOKEN` (`:87`, must
  equal license's `SUPPORT_BOT_GRANT_TOKEN`), `GUILD_ID` (`:93`), `CUSTOMER_ROLE_ID`
  (`:69`), `ROLE_COMPLIANCE_ID`/`ROLE_AI_KIT_ID`/`ROLE_LOCAL_FIRST_ID`/`ROLE_AGENTIC_ID`
  (`:73-80`), `DISCORD_TOKEN` (`:28`).
- Existing tests (doubles): `services/license/src/discord-notify.integration.test.ts`,
  `services/support-bot/tests/test_billing_grant.py`.
- **Missing live leg:** a real Bearer-authed POST to the running bot's `/billing-grant`
  against a real guild + a real test Discord user. Depth forked at **F3**.

**Seam 3 — Linear Triage sink (support-bot, ADR-0206).**

- `services/support-bot/.../linear_client.py:51` — `create_issue` POSTs `issueCreate`
  (`_GRAPHQL_URL = https://api.linear.app/graphql`, `linear_client.py:22`) with the
  no-`Bearer`-prefix auth quirk (`linear_client.py:68-69`) and the HTTP-200-with-`errors`
  quirk (`linear_client.py:87-91`) — both are exactly the kind of contract only a real
  Linear response confirms. Never raises (`linear_client.py:6-7`).
- Env: `LINEAR_API_KEY` (`config.py:107`), `LINEAR_TEAM_ID` (`config.py:111`),
  `LINEAR_TRIAGE_STATE_ID` (`config.py:114`).
- Existing tests (doubles): `services/support-bot/tests/test_linear_client.py`.
- **Missing live leg:** file one real Triage issue in the `CAISSON` team, assert a real
  `issue.url` comes back, then archive it (Linear issues are cheap + archivable, unlike WORM
  objects).

**Seam 4 — Grafana Cloud query (apps/admin `/ops`, ADR-0207).**

- `apps/admin/src/lib/grafana.ts:159` (`proxyGet`) → `apps/admin/src/lib/grafana.ts:189`
  (`searchTraces`) / `:209` (`listServiceNames`), aggregated by `fetchOpsSnapshot`
  (`grafana.ts:235`) which the page calls (`apps/admin/src/app/ops/page.tsx:27-28`).
  Env-gated INERT: `grafanaEnv()` (`grafana.ts:31`) returns `null` and every query returns a
  typed empty result unless `GRAFANA_URL` (`:32`), `GRAFANA_QUERY_TOKEN` (`:33`),
  `GRAFANA_TEMPO_DATASOURCE_UID` (`:34`) are all set (`grafanaConfigured`, `:40`).
- Existing tests (doubles): `apps/admin/src/lib/grafana.test.ts` (dormant-env + `mapTraces`
  / `mapServiceNames` mapping only).
- **Missing live leg:** call `listServiceNames()` / `searchTraces()` against the real
  Grafana Cloud datasource proxy with the real `glsa_` query token, assert the fleet's own
  service names come back (a read-only proof — no mutation, the cheapest of the five).

**Seam 5 — `NEXT_PUBLIC_*` analytics (apps/site, ADR-0118).**

- `apps/site/components/posthog-init.tsx:15` reads `NEXT_PUBLIC_POSTHOG_KEY` (`:17`) +
  `NEXT_PUBLIC_POSTHOG_HOST` (`:24`), mounted in the authed dashboard layout only
  (`apps/site/app/dashboard/layout.tsx:50`). `apps/site/components/plausible-init.tsx:12`
  reads `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (`:14`), mounted in the root layout
  (`apps/site/app/layout.tsx:74`).
- These are **build-time inlined** — the env value is baked into the client JS at
  `next build`, so there is no server-side call to intercept and no double to swap. This is
  the seam where "a live proof from a dev box" is structurally weakest.
- Existing tests: none.
- **Missing live leg:** forked at **F4** — the honest options are a build-artifact
  assertion (the env made it into the bundle) ± a headless pageload that asserts the network
  request to `us.i.posthog.com` / the Plausible domain actually fires; the real _ingestion_
  proof stays the provider dashboard (manual), because only PostHog/Plausible can confirm
  receipt.

### Paddle simulation-API finding (cited — resolves the headless question for F1)

Paddle Billing ships a first-class **webhook simulator** that makes the webhook→grant half
provable **headlessly, without a browser and without a real card**:

- The simulator "lets you send test webhooks to your endpoint **without triggering real
  transactions** … Works in sandbox and production" and sends **real-shaped payloads with
  real entities** to a configured **notification destination**
  (developer.paddle.com/webhooks/simulator, fetched 2026-07-02).
- It is **fully API-driven / headless**: `POST https://api.paddle.com/simulations` creates a
  reusable simulation for a notification destination
  (developer.paddle.com/api-reference/simulations/create-simulation), and `POST
https://api.paddle.com/simulations/{simulation_id}/runs` triggers a run, returning a
  `ntfsimrun_`-prefixed run entity
  (developer.paddle.com/api-reference/simulation-runs/create-simulation-run, fetched
  2026-07-02). No dashboard click required.
- **Scenarios** replay a full lifecycle sequence — the "subscription created" scenario fires
  the same customer → transaction → subscription webhook sequence a real checkout produces
  (developer.paddle.com/webhooks/simulator/subscription-created) — so the grant path sees the
  same event shape it sees in production.

**Design assumption A1 (verify empirically before locking F1=A):** the docs fetched confirm
the simulator delivers to a _notification destination_ (the entity that carries the signing
secret) but did not surface a sentence stating the simulated delivery is signed with that
destination's secret. If it IS signed, F1=A exercises the full real
`verifyPaddleWebhook`→parse→grant chain. If it is NOT, F1=A still proves parse+grant but the
**real-signature verify leg** is only ever provable by a genuine checkout-produced webhook
(F1=B) — and note the unit suite (`packages/billing/src/paddle.test.ts`) already proves the
verifier against hand-signed payloads, so the residual live-only gap is narrow either way.
This is a build-time probe, not an operator fork; the fork is the _method_, below.

### Open forks (operator lock required — tasks are gated on these)

**Fork F1 — Paddle event-delivery method (BLOCKING, load-bearing).**

- **F1-A (Recommended)** — Paddle **webhook simulator API**: `POST /simulations` + `POST
/simulations/{id}/runs` against a sandbox notification destination pointed at our
  `/webhook`, driving the real verify→grant. Headless, no browser, no card, re-runnable,
  works in sandbox. _Tradeoff:_ the Paddle.js overlay itself (`paddle-checkout.ts`) is never
  exercised — but that is a thin `initializePaddle`/`Checkout.open` wrapper over
  `@paddle/paddle-js`, not our money logic; the load-bearing grant is server-side. Depends on
  A1 for the verify leg.
- **F1-B** — **Playwright-driven sandbox checkout**: drive the real overlay in a headless
  browser with a Paddle sandbox test card, producing a genuine `transaction.completed`.
  _Tradeoff:_ proves the FULL loop incl. the overlay + a real signature, but flaky
  (third-party iframe + test-card entry + timing), pulls a browser dep into the harness, and
  still cannot run in CI's secret-free lane. Highest fidelity, highest maintenance.
- **F1-C** — Both: F1-A as the routine re-runnable proof, F1-B as a rarely-run
  full-fidelity check. _Tradeoff:_ most coverage, most surface to maintain.

_Recommendation: **F1-A**, confidence medium-high. The simulator is purpose-built for
exactly this, runs headless from a dev box, and the browser overlay it skips is a vendor SDK
wrapper we did not write. Add F1-B (→ F1-C) only if the operator wants the overlay + a
real-signature path in the automated suite. Resolve A1 first — if the simulator does not
sign, keep the real-signature verify leg on the unit suite and say so in the runbook._

**Fork F2 — proof target / reach (applies to seams 1-2; 3-4 are read-only either way).**

- **F2-A (Recommended)** — run the proofs against the **DEPLOYED Railway fleet** (real
  `license.caisson.sh/webhook`, the live bot's `/billing-grant`) using a **reserved proof
  tenant + a test Discord user**, mirroring the WORM proof's `PROOF_ACCOUNT_ID` +
  per-run-UUID pattern (`store.s3.live.test.ts:34-36`). _Tradeoff:_ highest fidelity (proves
  the actual deployed wiring + real DNS + real inbound) but mutates the production DB /
  Discord — contained to a reserved account, but real rows. Requires a self-cleaning reaper
  or an explicit teardown leg per seam.
- **F2-B** — run against **locally-booted instances** (`services/license` + support-bot on
  loopback) with the mirrored `~/.gridwork/caisson.env` creds, Paddle's simulator pointed at
  a tunnel (cloudflared/ngrok) to the local `/webhook`. _Tradeoff:_ zero production mutation,
  but proves the code + creds, not the deployed wiring/DNS; adds a tunnel dependency for the
  inbound-webhook seam.

_Recommendation: **F2-A** for seams 1-2 with a reserved proof tenant, confidence medium —
the whole point of a post-rotation proof is that the DEPLOYED fleet still works, which a
local boot cannot vouch for; the WORM live proof already established the reserved-tenant +
UUID-segment pattern to keep production mutation contained and self-cleaning. Choose F2-B if
the operator refuses any production-side write during a proof. (Seams 3-4 read-only remotes —
Linear archive-after, Grafana pure read — carry no F2 tension.)_

**Fork F3 — Discord grant proof depth (seam 2).**

- **F3-A (Recommended)** — prove **auth + routing + guild-resolution up to the member
  lookup**, using a Discord user id NOT in the guild so the bot returns its clean 404
  (`billing_grant.py:133`) — this exercises the Bearer check, body validation, and guild
  resolution against the REAL running bot **without granting a real role**. _Tradeoff:_ the
  final `add_roles` call (`billing_grant.py:153`) is not exercised live (still unit-covered).
- **F3-B** — full grant: a **reserved test Discord account** in the guild + a throwaway
  "proof" role; POST `/billing-grant`, assert the role landed, then remove it. _Tradeoff:_
  proves the whole path incl. `add_roles` + bot role-hierarchy, but needs a standing test
  account + role and a teardown leg, and mutates guild state.

_Recommendation: **F3-A**, confidence medium-high — the 404 path proves everything that a
rotated `BILLING_GRANT_TOKEN` / `GUILD_ID` mismatch would break (auth + guild resolution),
which is the credential-proof goal, without standing up guild fixtures. Choose F3-B if the
operator wants the `add_roles` grant itself in the automated suite._

**Fork F4 — analytics proof depth (seam 5).**

- **F4-A (Recommended)** — a **build-artifact assertion**: `next build` `apps/site` with the
  `NEXT_PUBLIC_*` envs set, then grep the built client bundle for the inlined key/domain +
  the posthog/plausible init — proves the env→bundle path (the thing a rotation breaks) is a
  cheap headless check. _Tradeoff:_ proves inlining + mount wiring, not that PostHog/Plausible
  ingested the event (their dashboards remain the receipt proof).
- **F4-B** — A **plus** a headless-browser pageload asserting the network request to
  `us.i.posthog.com` / the Plausible domain actually fires. _Tradeoff:_ closer to end-to-end,
  but pulls a browser into the harness for a marketing-analytics seam and still can't prove
  ingestion.
- **F4-C** — **out of the harness**: analytics verified by dashboard only (manual), no
  automated leg. _Tradeoff:_ zero harness cost, zero regression signal on the inlining.

_Recommendation: **F4-A**, confidence medium — the build-grep is a real, cheap, headless
proof that a rotated analytics key reaches the bundle; ingestion stays dashboard-verified
(only the provider can confirm receipt). Escalate to F4-B only if the operator wants the
network-fire asserted; F4-C only if analytics is deemed non-launch-blocking._

**Fork F5 — automation / CI posture.**

- **F5-A (Recommended)** — a **local command** the rotation runbook calls: `bun run
test:live:all` (aggregates every package/service `test:live`) + the support-bot pytest
  live marker, creds sourced from the launch SOT (F6). NOT a push/PR job. _Tradeoff:_ no CI
  audit trail of the run — the operator runs it by hand post-rotation.
- **F5-B** — a `workflow_dispatch`-only GitHub job on the self-hosted `caisson-amd64` fleet
  (which already holds the creds via `~/.gridwork`) that runs `test:live:all` on demand.
  _Tradeoff:_ durable run history + a green/red artifact, but touches CI + injects the launch
  credential set into a runner — a `secrets`/`external-system` change that itself wants an
  audit.

_Recommendation: **F5-A first** (the local command is the minimum that satisfies "run the
suite after every rotation"), **F5-B** as the durable gate once launch creds are stable —
but F5-B is operator-gated because it puts the full launch credential set on a CI runner._

**Fork F6 — launch credential SOT + env-parity source (FLAGGED CONFLICT — do not
auto-resolve).** The dispatch's pre-launch plan names "a 1Password vault holding the launch
credential set with env parity." **This collides with a standing operator fact** (global
memory `no-1password-env-creds.md`: the operator uses NO 1Password anywhere; all creds
source straight from `~/.gridwork/env`, and `~/.gridwork/caisson.env` now mirrors all
Railway vars). The harness must read its creds + assert env-parity against ONE SOT; which
one is operator-owned:

- **F6-A (Recommended)** — **`~/.gridwork/caisson.env`** (the existing Railway-var mirror) is
  the launch credential SOT + the env-parity source. Matches the standing no-1Password
  practice; the mirror already exists and already holds every Railway var. _Tradeoff:_ no
  team-shareable vault UI; the SOT is a local file on the operator's box.
- **F6-B** — a **1Password vault** as the dispatch's pre-launch plan literally states, with a
  sync step to env. _Tradeoff:_ team-shareable + rotation-friendly UI, but stands up a
  tooling class the operator has explicitly rejected everywhere else — reconcile with
  `no-1password-env-creds.md` before locking, or that global fact goes stale.

_Recommendation: none forced — the operator explicitly stated the F6-B plan on 2026-07-02
("full credential sweep/audit, regen scoped-only, one 1Password vault for all of them, parity
with the env"), and the global memory was already narrowed to record it
(`caisson-1password-launch-vault.md`). So F6-B is the operator's own stated intent, not a
dispatch artifact; F6-A remains the zero-new-tooling alternative if that plan changes. Either
way the harness reads creds from the env files at run time — the vault is the durable SOT the
env files stay in parity with, not a runtime dependency._

### Harness packaging (design default, not a fork — the convention already decided it)

Follow ADR-0201 verbatim, one home per owning surface — do NOT build a central harness
framework (`// ponytail: a top-level orchestrator would re-implement each seam's shipped
client; the per-package live/ dir is the proven, cheaper shape`):

- `packages/billing/live/paddle-webhook.live.test.ts` + `services/license/live/webhook-grant.live.test.ts` — seam 1 (the simulator driver + the grant assertion), `test:live` added to both `package.json`s.
- `services/license/live/discord-grant.live.test.ts` + a support-bot `tests/live/test_billing_grant_live.py` (pytest `@pytest.mark.live`, skipped by default) — seam 2.
- `services/support-bot/tests/live/test_linear_live.py` — seam 3.
- `apps/admin/live/grafana.live.test.ts` + `test:live` in `apps/admin/package.json` — seam 4.
- `apps/site/live/analytics-bundle.live.test.ts` (F4-A build-grep) — seam 5.
- Aggregate: a root `test:live:all` script fanning out the `bun` `test:live`s + a documented
  `uv run pytest -m live` for the two Python seams.

## Tasks

Tasks are gated on the locks above; sizes are for bounded execution. Nothing runs until F1,
F2, F6 are locked (F3/F4/F5 gate only their own seam/task).

1. **[A1 probe] Confirm the Paddle simulator's signature behavior.** Create a sandbox
   simulation + run against a throwaway receiver; observe whether the delivery carries a
   `Paddle-Signature` that verifies under `verifyPaddleWebhook` with the destination secret.
   Record the answer in the runbook; it decides whether F1-A covers the verify leg. Effort: S.
2. **[F1 + F2] Seam 1 live proof.** `packages/billing/live/paddle-webhook.live.test.ts`
   drives `POST /simulations/{id}/runs` (F1-A) or the playwright checkout (F1-B) against the
   F2 target; `services/license/live/webhook-grant.live.test.ts` asserts a real credit +
   entitlement row landed for the reserved proof account, then tears it down. Add `test:live`
   to `packages/billing/package.json` + `services/license/package.json`. Verify:
   `PADDLE_* ... bun run test:live` green; a fresh proof-account grant row exists then is
   cleaned. Effort: M.
3. **[F3] Seam 2 live proof.** `services/license/live/discord-grant.live.test.ts` (the real
   Bearer POST via `notifyDiscordGrant`) + `services/support-bot/tests/live/test_billing_grant_live.py`
   (`@pytest.mark.live`) assert the F3-A 404 auth+routing path (or F3-B full grant+teardown)
   against the running bot. Verify: creds present → green; absent → skipped. Effort: M.
4. **[read-only] Seam 3 live proof.** `services/support-bot/tests/live/test_linear_live.py`
   files one real `issueCreate` in team `CAISSON` at the triage state, asserts a real
   `issue.url`, archives it. Verify: `LINEAR_* ... uv run pytest -m live -k linear` green;
   the issue is archived after. Effort: S.
5. **[read-only] Seam 4 live proof.** `apps/admin/live/grafana.live.test.ts` calls
   `listServiceNames()` against the real Grafana Cloud proxy, asserts the fleet's own service
   names appear (pure read, no teardown). Add `test:live` to `apps/admin/package.json`.
   Verify: `GRAFANA_* ... bun run test:live` returns real service names. Effort: S.
6. **[F4] Seam 5 live proof.** F4-A: `apps/site/live/analytics-bundle.live.test.ts` builds
   `apps/site` with the `NEXT_PUBLIC_*` envs and greps the client bundle for the inlined
   key/domain + init call. (F4-B adds the headless network-fire leg; F4-C skips this task.)
   Verify: with envs set, the built bundle contains the inlined values; without, the no-op
   path holds. Effort: S (F4-B → M).
7. **[F5] Aggregate + rotation runbook.** Root `test:live:all` script + `docs/state/live-harness.md`:
   "rotate a scoped key → run `test:live:all` (+ the pytest live marker) → read the seam that
   fails." (F5-B adds the `workflow_dispatch` job.) Verify: `bun run test:live:all` fans out
   to every seam; the runbook names each seam's creds + its skip condition. Effort: S (F5-B → M).
8. **Re-assert CI-never.** Verify: `grep -rn "test:live\|@pytest.mark.live\|CAISSON_.*_LIVE"
.github/` shows the live suite is only ever a `workflow_dispatch` job (F5-B) or absent
   (F5-A) — never a push/PR trigger. Effort: XS.

## Verify (goal-backward)

Re-ask the launch goal — _after the operator rotates every scoped launch key, does one run
of this harness prove the whole external surface still works end-to-end, and name the exact
seam if not?_ — against the result, not the task list:

- **The harness IS the post-rotation credential proof.** Rotate `PADDLE_WEBHOOK_SECRET` /
  `LINEAR_API_KEY` / the Grafana `glsa_` token / `BILLING_GRANT_TOKEN` / the `NEXT_PUBLIC_*`
  keys, run `test:live:all`, and a green run means every seam's live remote accepted the new
  credential; a red leg names the one seam that broke — a signal no existing unit/double test
  can produce, because they never touch the real remote. This is the load-bearing check.
- **Each seam proved the one thing its double could not.** Seam 1: a real Paddle-signed (A1)
  or simulator-delivered event produced a real grant row for the reserved proof account.
  Seam 2: the real bot authed the real Bearer and resolved the real guild. Seam 3: Linear
  returned a real `issue.url` (the no-`Bearer`-prefix + 200-with-`errors` quirks held against
  the live API). Seam 4: the real Grafana proxy returned the fleet's real service names. Seam
  5: the rotated `NEXT_PUBLIC_*` value reached the built client bundle.
- **Zero product code changed.** `git diff --stat` touches only `live/` test files,
  `tests/live/` Python files, `package.json` scripts, and the runbook doc — no edit to any
  handler, verifier, env-gate, or component cited in Design.
- **CI never runs a live proof unbidden.** Every leg self-skips without creds; the default
  suites (`bun test ./src`, `pytest tests`) and every push/PR job are unchanged; a live run
  is a deliberate act (F5-A local command or F5-B `workflow_dispatch`).
- **Production mutation stayed contained + self-cleaning.** Under F2-A, seam-1/2 proofs used
  a reserved proof tenant / test Discord user with per-run isolation and a teardown (or
  reaper) leg — no real customer row, no lingering guild role; seams 3-4 archived/read-only.
- **The credential SOT is single + honest.** The harness reads creds + asserts env-parity
  against exactly one source (F6), and if that source is anything other than the standing
  `~/.gridwork` practice, `no-1password-env-creds.md` was reconciled in the same change so no
  global fact went stale.

## Effort: M (five self-skipping proofs + their run scripts + a runbook; no product code — F1-B/F4-B/F5-B each add M to their seam). Value: HIGH — closes the last live-coverage gap on the launch-blocking money + identity + observability seams, and gives the pre-launch key-rotation pass a single green/red proof that the rotated credentials actually work end-to-end, which no existing double-backed test can provide.
