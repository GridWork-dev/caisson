# Stage-2 deploy plan — full cutover to Railway (behind CF Access)

Status: **PLAN (ready to execute on operator go)** · authored 2026-07-01 · branch
`chore/stage2-deploy-and-triage`. Supersedes the sequencing half of `p6-deploy-runbook.md`
Part C; that runbook stays the per-seam reference. Grounded in a 14-agent disk+live recon
(workflow `wf_6a11b902-537`), not the stale build-state prose.

**This is a build+deploy, not an ops flip.** Recon found real code-prep gaps (no license deploy
entrypoint, no Postgres migration path). The "execute end-to-end" act is a focused build+deploy
session, ready on your go. Nothing here has been executed.

## 0. Locks (operator picker, 2026-07-01)

| Fork             | Lock                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Deploy scope** | **Full cutover incl. Pages teardown (C7)** — everything live behind CF Access this session                               |
| **CI deploy**    | **Arm `RAILWAY_TOKEN` auto-deploy, but FIRST deploy manual (`railway up`)** so I verify before push-to-deploy takes over |
| **Paddle env**   | **Sandbox** (`NEXT_PUBLIC_PADDLE_ENV=sandbox`) — no real charges; production flip stays a later act                      |
| **CF Access**    | **Stays gated** (binding) — `access.tf` untouched; Access is hostname-bound, carries the DNS flip free                   |

> **Railway auth (updated 2026-07-01):** the `railway` CLI (5.23.3) is already logged in as
> `GridWork.dev (admin@gridwork.dev)` via `~/.railway`, so the **live deploy is NOT blocked** by the
> absent `RAILWAY_TOKEN` env var. That token is only the **CI repo secret** for the `deploy-railway.yml`
> auto-deploy Action (D9), which the lock defers to after the manual first deploy. Every live step
> below (D1–D8, D10, D11) runs off the CLI's own session auth.

## 1. Ground truth (recon 2026-07-01)

- **Railway `caisson-prod`** (project `df952e9d-d796-4e47-bf85-2a240f8de181`): `caisson-docs`
  (RUNNING, `docs-api.caisson.sh`), `caisson-support-bot` (RUNNING), `Postgres`
  (`cf3b669a-138c-4f5a-aab7-146653221097`, RUNNING). **No `caisson-site`, no `caisson-license`
  yet.** Local `~/lab/caisson` is **not** railway-linked.
- **DNS/HTTP:** `caisson.sh` + `www` → 302 to `gridworkdev.cloudflareaccess.com` (CF Pages
  origin, behind Access — correct). `docs-api.caisson.sh/health` → 200 (`{"ok":true,"chunks":121}`).
  Registry Worker live on `*.workers.dev`; `registry.caisson.sh` route not bound (fast-follow).
- **Env (`~/.gridwork/env`, name-only boolean):** every credential class needed is **present** —
  `CAISSON_DATABASE_URL`/`_PUBLIC_URL`, `BETTER_AUTH_SECRET`/`_URL`, `LICENSE_ISSUE_TOKEN`,
  `CAISSON_LICENSE_SIGNING_KEY`, Paddle sandbox (`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`/`_ENV`,
  `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`), Turnstile secret, `OPENROUTER_API_KEY`,
  `DISCORD_TOKEN`, `DOCS_SERVICE_TOKEN`, `RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`/`_ACCOUNT_ID`.
  `RAILWAY_TOKEN` **absent** but the `railway` CLI is session-authed (see the §0 note) — only CI
  arming (D9) needs the token.
- **Paddle sandbox webhook is ALREADY BOUND via the API** — notification setting
  `ntfset_01kwd7734h85sffq840qxmfkk5` → `https://license.caisson.sh/webhook`, active, 7 events; its
  endpoint secret is already `PADDLE_WEBHOOK_SECRET` in env. So **D6 collapses to verify+replay** once
  the license service is live (no operator dashboard step).
- **CF Pages project = `caisson-site`** (claims `caisson.sh` + `www.caisson.sh`); the CF token reads
  Pages (HTTP 200), so **D10 teardown runs via the CF API** — no operator click.
- **All 7 services-hardening fixes are DONE in code** (merged on `main`) — docs rate-limit,
  MCP rate-limit wiring, Paddle-signature webhook, HSTS, cache-control, RAG fencing. The
  already-live `caisson-docs` only needs a **redeploy** to ship them.
