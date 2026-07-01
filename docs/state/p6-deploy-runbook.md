# P6 go-live deploy runbook (Part B — DEPLOY-class)

Operator runbook for the P6 commerce/deploy seams. Companion to `readiness-and-backlog.md` §2 and the
ADR-0107 go-live checklist. **Every step here is operator-gated** (real money / public bot / secrets).
Creds source from `~/.gridwork/env` (NO 1Password). This session pre-built what it could in-lane;
the live deploys + cred-bearing accounts are the operator's acts.

Platform = **Railway** (ADR-0105, operator-locked 2026-06-30). The license issuer (code-track I1) and
the commerce backend follow the same posture.

> **LIVE — deployed 2026-06-30 (Railway project `caisson-prod`, workspace GridWork.dev):**
>
> - **docs-service** → `https://docs-api.caisson.sh` (CF CNAME, DNS-only + Railway TLS) and
>   `caisson-docs-production.up.railway.app`. `/health` 200, `/llms.txt` serving the real corpus,
>   `POST /query` Bearer-authed. **SEMANTIC SEARCH NOW LIVE** — the OpenRouter `qwen3-embedding-8b`
>   embedder is wired (`ADR-0096` deploy wire, commit `33f4ef3`); natural-language sentence queries
>   return ranked chunks (verified). Boot 502s for ~60-90s while the 121 chunks embed, then health passes.
> - **support-bot** → ● Online, connected to the **Caisson** guild (`1521508737133842533`) as the
>   Caisson bot. **Member management deployed** (`ADR-0109`, commit `ebda98c`): 8 slash commands live
>   (`/ask /ban /grant-role /kick /post-roles /role-add /role-remove /timeout`). Safe channel/role ids
>   wired into the Railway env. No public domain (outbound gateway; `/health` is the internal probe only).
> - **Discord server BUILT** via `infra/discord/provision.ts` (idempotent bot-token REST): 7 roles, 6
>   categories, 20 channels with permission overwrites, icon + name "Caisson" + verification MEDIUM.
> - Build gotcha (both services): Railway uploads the **repo root** and runs Railpack unless
>   `RAILWAY_DOCKERFILE_PATH` is set — it is mandatory on each service, and the Dockerfiles use
>   repo-root-relative `COPY` paths. Bot port: `PORT`+`HEALTH_PORT` pinned to `8080`.
>
> **Remaining operator steps to finish member-mgmt go-live:**
>
> 1. Developer Portal → enable **Server Members Intent** + **Message Content Intent** (privileged).
> 2. Then set `MEMBER_ROLE_ID=1521528395601805534` + `SUPPORT_CHANNEL_ID=1521528418930524270` on
>    `caisson-support-bot` and redeploy → auto-role + #ask-ai listener activate. (Held back until the
>    Portal toggles are on, else the gateway refuses to connect.)
> 3. Enable **Community** in the dashboard, then re-run `bun infra/discord/provision.ts` to upgrade
>    #support/#bug-reports/#feature-requests → forum, #announcements/#changelog → announcement.
> 4. Scope the bot's role down from Administrator to a least-privilege role before go-live (`ADR-0107`).
>
> - 🔴 **Rotate** the Discord token + OpenRouter key (pasted into chat earlier) and update the env +
>   Railway service vars once green.

## Status at a glance

| Seam                   | Built                                                                    | Provisioned this session                                                                                                                                             | Still blocked on                                                                                   |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **B4 license keypair** | issuer code = code-track I1                                              | ✅ Ed25519 keypair generated, round-trip-verified; private → `~/.gridwork/env` (`CAISSON_LICENSE_SIGNING_KEY`); public → `infra/license-issuer/ISSUER_PUBLIC_KEY.md` | code-track: bake the public key into `verify.ts`; build the issuer sign path                       |
| **B3 docs-service**    | ✅ (FTS5 floor)                                                          | ✅ `Dockerfile` + `railway.toml` + `DOCS_SERVICE_TOKEN` (in env)                                                                                                     | code-track: real OpenRouter embedder wire; then `railway up`                                       |
| **B2 support-bot**     | ✅ (Dockerfile + 32 tests)                                               | ✅ `railway.toml`                                                                                                                                                    | operator: Discord app + `DISCORD_TOKEN`; B3 live (for `DOCS_SERVICE_URL`); then `railway up`       |
| **B1 Paddle (MoR)**    | X-2 cycle→grant mapper ✅ but Stripe-shaped (services/license, ADR-0089) | runbook below (ADR-0108)                                                                                                                                             | operator: Paddle account + catalog + keys; code-track: rework mapper Stripe→Paddle + price-id wire |

