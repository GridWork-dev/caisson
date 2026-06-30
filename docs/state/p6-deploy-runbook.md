# P6 go-live deploy runbook (Part B — DEPLOY-class)

Operator runbook for the P6 commerce/deploy seams. Companion to `readiness-and-backlog.md` §2 and the
ADR-0107 go-live checklist. **Every step here is operator-gated** (real money / public bot / secrets).
Creds source from `~/.gridwork/env` (NO 1Password). This session pre-built what it could in-lane;
the live deploys + cred-bearing accounts are the operator's acts.

Platform = **Railway** (ADR-0105, operator-locked 2026-06-30). The license issuer (code-track I1) and
the commerce backend follow the same posture.

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
2. **Catalog — Products + Prices** matching the **ADR-0106** lock (Paddle dashboard → Catalog, or the
   API). One Paddle Price per SKU:

   | Product                 | Price            | Billing                            |
   | ----------------------- | ---------------- | ---------------------------------- |
   | Compliance              | $2,499.00        | one-time                           |
   | Everything Bundle       | $3,499.00        | one-time                           |
   | AI Production Kit       | $599.00          | one-time                           |
   | Local-first AI          | $499.00          | one-time                           |
   | Per-module (à la carte) | from $49.00      | one-time (one price per module)    |
   | Compliance-Updates      | $1,499.00 / year | recurring annual                   |
   | Developer               | $499.00 / year   | recurring annual                   |
   | Enterprise / SLA        | —                | no price (Contact us, ADR-0095 §2) |

   Agentic-Dev = labeled-roadmap (ADR-0082 §4) — no active price.

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
infra/terraform/access.tf` + `terraform apply` (or policy → bypass/everyone), seal the `*.pages.dev`
origin via the Pages-native Access integration, and verify `caisson.sh` + `www` serve publicly.