- **`DATABASE_URL` naming trap:** the app reads plain `process.env.DATABASE_URL`
  (`apps/site/lib/{db,auth-server}.ts`); env stores the value as `CAISSON_DATABASE_URL`. The
  Railway service var must be set as **`DATABASE_URL`** (service-scoped, clobbers nothing global).

## 2. Build-prep — ✅ DONE (2026-07-01)

Built + committed locally on `chore/stage2-deploy-and-triage`, all deterministic gates green (kernel
gate · standards-gate · dependency-cruiser · `turbo build+lint+test` 24/24 incl. the real `next build`

- the migration idempotency/RLS test) and an adversarial verify pass (security-floor PASS; CSP blocker
  found + fixed):

* `c7ea1af` **B-SITE** — security headers → `next.config` `headers()`; `NEXT_PUBLIC_*` Docker build-args; railway.toml env fix; dead CF Pages files deleted.
* `4add6c0` **B-LIC** — `services/license/src/deploy.ts` (Pool→Transactor injected into `startServer`, fail-closed on absent `DATABASE_URL`) + Dockerfile + railway.toml.
* `d469cba` **B-MIG** — `@caisson/migrate/pg` node-postgres applier + `apps/site/lib/deploy-migrate.ts` (in-memory assembly from the existing `*_SCHEMA_SQL` constants → app-role-first → credits/entitlement/license_grant/ai-meter, then better-auth's own migrator).
* `49281d6` **CSP fix** — the ported CSP silently blocked Paddle checkout (script/frame/connect/style-src); added `cdn.paddle.com` + `*.paddle.com`; `/security` page updated to match.

**Migration ownership (key architecture):** the site's standalone image does NOT contain
`@caisson/migrate`, so it cannot self-migrate. The migration runs from the **full-workspace license
image** (its railway.toml `preDeployCommand = "bun apps/site/lib/deploy-migrate.ts"` — a valid Railway
`[deploy]` key) and/or **manually** for the first cutover. `preDeployCommand` is idempotent + forward-only.

Original task spec (historical — what was built):

| #          | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Tree                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **B-SITE** | Port `public/_headers` CSP/HSTS/nosniff/X-Frame/Referrer-Policy into `next.config.ts headers()` (security-floor: today the Node server ships **zero** security headers). Add `ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`/`_ENV`/`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (+ `ENV` passthrough) to the Dockerfile **build stage** (Next inlines `NEXT_PUBLIC_*` at build; Railway's Dockerfile builder only forwards declared `ARG`s). Fix `railway.toml` env comment: drop dead `CAISSON_ACCOUNT_JWT_PUBLIC_KEY`, add `BETTER_AUTH_SECRET` (required) + `BETTER_AUTH_URL`. Delete dead Pages files (`functions/`, `public/_headers`, `wrangler.jsonc`) in the same change. | `apps/site`                                        |
| **B-MIG**  | Build the **Postgres migration path** (none exists): a `node-postgres` `MigrationApplier` + runnable entrypoint (`bin`/script) invoking `@caisson/migrate` `runMigrations` against `DATABASE_URL`; author **better-auth** table migrations; create the **`app` role + FORCE RLS** in a migration (else every `withTenant` `SET LOCAL ROLE app` throws on `/dashboard`); assemble platform tables (credits, `entitlement_grant`, `license_grant`, ai-meter, `support_ticket`). Idempotent/forward-only.                                                                                                                                                     | `packages/migrate`, `apps/site` (auth), migrations |
| **B-LIC**  | Give `services/license` a **production deploy entrypoint** (construct a Postgres `Transactor`; today `server.ts` throws on `import.meta.main`). Add `Dockerfile` + `railway.toml`. Wire `DATABASE_URL`. Mount the (already-built, Paddle-signature) webhook + `POST /issue` on the served app.                                                                                                                                                                                                                                                                                                                                                             | `services/license`                                 |

## 3. Live deploy sequence (operator-gated; executes on go)

Legend: **CLI** = I run it · **hands** = operator/dashboard action · reversibility noted.

> **REVISED execution order (2026-07-01, supersedes the D0-numbering below).** The adversarial verify
> flagged a **deploy-ordering hazard**: the site `/healthz` does no DB round-trip and the site image
> can't self-migrate, so Railway could serve `/dashboard` before the license predeploy provisions the
> schema → every `withTenant` 500s. Mitigation is a **single-threaded, migrate-first** order:
>
> 1. **`railway link`** caisson-prod; **create** the `caisson-license` + `caisson-site` services (Dockerfile paths + service vars; `caisson-site` needs the three `NEXT_PUBLIC_*` as **build vars** so they inline at `next build`). — CLI, reversible (delete service)
> 2. **Migrate FIRST, manually:** `DATABASE_URL=$CAISSON_DATABASE_PUBLIC_URL bun apps/site/lib/deploy-migrate.ts` against the fresh Railway PG (the **public** proxy URL — the internal `railway.internal` host isn't reachable from the box). Creates the `app` role + platform tables + better-auth tables. — CLI, forward-only/idempotent
> 3. **Deploy `caisson-license`** (`railway up`, manual first). Its `preDeployCommand` re-runs the same migrate (idempotent no-op). Capture the `*.up.railway.app` URL. — CLI
> 4. **Deploy `caisson-site` LAST** (`railway up`). Schema already exists → `/dashboard` + sign-in work on first boot. — CLI
> 5. **Redeploy `caisson-docs`** (ship the merged hardening). — CLI
> 6. **VERIFY on Railway URLs** (no prod traffic): site `/healthz`, SSG pages, `/docs`, `/dashboard`→`/login`, **security headers incl. the Paddle CSP**, **Paddle sandbox checkout actually opens**, Plausible fires; license `/health` + `/issue` bearer-gated. — CLI
> 7. **Paddle webhook** — already bound via API (§1); **replay** a sandbox `transaction.completed`, assert the credit+entitlement grant. — CLI
> 8. **DNS flip (Terraform):** apex+www CNAME → `*.up.railway.app`, add Railway custom domains, CF SSL Full, **`access.tf` untouched**. — CLI, reversible (flip CNAME back)
> 9. **VERIFY `caisson.sh`** (Access-gated 302, Railway-served, all routes + `/dashboard` + `/api/*`, webhook reachable). **Soak.** — CLI
> 10. **Retire Pages** (LEAST reversible, behind the soak): `DELETE /accounts/{acct}/pages/projects/caisson-site` via the CF API. — CLI
> 11. **Bind `registry.caisson.sh`** custom route to the Worker (independent fast-follow). — CLI
> 12. **Arm CI (deferred per lock):** mint a Railway **project token** in the dashboard (Settings → Tokens, env production) → `gh secret set RAILWAY_TOKEN --repo caisson-sh/caisson`; re-arm lighthouse. — **operator hands** (dashboard) + CLI
>
> **Only operator-hands step: #12** (mint the CI token — not CLI-mintable), and it's deferred past first deploy. Everything else is CLI/API.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                         | Who       | Reversible                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------- |
| D0  | Mint a Railway **project token**; hold it (do NOT set the `RAILWAY_TOKEN` repo secret yet — first deploy is manual per the lock).                                                                                                                                                                                                                                                                                            | CLI       | ✅ revoke                 |
| D1  | `railway link caisson-prod`. Create **`caisson-site`** service (Root `/`, `RAILWAY_DOCKERFILE_PATH=apps/site/Dockerfile`); set vars: `DATABASE_URL`(=PG internal ref), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://caisson.sh`, `NEXT_PUBLIC_PADDLE_*`(sandbox), `TURNSTILE_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `DOCS_SERVICE_URL`/`_TOKEN`. Add a **predeploy** = the B-MIG migration entrypoint. | CLI       | ✅ delete service         |
| D2  | Create **`caisson-license`** service (Root `/`, `RAILWAY_DOCKERFILE_PATH=services/license/Dockerfile`); vars: `DATABASE_URL`, `CAISSON_LICENSE_SIGNING_KEY`, `LICENSE_ISSUE_TOKEN`, `PADDLE_API_KEY`(sandbox), `PADDLE_WEBHOOK_SECRET`, `DOCS_*`. Predeploy = migrations (shared applier, idempotent).                                                                                                                       | CLI       | ✅ delete service         |
| D3  | **Manual first deploy** `railway up` each (site, license). Migrations run at predeploy against Railway PG. Capture `*.up.railway.app` URLs.                                                                                                                                                                                                                                                                                  | CLI       | ✅ delete revision        |
| D4  | **Redeploy `caisson-docs`** to ship the merged hardening (rate-limit, cache-control).                                                                                                                                                                                                                                                                                                                                        | CLI       | ✅ redeploy prior         |
| D5  | **VERIFY on Railway URLs (no prod traffic):** site `/healthz`, SSG pages, `/docs`, `/api/waitlist`, `/dashboard` → `/login` redirect (RLS `withTenant` opens a real tx, `app` role resolves), security headers present, Paddle checkout loads (sandbox), Plausible fires. License `/health`, `/issue` bearer-gated.                                                                                                          | CLI       | ✅ no exposure            |
| D6  | **Bind Paddle sandbox webhook** → `license.caisson.sh/webhook` (`transaction.completed` + subscription lifecycle); capture `PADDLE_WEBHOOK_SECRET` (already in env). Simulate/replay a sandbox `transaction.completed`; assert credit + entitlement grant.                                                                                                                                                                   | hands+CLI | ✅ delete destination     |
| D7  | **DNS flip (Terraform):** `infra/terraform` — apex+www CNAME `caisson-site.pages.dev`→`*.up.railway.app`, keep `proxied=true`; add `caisson.sh`/`www`/`license.caisson.sh` as Railway custom domains; CF SSL **Full**. **`access.tf` untouched.** `terraform apply`.                                                                                                                                                         | CLI       | ✅ flip CNAME back        |
| D8  | **VERIFY `caisson.sh`:** Access-gated (302 to cloudflareaccess), Railway-served, all routes + `/dashboard` + `/api/*`, license webhook reachable. **Soak.**                                                                                                                                                                                                                                                                  | CLI       | ✅ D7 rollback            |
| D9  | **Arm auto-deploy:** set the `RAILWAY_TOKEN` repo secret → `deploy-railway.yml` self-arms; every push to `main` now deploys `caisson-site`. Re-arm `lighthouse.yml` against the live Railway URL.                                                                                                                                                                                                                            | hands     | ✅ delete secret          |
| D10 | **Retire Pages (C7, LEAST reversible — gate behind D8 soak):** delete the `caisson-site` **Cloudflare Pages project**; remove Pages-only Terraform (NOT `access.tf`, NOT DNS records). `deploy-site.yml`/`wrangler.jsonc`/`functions/`/`public/_headers` already gone (B-SITE).                                                                                                                                              | hands+CLI | ⚠️ recreate Pages project |
| D11 | Fast-follow (independent): bind `registry.caisson.sh` custom route to the Worker.                                                                                                                                                                                                                                                                                                                                            | CLI       | ✅                        |

**Parallelism:** B-SITE ∥ B-MIG ∥ B-LIC (disjoint trees). D1 ∥ D2 (independent services). D3–D5
serialize per service. D6 needs D3 (license live). D7 needs D5 green. D10 needs D8 soak.

**Files ADR:** the deploy files **ADR-0139** (Railway provisioning topology executed) — records the
6-resource topology the board reserved as the interim "ADR-0119 at deploy" entry (avoids the
0119–0128 adapter-expansion collision by taking the next free number above the 0138 ceiling).

## 4. Rollback

Every step before D10 is reversible: delete Railway services (D1/D2), flip CNAME back (D7), delete
the `RAILWAY_TOKEN` secret (D9). D10 (Pages teardown) is the one hard-to-reverse act — held behind
the D8 soak. `access.tf` is never touched, so the Access gate cannot be lost by this deploy.

## 5. What needs operator hands vs CLI

- **Operator hands:** ONLY minting the Railway **project token** in the dashboard (step #12, CI arming —
  not CLI-mintable), and it's deferred past the manual first deploy. The Paddle webhook is already bound
  via API (no dashboard step) and the CF Pages deletion runs via the CF API — both were operator-hands in
  the original plan, now automated. Everything else is `railway`/`terraform`/`gh`/CF-API CLI I run.
- **Not in this deploy (deferred):** SigNoz sink (ADR-0138 kickoff), production Paddle flip, the two
  Discord privileged intents + bot role scope-down, leaked-cred rotation.