## B4 — license issuer keypair ✅ provisioned

- **Done:** keypair minted offline (`node:crypto` ed25519), sign+verify round-trip confirmed. Private
  PKCS8 key in `~/.gridwork/env` as `CAISSON_LICENSE_SIGNING_KEY`; public SPKI in
  `CAISSON_LICENSE_PUBLIC_KEY` and in `infra/license-issuer/ISSUER_PUBLIC_KEY.md` (committed, non-secret).
- **At issuer deploy:** copy `CAISSON_LICENSE_SIGNING_KEY` into the issuer service's Railway secret
  store. The issuer is the only process that ever holds it.
- **Code-track (I1):** see the handoff file — bake the public key into
  `packages/license-verify/src/verify.ts` (replace the KAT vector) + sign canonical claims with the
  private key.

## B3 — docs-service (Railway)

1. **Code-track first:** wire the real OpenRouter `qwen3-embedding-8b` embedder at
   `services/docs/src/server.ts` (`DocsIndex.build(corpus.chunks, embedder)`), gated on
   `OPENROUTER_API_KEY`. Until then the service serves the **FTS5 keyword floor** only (no semantic
   recall) — deployable but degraded; the support-bot RAG quality depends on this.
2. **Railway service:** New service → connect the repo → set **Root Directory = `/`**, **Config path =
   `services/docs/railway.toml`** (build context must be the repo root, per the Dockerfile header).
3. **Env:** `DOCS_SERVICE_TOKEN` (copy the value from `~/.gridwork/env`), `OPENROUTER_API_KEY`. Railway
   injects `PORT`.
4. **Deploy:** `railway up` (operator-gated). Verify: `GET /health` → 200, `GET /llms.txt` serves,
   `POST /query` with `Authorization: Bearer <DOCS_SERVICE_TOKEN>` returns ranked chunks (vector-leg
   results once the embedder is wired; FTS5 results before).
5. Capture the deployed base URL → it becomes the support-bot's `DOCS_SERVICE_URL`.

## B2 — support-bot (Railway, after B3 is live)

1. **Discord app:** create the application + bot at the Discord developer portal; enable the
   `message_content` intent; copy the bot token. Invite it to the server with `applications.commands`
   - send-messages + create-threads scopes; register the `/ask` slash command (the bot does this on
     startup via `app_commands` sync).
2. **Railway service:** New service → **Root Directory = `services/support-bot`**, **Config path =
   `services/support-bot/railway.toml`** (the Dockerfile is self-contained).
3. **Env:** `DISCORD_TOKEN`, `OPENROUTER_API_KEY`, `DOCS_SERVICE_URL` (B3's URL), `DOCS_SERVICE_TOKEN`
   (must match B3), optional `DATABASE_URL` (Postgres escalation), optional `SUPPORT_CHANNEL_ID` /
   `SUPPORT_HUMAN_ROLE_ID` / `OPENROUTER_MODEL`.
4. **Deploy:** `railway up`. Smoke `/ask` end-to-end in Discord against the live docs `/query`; confirm
   an unanswerable question opens a thread + persists a `support_ticket` row (if `DATABASE_URL` set).

> Env-name correction vs the kickoff: the bot reads **`DISCORD_TOKEN`** (not `DISCORD_BOT_TOKEN`);
> `DISCORD_APP_ID` is unused.

## B1 — Paddle (real commerce; Paddle = Merchant of Record) — ADR-0108

Paddle is the **MoR**: it collects + remits global tax/VAT and owns the buyer invoice — the operator
does NOT register for or remit sales tax. (Switched from Stripe — ADR-0108.) Use **Paddle Billing**,
not legacy Paddle Classic.

1. **Account:** sign up at paddle.com → Paddle **Billing**; complete seller verification (website =
   `caisson.sh`, business details). Wire + smoke in the **Sandbox** environment first; flip to
   **Production** for go-live.
2. **Catalog — Products + Prices** matching the **ADR-0137** edition reprice (below module-sum; the
   recurring SKUs + grandfathering hold from **ADR-0106**). Paddle dashboard → Catalog, or the API.
   One Paddle Price per SKU:

   | Product                 | Price            | Billing                                                               |
   | ----------------------- | ---------------- | --------------------------------------------------------------------- |
   | Compliance              | $749.00          | one-time                                                              |
   | All-Access Bundle       | $1,499.00        | one-time                                                              |
   | AI Production Kit       | $599.00          | one-time                                                              |
   | Local-first AI          | $349.00          | one-time                                                              |
   | Agentic-Dev             | $249.00          | one-time                                                              |
   | Per-module (à la carte) | from $99.00      | one-time (one price per module — the ADR-0129 module sheet: $99–$299) |
   | Compliance-Updates      | $1,499.00 / year | recurring annual                                                      |
   | Developer               | $499.00 / year   | recurring annual                                                      |
   | Enterprise / SLA        | —                | no price (Contact us, ADR-0095 §2)                                    |

   Agentic-Dev is now **as-if-live buyable** ($249, ADR-0130 supersedes the ADR-0082 §4 roadmap-gating
   — the storefront presents all four editions with real prices).

3. **Keys → `~/.gridwork/env`:** Developer Tools → Authentication →
   `PADDLE_API_KEY` (server; `pdl_sdbx_*` sandbox / `pdl_live_*` prod) + `PADDLE_CLIENT_TOKEN`
   (Paddle.js checkout on `apps/site`) + set `PADDLE_ENV=sandbox|production`.
4. **Capture the Paddle Price `id`s** → hand to the code track for `@caisson/pricebook`
   (`providerPriceId → creditsPerCycle` / entitlements). ✅ **No metadata-stamping hack** — the
   account/tenant id rides as Paddle **`custom_data`** at checkout and propagates onto
   `transaction.completed` (ADR-0108; this is exactly the Stripe gotcha Paddle removes).
5. **Webhook:** Developer Tools → Notifications → add a destination at the deployed license/billing
   webhook (`services/license`); subscribe **`transaction.completed`** (grant trigger — fires on the
   initial purchase + every renewal) + `subscription.created/activated/canceled` (lifecycle). Capture
   `PADDLE_WEBHOOK_SECRET` → `~/.gridwork/env`. The endpoint reads the **raw** body and verifies via
   `paddle.webhooks.unmarshal(rawBody, secret, signature)`.
6. **Smoke (sandbox):** run a sandbox checkout → `transaction.completed` fires → assert the (reworked)
   cycle→grant mapper credits the wallet + grants entitlements. Paddle's dashboard can simulate/replay
   webhook events for the smoke; no local CLI tunnel required.

## Railway CLI deploy (exact commands)

CLI authenticated as GridWork.dev. Secrets read from `~/.gridwork/env` at runtime (never inlined).
Prod-project creation + deploys are operator-gated DEPLOY acts.

```bash
cd ~/lab/caisson-ops
railway list                                   # confirm workspace
railway init --name caisson-prod               # workspace = GridWork.dev

# docs-service — subpath Dockerfile, build context = repo root (RAILWAY_DOCKERFILE_PATH)
railway add --service caisson-docs
railway variables --service caisson-docs \
  --set "RAILWAY_DOCKERFILE_PATH=services/docs/Dockerfile" \
  --set "DOCS_SERVICE_TOKEN=$(grep -E '^(export )?DOCS_SERVICE_TOKEN=' ~/.gridwork/env | sed -E 's/^(export )?DOCS_SERVICE_TOKEN=//')" \
  --set "OPENROUTER_API_KEY=$(grep -E '^(export )?OPENROUTER_API_KEY=' ~/.gridwork/env | sed -E 's/^(export )?OPENROUTER_API_KEY=//')"
railway up -y --service caisson-docs --ci
railway domain --service caisson-docs           # → DOCS_SERVICE_URL

# support-bot — self-contained Dockerfile (context = its own dir)
railway add --service caisson-support-bot
railway variables --service caisson-support-bot \
  --set "DISCORD_TOKEN=$(grep -E '^(export )?DISCORD_TOKEN=' ~/.gridwork/env | sed -E 's/^(export )?DISCORD_TOKEN=//')" \
  --set "OPENROUTER_API_KEY=$(grep -E '^(export )?OPENROUTER_API_KEY=' ~/.gridwork/env | sed -E 's/^(export )?OPENROUTER_API_KEY=//')" \
  --set "DOCS_SERVICE_URL=https://<caisson-docs-domain>" \
  --set "DOCS_SERVICE_TOKEN=$(grep -E '^(export )?DOCS_SERVICE_TOKEN=' ~/.gridwork/env | sed -E 's/^(export )?DOCS_SERVICE_TOKEN=//')"
railway up -y --service caisson-support-bot ./services/support-bot
```

- docs-service runs the **FTS5 floor** until the code-track OpenRouter embedder lands; redeploy after.
- Set the bot's `DOCS_SERVICE_URL` to the docs domain from `railway domain`, then redeploy the bot.

## Code-track hand-off (NOT this operator session — file under code track, ADR-0109+)

1. **docs-service real embedder** — implement an `OpenRouterEmbedder` (the `@caisson/local-store`
   `Embedder` port) calling `qwen3-embedding-8b` via `fetchWithTimeout`; wire at `server.ts:33`, gated
   on `OPENROUTER_API_KEY`. Lights up the vector leg (B3). No env flip exists today — it is code.
2. **license-verify re-bake** — swap the KAT vector at `packages/license-verify/src/verify.ts` for the
   provisioned public SPKI (`infra/license-issuer/ISSUER_PUBLIC_KEY.md`); update the token KAT tests.
3. **license issuer sign path (I1)** — load `CAISSON_LICENSE_SIGNING_KEY`, sign kernel-canonical claims
   (Ed25519). Consumes the keypair provisioned this session.
4. **billing mapper Stripe→Paddle (ADR-0108) + pricebook numbers (ADR-0106)** — rework the ADR-0089
   mapper: parse Paddle `transaction.completed` (not Stripe `invoice.paid`), key `@caisson/pricebook`
   on Paddle Price ids (`providerPriceId`), read the account from `custom_data`, verify webhooks via
   `@paddle/paddle-node-sdk`; set the ADR-0106 amounts. Drop the Stripe metadata-stamping workaround.

## Go-live flip (ADR-0107) — the last act

After B1–B4 + the code-track items land and Compliance is buyable end-to-end (402 → checkout → grant →
entitlement → license issued → offline verify), execute the deliberate CF-Access flip: `rm
infra/terraform/access.tf` + `terraform apply` (or policy → bypass/everyone) and verify `caisson.sh` +
`www` serve publicly.

> **UPDATED 2026-06-30 (ADR-0114/0115/0117):** the site origin is **no longer `*.pages.dev`** — the
> marketing site + docs UI + `/dashboard` migrate to a unified Next app on **Railway** (Part C below).
> CF Access is **hostname-bound**, so it carries over the DNS flip with zero changes; Access removal is
> the deliberate last act here, AFTER Pages is retired (Part C step 7). The "seal the pages.dev origin"
> note above is moot post-cutover.

---

# Part C — Site → Railway cutover + CI rewire (2026-06-30 plan)

Full plan in this doc; companions: `services-hardening-audit.md` (gaps), `adapter-expansion.md`
(drivers). **CF Access stays ON throughout; Pages teardown is the LAST step (C7); Access removal is a
separate future act (C8).**

## C.0 — Railway provisioning (operator-locked, 2026-06-30 picker)

`caisson-prod` — **one service each** (6 resources): `caisson-site` (NEW unified Next app — marketing +
docs + `/dashboard`, `apps/site/Dockerfile`, build-on-Railway), `services/docs` (live, keep),
`services/license` (`license.caisson.sh` — issuer + **Paddle webhook**, hardening #3),
`services/support-bot` (live, keep), **Postgres** (platform DB, ADR-0115), **SigNoz** stack
(ClickHouse + otel-collector + UI, **self-host NOW**, ADR-0117 — **UI behind CF Access**). Plan **Pro**,
~512MB–1GB autoscale per service.

## C.1 — Registry Worker STAYS on Cloudflare Workers (no migration)

`caisson-registry` is a Workers script (`registry/worker/deploy.sh` → `wrangler deploy`), not the Pages
project — zero `apps/site` coupling, no DB (`node:crypto` Ed25519 + inlined `index.json`), edge-served.
Retiring the Pages project does not touch it. **Action: none.** Fast-follow (independent): custom route
`registry.caisson.sh`.

## C.2 — CI rewire (preserve required checks `check` · `standards-gate` · `registry-index`)

Branch protection matches the **job name**, not the file. The 3 required jobs stay **unconditional, no
`paths:`** in `ci.yml`; affected-only runs **inside** `check` via `turbo … --affected` (exits 0 in
seconds on an empty set). New files: `quality.yml` (eval/token-drift/native-ext — non-required,
`dorny/paths-filter`-gated), `publish.yml` (publish-and-index), `deploy-railway.yml` (`railway up
--service caisson-site --ci`, project token, build-on-Railway, no DNS/Access touched). Keep
`lighthouse.yml` (retarget Node build) + `support-bot.yml`. Cache: `actions/cache` over `~/.bun/install/cache`

- `.turbo` (fleet containers are throwaway → cache must be network-backed); `--affected` needs
  `fetch-depth: 0` + `TURBO_SCM_BASE/HEAD`; keep `--no-daemon --concurrency=50%`.
  **THE TRAP:** never `paths:`-skip a required job → it never reports → merge blocked forever.
  **Retire `deploy-site.yml` at C7, not before.**

## C.3 — Pages Functions re-home (owned by `apps/site`; verify in Phase 2 diff)

`functions/api/waitlist.ts` → **MIGRATE** to `app/api/waitlist/route.ts` (LIVE — `UpdatesForm` POSTs it
on 5 surfaces). `functions/_middleware.ts` → **SPLIT** (headers → `next.config.ts headers()`/`middleware.ts`;
**drop** the `*.pages.dev`→apex 302). `public/_headers` → **MIGRATE** CSP+headers to `next.config.ts`
(opportunity: Node nonce → drop `script-src 'unsafe-inline'`). `wrangler.jsonc` → **DROP** at teardown.

## C — Cutover steps (sequenced · CF Access stays · Pages last · reversibility)

| #   | Step                                                                                                                                                                                         | Class      | Reversible                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------- |
| C1  | Land standalone app on main: `output:'standalone'`, Dockerfile, railway.toml, the C.3 re-homes, `/dashboard`. CI green.                                                                      | autonomous | ✅ code-only                           |
| C2  | Create Railway `caisson-site` (Root `/`, `RAILWAY_DOCKERFILE_PATH=apps/site/Dockerfile`); provision PG; set env/secrets; mint CI `RAILWAY_TOKEN`.                                            | DEPLOY     | ✅ delete service                      |
| C3  | First deploy `railway up --service caisson-site`; capture `*.up.railway.app`.                                                                                                                | DEPLOY     | ✅ delete revision                     |
| C4  | **VERIFY on Railway (no prod traffic):** `/health`, SSG, `/docs`, `/api/waitlist`, `/dashboard` `withTenant`, headers/CSP, lighthouse.                                                       | verify     | ✅ no exposure                         |
| C5  | **DNS flip:** apex+www CNAME `caisson-site.pages.dev`→`*.up.railway.app`, **keep `proxied=true`**; add caisson.sh+www as Railway custom domains; CF SSL **Full**. **`access.tf` untouched.** | DEPLOY     | ✅ flip CNAME back                     |
| C6  | **VERIFY caisson.sh:** Access-gated, Railway-served, all routes + `/dashboard`, CDN caching. Soak.                                                                                           | verify     | ✅ C5 rollback                         |
| C7  | **Retire Pages LAST:** delete `caisson-site` Pages project; remove `deploy-site.yml`, `wrangler.jsonc`, `public/_headers`, `functions/`, Pages-only Terraform. **NOT `access.tf`, NOT DNS.** | DEPLOY     | ⚠️ least reversible — gate behind soak |
| C8  | _(future, separate — the ADR-0107 act above)_ remove CF Access.                                                                                                                              | DEPLOY     | —                                      |

## C — Hardening blockers before public exposure (`services-hardening-audit.md`)

**#1 HIGH** docs per-IP rate-limit · **#2 MED** wire ADR-0112 MCP rate-limit hook (built, inert) ·
**#3 MED** bind the **Paddle** webhook at `services/license` (`Paddle-Signature`, timing-safe HMAC) →
**both** credit + entitlement grant (today `apps/base` hardcodes `stripe-signature` + the entitlement
handler is bound nowhere → **purchases won't provision**) · #4 license `/issue` rate-limit · #5
support-bot RAG fencing · #6 docs `Cache-Control` · #7 `apps/base` HSTS. #2/#3 confirm against the
deploy entrypoint before commerce go-live.

## C — Build sequencing

1. **Parallel-safe now** (independent of Phase 2's `apps/site`): CI rewire (`.github/`); independent
   hardening (#1,#4,#5,#6,#7 + #3 in `services/license`).
2. **On Phase 2 landing:** review diff vs the C.3 re-home checklist; wire #2 + confirm #3 at the
   entrypoint; integrate.
3. **Gated (operator DEPLOY):** C2–C7 + the ADR-0107 Access removal (C8).
