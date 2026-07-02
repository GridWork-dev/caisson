# Readiness & Backlog — Caisson

Operator-actionable companion to `docs/build-state.md` (the build-status SOT). Three buckets from
the **2026-06-29 state investigation** (5-agent fan-out + live Worker smoke-test + on-box gate run):
**(1)** live-test readiness, **(2)** configuration / secrets checklist, **(3)** prioritized next-work
backlog with fork gates. Canonical _decisions_ stay in `knowledge/decisions/` (ADRs); the live
_fork_ board stays in `docs/state/decisions-and-forks.md`. This file is a readiness map, not a
decision record.

Verified against `main` post-**PR#31** (2026-06-30 — the P6 integration: the go-live operator gates
`ADR-0106`–`0109` + the unattended code track `ADR-0110`–`0113` merged in one branch on top of the
earlier W1/W2/B1/B2 + design + CI-fleet stack). Evidence: code-on-disk, ADR trail, a live HTTP
smoke-test of the deployed Worker, and `bun run check` (125/125 + kernel gate) on-box.

> **Post-P6-integration triage (2026-06-30) — three buckets:**
> **A) P6 tail (build, autonomous-capable):** buyer/seller dashboards (host/DB topology locked
> 2026-06-30, `ADR-0114`/`0115` — one dynamic Next 16 app on Railway + Railway Postgres, now BUILDING).
> The **live registry index backfill is DONE in-repo** (7 → 27/27 modules, commits `695385d`+`505005e`
> on main); only the deployed Worker's stale bytes remain — see bucket B.
> **B) Go-live execution (operator / DEPLOY-class, gated):** Paddle account + creds → Stripe→Paddle
> mapper rework + webhook smoke · real checkout wiring + EULA drafting · CF-Access flip (the launch
> act, `ADR-0107`, re-homed onto the Railway origin by `ADR-0114`) · Discord — enable the two privileged
> intents + wire `SUPPORT_CHANNEL_ID`/
> `MEMBER_ROLE_ID` + scope the bot role down from Administrator · rotate the leaked Discord/OpenRouter
> creds · durable `deploy-site` CI token (Pages:Edit) · **redeploy the registry Worker** to pick up the
> already-backfilled 27-module index · Railway app/DB provisioning + DNS cutover (`ADR-0114`/`0115`).
> **C) P7+ roadmap (later):** OSCAL push · compliance vertical packs · marketplace.
> **Forks: none blocking** (pricing/CF-Access/docs/dashboard-host/DB all locked; see §4).

> **Stage-2 integration + deploy (2026-07-01):** the four Stage-2 streams + the deploy-prep branch are
> folded into **`integration/stage2`** (Streams A/B/C/D); **ADR ceiling `0176`**. The live Railway
> services **`caisson-site` + `caisson-license` are ● ONLINE + verified running this code** (site
> routes 200 with security headers + Paddle CSP; license `/health` 200, `/issue` gated 401; live DB
> migrated + verified: app role NOSUPERUSER/NOBYPASSRLS, 5 tenant tables FORCE-RLS, 4 better-auth
> tables, idempotent). `registry/index.json` is rebuilt **27 → 32 modules** (5 Stage-2 modules
> published, byte-identical round-trip). **DEPLOY EXECUTED (2026-07-01):** DNS cutover applied
> (caisson.sh/www/admin/license → Railway, Pages custom-domains detached); `caisson-admin` + the SigNoz
> 5-service stack provisioned; `admin` PG role created; registry Worker **redeployed** (serves the
> rebuilt 27→32 index); OTLP wired on the fleet. **Fast-follows still open:** SigNoz `SIGNOZ_API_KEY`
> (create in the Access-gated UI) + ingester TCP-proxy for CF-Worker OTLP; full Cloudflare Pages
> **project** deletion (post-soak — custom domains already detached); one **open operator decision**
> (edition members-fold, §4). New backlog items bucketed into §3.

> **Edition seam-completion + provider cutover (2026-07-01, later same day — supersedes the `0176`
> ceiling above):** **ADR ceiling is now `0185`.** The provider picker **LOCKED (`ADR-0177`/`0178`):**
> Grafana Cloud is the SOLE OTLP sink — the 5 SigNoz Railway services are **deleted**; the "SigNoz
> `SIGNOZ_API_KEY`" fast-follow above is now **moot**. The **"edition members-fold" decision is now
> CLOSED — `ADR-0178`** (folds `alerting`/`retention-runner` into Compliance, `tool-exec` into
> Agentic-Dev; PR#34) — no longer an open operator decision (see §4). The **edition seam-completion**
> picker then BUILT an OSCAL v1.2.2 export across all 3 frameworks, the free-BYOK billing policy +
> buyer key-submission UI (closes the §3 "C7 write-half BYOK" item below), and a manual Bun request-span
> helper (`ADR-0179`-`0185`).

> **DEPLOY-class + backlog-P3 executed (2026-07-01, latest — closes the fast-follows above):** ADR ceiling
> is now **0188** (PR#35 seam + PR#36 audit-harness ADR-0188 + PR#37 backlog-P3, all merged to `main` @
> `84052aa`). **DEPLOY-class DONE:** `caisson-license` + `caisson-docs` **redeployed** from `main` (both
> `/health` 200; license's idempotent `preDeployCommand` migrate re-ran) so the seam's `withRequestSpan`
> Bun-OTel spans now emit; **Grafana OTLP verified provisioned** on both services
> (`OTEL_EXPORTER_OTLP_ENDPOINT` → `otlp-gateway-prod-us-west-0.grafana.net`, matching the operator Grafana
> creds) — spans export to the sole sink (ADR-0177). **Cloudflare Pages teardown DONE** — the account has
> **0 Pages projects** (the `caisson-site` project is gone; DNS already on Railway), so the "Pages project
> deletion (post-soak)" fast-follow is complete. The "SigNoz `SIGNOZ_API_KEY` + ingester TCP-proxy"
> fast-follow stays **moot** (SigNoz deleted, ADR-0177). **Backlog P3 DONE** (PR#37): the 3 defense-in-depth
> items in §3 (members `.strict()` + fail-closed demo field-crypto in local-ai/compliance) are merged.
> **No DEPLOY-class fast-follows remain open.** Next: the whole-repo multi-model audit (READY,
> `outputs/specs/lift-phase/AUDIT-RUNBOOK.md`) then the two LIFT sellables (ADR-0186/0187).

> **Post-go-live security + ops hardening (2026-07-02 — supersedes the `0188` ceiling above):**
> **ADR ceiling is now `0209`.** PR#45 (`fix/security-billing-hardening` — Strix pentest remediation,
> `ADR-0204`) and PR#46 (`chore/edition-tails-ops`, `ADR-0205`–`0209`) both merged to `main`; both
> branches + worktrees are deleted. Closes **C5 local-ai `RentedTransport` drivers** (Azure + Bedrock
> hand-rolled SigV4, `ADR-0209` — see §3) and ships the CAISSON-3 support-bot→Linear-Triage sink
> (`ADR-0206`; detail: `docs/state/linear-integration.md`). `ADR-0208` also locks five ops-hardening
> items: BYOK/attestation writes are now owner-only (fixes Strix vuln-0006), `oscal-conformance` joins
> the required branch-protection checks, the Terraform-remote-backend migration stays deferred with a
> documented reason (see §2 Ops hygiene), OSCAL `rlink` hosting is won't-fix, and the first-ever
> changeset consume republished the registry ledger/index at **0.2.0** (ledger/index-only;
> `CAISSON_PUBLISH_DRY_RUN` stays `true`). The admin `/ops` cockpit is rebuilt off the deleted SigNoz
> API onto Grafana Cloud's Tempo query API (`ADR-0207`), and the admin CF-Access gate gains a
> fail-closed in-app JWT check (`ADR-0204`, supersedes the `ADR-0140` edge-alone posture). **The
> deploy wave EXECUTED 2026-07-02** — the 5-service Railway redeploy (4/5 verified live;
> `caisson-support-bot` recovering from a transient Discord CF-1015 egress-IP ban at first boot),
> the registry Worker redeploy (0.2.0 index verified), the `caisson-admin`/`caisson-support-bot`
> env-var sets (`CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD`, `GRAFANA_URL`/`GRAFANA_QUERY_TOKEN`/
> `GRAFANA_TEMPO_DATASOURCE_UID`, `LINEAR_API_KEY`/`LINEAR_TEAM_ID`/`LINEAR_TRIAGE_STATE_ID`),
> and the 3 SigNoz volume deletions (purge 2026-07-04) all ran. The one item then still in-flight
> elsewhere — `feat/lift-harvest` — merged the same day (next banner).

> **Lift-harvest slice-2 + CI rework merged (2026-07-02, latest — supersedes the `0209` ceiling
> above): ADR ceiling is now `0217`.** PR#47 (`feat/lift-harvest`) merged to `main` (branch +
> worktree pruned): the **harvest program is TERMINAL** (`docs/state/harvest-program.md` §Terminal
> states) — net-new **`@caisson/agent-runner`** (sandboxed, governed agent execution; `ADR-0186`
> filed from its reservation) + a 10-package hardening wave (jobs consumer-side · kernel
> branded-money/rounding-provenance · ai-kit metered embeddings · ai-evals eval-science depth ·
> guardrails egress-gate+FTC-4Ps · mcp-server manifest retirement ledger · ai-meter
> dedup-before-meter · tenancy-rls · billing · ai-config; `ADR-0210`–`0217`, drafted 0204–0211 and
> renumbered at merge per ADR-0088). The §3 "D6 harvest" row is closed. **PR#51** then landed the
> CI/credit rework: Greptile auto-review OFF → the path-scoped **`greptile-gate`** required check
> (replaces `Greptile Review` in branch protection; security-critical paths only), and the fleet
> jobs re-pointed to the **`caisson-amd64` runscaler scale set** (ephemeral, label-less — the
> `gw-linux-amd64` runner names in §0/§2 below are the pre-runscaler names). Nothing new is
> deployed from these merges (library/CI surface only — no Railway service redeploy needed until
> the next deploy wave).

## 0. Live verification done this session

- **Registry Worker — LIVE + smoke-tested GREEN.** `https://caisson-registry.broken-wood-97a9.workers.dev`:
  `/index.json` → 200 (serves the real allowlist), `/modules/@caisson/ai-evals` → 200, `/nope` → 404,
  `POST` → 405 (GET-only). At the time of that smoke-test the **deployed** Worker bundle still carried
  only **7 modules**. **The in-repo backfill is now DONE:** `registry/ledger.jsonl` carries **27
  entries** (commit `695385d` "chore(registry): backfill ledger + index 7 -> 27 modules", reconciled by
  `505005e`) — every publishable package in `packages/*` except the intentionally never-published
  `@caisson/license-issue` (ADR-0110's private signer); `registry/index.json` is a byte-for-byte rebuild
  of that ledger (CI-gated, ADR-0021/0047 provenance check). **Gap that remains:** the **deployed**
  Worker bundle (`registry/worker/deploy-entry.ts`, which inlines `index.json` at deploy time) was last
  deployed against the 7-module index — a **DEPLOY-class, operator-gated redeploy** (`registry/worker/deploy.sh`)
  is the only remaining step to serve the full 27-module set live. Do not conflate "ledger/index backfilled
  in-repo" (done) with "Worker serves it" (pending deploy).
- **Whole-monorepo gate** — `bun run gate` (standards-gate) green ("36 checked, 2 scaffold-skipped,
  all conform, ADR-0002"); `turbo run build lint test` green on-box (`--concurrency=50%` per the
  PGlite-fan-out gotcha).
- **CI moved onto the self-hosted fleet** (this session, PR#22). Caisson's 3 GridWork-dev runners
  (`gw-linux-amd64` · `gw-linux-arm64` · `gw-macos-arm64`) are registered + ONLINE; the pure-compute
  gate jobs (`standards-gate` · `check` · `eval` · `registry-index` · `token-drift` + `native-ext`
  linux leg) now `runs-on` the fleet, while the write/deploy/browser jobs (`publish-and-index` ·
  `deploy-site` · `lighthouse`) deliberately stay GitHub-hosted. **First-run verified on PR#22:** the
  amd64 jobs dispatch + run (they serialize on the one amd64 runner; `eval` passed first). Posture +
  the CI owner doc: `docs/operations.md` §7. **Open follow-up (below):** the macOS `native-ext` leg is
  still on GitHub-hosted `macos-latest` — the fleet macOS lane dispatches but lacks Homebrew SQLite.

## 1. Live-test readiness matrix

What is built and how far it can be exercised. **now-local** = runs on-box with no external account
(PGlite / local doubles / CLI). **needs-config** = one secret/env flips it live. **needs-external** =
needs a real external account, infra, or deploy (DEPLOY-class, operator-gated).

### now-local (exercisable today, no account)

| Surface                         | What to run                                                                    | Note                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Whole monorepo gate             | `bun run check` (`turbo build·lint·test` + standards-gate)                     | green on `main`; `--concurrency=50%` avoids PGlite `beforeAll` timeout      |
| `apps/base` capstone            | the real-HTTP `402 → grant → 200 → MCP` integration test                       | PGlite + fake webhook secret; no Neon/Stripe/network                        |
| `create-caisson` CLI generate   | run the bin → allowlist-gate → templated write → git-init                      | local generate is **free** (never debits, ADR-0093)                         |
| Buyer MCP `generate` logic      | validate → entitlement-expand → debit → write → audit-row                      | logic testable; the live MCP **stdio/SSE transport is un-wired**            |
| `field-crypto` round-trip       | `bun test packages/field-crypto`                                               | AES-256-GCM + envelope + per-tenant HKDF + crypto-shred; `node:crypto` only |
| `audit-worm` local store        | `bun test packages/audit-worm` (LocalArtifactStore)                            | WORM hash-chain + retention + GOVERNANCE write-once; S3 path is the stub    |
| `ai-kit` gateway                | gateway composition test (model mocked)                                        | prompt→guardrails→meter reserve→model→reconcile→guardrails                  |
| `local-ai` built paths          | privacy/egress guard + sqlite-vec ANN + offline Ed25519 + two-way sync         | inference is the stub backend                                               |
| `compliance` evidence + signing | evidence collectors + SOC2/HIPAA/EU-AI-Act catalogs + Ed25519 sign + OSCAL map | pure/deterministic; OSCAL **map** is local, OSCAL **push** is P7            |
| `billing` webhook→grant         | `verifyAndParse` (HMAC raw-body) → `grant()`                                   | exercised in the `apps/base` loop with a hand-signed body                   |
| Edition reference apps          | `bun --filter ./apps/<edition> dev` (PGlite-backed)                            | run/build locally; **none deployed** (deploy = needs-external)              |
| Registry Worker                 | HTTP smoke (done above)                                                        | LIVE                                                                        |

### needs-config (one secret flips it live)

| Surface                                       | Flip                                                               | Gates                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Paddle checkout + webhook + cycle→grant (X-2) | `PADDLE_API_KEY` + `PADDLE_WEBHOOK_SECRET` + `PADDLE_CLIENT_TOKEN` | mapper exists but Stripe-shaped — rework Stripe→Paddle (ADR-0108) |

### needs-external (real account / infra / deploy — DEPLOY-class)

| Surface                                             | Needs                                                                   | ADR      |
| --------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| `audit-worm` S3 Object-Lock (court-admissible WORM) | AWS account + S3 bucket **created with Object-Lock** + IAM creds        | ADR-0054 |
| `field-crypto` cloud KMS envelope                   | cloud KMS account + CMK + `awsKmsClient()` body + `@aws-sdk/client-kms` | ADR-0045 |
| `ai-kit` live provider inference                    | a provider account + key in `lane.apiKeyEnv` (BYOK — buyer supplies)    | ADR-0059 |
| `local-ai` ONNX on-device                           | install `onnxruntime` peer + one-time HF model download + SHA pins      | ADR-0064 |
| `local-ai` rented/hosted inference                  | hosted endpoint + key + explicit privacy-policy allowlist entry         | ADR-0064 |
| Edition reference apps (deployed)                   | a hosting target (none wired)                                           | ADR-0044 |
| `compliance` OSCAL push                             | a real GRC platform OSCAL ingest endpoint                               | P7       |

## 2. Configuration & secrets checklist

### Configured + live (no action)

- **Cloudflare Pages** `caisson-site` (Terraform, direct-upload, production_branch=main) — site GREEN.
- **caisson.sh DNS** (apex + www proxied CNAMEs → `caisson-site.pages.dev`) + custom-domain bindings.
- **Terraform Cloudflare creds** (`TF_VAR_cloudflare_api_token` etc., gitignored `terraform.tfvars`).
- **Registry Worker** `caisson-registry` — LIVE, no runtime secret (index inlined at build).
- **CI deploy secrets** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (gh repo secrets, set 2026-06-28).
- **Module publish auth** — built-in ephemeral `GITHUB_TOKEN` + `packages:write` (ADR-0069); no stored PAT.

### Go-live blockers (must change to launch public commerce)

- **Cloudflare Access pre-launch gate** (`access.tf` APPLIED) — `caisson.sh` + `www` sit behind
  email-OTP, restricted to `@gridwork.dev`. For a public v1 launch this gate **must be removed**
  (delete `access.tf` + `terraform apply`) or flipped to bypass. **DEPLOY-class, operator-gated.**
  Sequencing + go-live checklist locked: **ADR-0107** (keep gated until checkout works + Compliance
  buyable; pages.dev sealed via Pages-native Access at flip).
- **Paddle** (Merchant of Record, ADR-0108 — switched from Stripe) — `PADDLE_API_KEY` +
  `PADDLE_WEBHOOK_SECRET` + `PADDLE_CLIENT_TOKEN`; **real commerce blocker**, no account/keys yet.
  Needed for live paid checkout + the X-2 grant path (the mapper is reworked Stripe→Paddle, code track).

### Provisioned this session (P6 operator-gates, 2026-06-30)

- **License issuer keypair (B4)** — Ed25519 generated + round-trip-verified; private →
  `~/.gridwork/env` (`CAISSON_LICENSE_SIGNING_KEY`), public → `infra/license-issuer/ISSUER_PUBLIC_KEY.md`.
- **`DOCS_SERVICE_TOKEN` (B3)** — minted → `~/.gridwork/env` (shared docs-service ⇄ support-bot bearer).
- **Railway deploy configs** — `services/docs/{Dockerfile,railway.toml}` + repo-root `.dockerignore` +
  `services/support-bot/railway.toml` (platform = Railway, ADR-0105).
- **Full Part-B runbook** (Stripe · docs-service · support-bot · go-live flip + the code-track
  hand-off): **`docs/state/p6-deploy-runbook.md`**.

### Missing — un-exercised seams (needed only when that surface goes GA)

| Need                | Env / resource                                                                                                                               | When                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Database            | Neon Postgres `DATABASE_URL`                                                                                                                 | when an edition/reference app runs live (not for the static site)                |
| Auth runtime        | better-auth instance + `BETTER_AUTH_SECRET` + PG store                                                                                       | when a logged-in surface ships                                                   |
| Field encryption    | `MASTER_FIELD_KEY` + `FIELD_CRYPTO_SALT` (each 32-byte hex)                                                                                  | when the compliance edition runs live                                            |
| Field KMS (alt)     | `KMS_KEY_ID` + cloud KMS creds                                                                                                               | optional alternative to `MASTER_FIELD_KEY`                                       |
| WORM store          | AWS S3 bucket w/ Object-Lock + creds — ✅ **provisioned** (`caisson-worm`, us-east-1, `infra/worm/provision.ts`; live proof green, ADR-0201) | done (2026-07-01, editions-go-live); prod IAM = the scoped prover-policy pattern |
| AI provider keys    | per-lane `apiKeyEnv` (OpenAI/Anthropic/Google)                                                                                               | **BYOK** — buyer supplies, not operator                                          |
| Job queue           | Trigger.dev project + key                                                                                                                    | when a live queue is required (in-memory driver ships)                           |
| Transactional email | Resend API key (injected at composition)                                                                                                     | when live email ships (capture driver is exercised)                              |
| License issuer      | Ed25519 signing **keypair** — ✅ **provisioned** (`CAISSON_LICENSE_SIGNING_KEY` in env; public → `infra/license-issuer/`)                    | P6/B4 done; code-track bakes the public key + builds the issuer sign path        |
| Waitlist function   | `RESEND_API_KEY` + `RESEND_SEGMENT_ID` (+ Turnstile, KV RL)                                                                                  | legacy/secondary seam post-ADR-0082 self-serve flip                              |
| Lighthouse CI       | `LHCI_GITHUB_APP_TOKEN`                                                                                                                      | optional — audit runs without it (no GitHub status post)                         |
| Discord OAuth link  | `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET` (`caisson-site`)                                                                               | ADR-0203 — unset ⇒ Discord drops out of the better-auth provider list            |
| Discord role push   | `SUPPORT_BOT_URL` + `SUPPORT_BOT_GRANT_TOKEN` (`caisson-license` **and** `caisson-site`)                                                     | ADR-0203 — unset ⇒ the post-grant push and `/api/discord/backfill` no-op         |
| Discord role push   | `BILLING_GRANT_TOKEN` (`caisson-support-bot`)                                                                                                | ADR-0203 — unset ⇒ bot serves only `/health`, `POST /billing-grant` off          |

### Ops hygiene (non-blocking)

- **Terraform state is LOCAL + gitignored.** **Investigated + deferred with a documented reason**
  (`ADR-0208`, 2026-07-02): R2 silently ignores S3 conditional-write headers, so Terraform's
  `use_lockfile` is a no-op on R2 — "R2 + lock" isn't achievable with the stock S3 backend.
  Single-operator, zero CI applies ⇒ no active trigger; the locking-gap + real options (accept-no-lock
  on R2 / a Worker-DO lock backend / AWS S3+DynamoDB) are recorded in `infra/terraform/README.md` +
  `docs/operations.md` for a future migration.
- **Registry tamper-prevention** — `CODEOWNERS` present + `registry-index` job detects hand-edits;
  PREVENTION needs `registry-index` marked a required check + branch protection (operator GitHub
  settings, tracked on the fork board).
- **`CAISSON_PUBLISH_DRY_RUN`** — the `publish-and-index` job is wired + active but dry-run by default;
  set `=false` to actually publish (moot until editions are GA + the publishability flip lands).
- **Move the macOS `native-ext` CI leg onto the fleet** — provision Homebrew + extension-capable
  SQLite for the Mac mini's runner user, then flip that leg `runs-on: macos-latest` → `runs-on:
[self-hosted, gw-macos-arm64]` (saves the ~10×-cost hosted macOS minutes). The fleet macOS lane
  already dispatches (checkout + `bun install` green on PR#22); only the `brew install sqlite` prereq
  is missing. `docs/operations.md` §7.
- **Single amd64 runner serializes fleet CI** — the gate jobs run one-at-a-time on the one
  `gw-linux-amd64` runner (vs parallel on GitHub-hosted), so PR wall-clock is the serial sum. Fine for
  a solo repo; add a second amd64 lane if wall-clock becomes a constraint.

## 3. Next-work backlog (prioritized, fork-gated)

P5 is SHIPPED; editions merged-but-partial; Worker LIVE; edition VERIFY-debt closed. **P6 is nearly
complete** after the 2026-06-30 integration — the registry index backfill is **DONE in-repo** (27/27
modules); only dashboards (now BUILDING, `ADR-0114`/`0115`) remain as build work; everything else is
go-live (operator/DEPLOY-class, including the registry Worker redeploy) or P7 roadmap.

### P6 — Commerce + support + docs (status after the 2026-06-30 integration)

| Item                                                           | State                                           | Note                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/license` Ed25519 **issuer** + `POST /issue`          | **BUILT** (`ADR-0110`)                          | private `@caisson/license-issue` signer + baked production verify-key; lazy bearer-gated issue endpoint resolves entitlements + signs                                                                     |
| X-2 billing: `@caisson/pricebook` + cycle→grant mapper         | **BUILT** (`ADR-0089`/`0098`)                   | numbers locked `ADR-0106`; mapper is currently Stripe-shaped — **Stripe→Paddle rework is the remaining wiring** (`ADR-0108`, needs Paddle creds)                                                          |
| Entitlement resolver + **revoke + one-time + refund clawback** | **BUILT** (`ADR-0071`/`0113`)                   | reference-counted `entitlement_grant` junction; `subscription.canceled` soft-revokes, full-refund claws unspent credits only                                                                              |
| Registry Worker entitlement filtering                          | **BUILT + LIVE** (`ADR-0047`)                   | offline Ed25519 verify at the edge → base ∪ entitled, non-entitled 404, fail-safe to base                                                                                                                 |
| Buyer-MCP per-account **rate limit**                           | **BUILT** (`ADR-0112`)                          | fail-open lazy-refill token bucket, port-injected                                                                                                                                                         |
| **Publishability flip** (private→public, npx bin)              | **BUILT** (`ADR-0111`)                          | tier-driven open-base→npm / commercial→GH split; the never-published signer stays private                                                                                                                 |
| **Buyer dashboard + seller cockpit**                           | **BUILDING (Bucket A)**                         | host/DB topology locked 2026-06-30 (`ADR-0114` unified Railway Next app · `ADR-0115` Railway Postgres); ready now (commerce backend + resolver exist)                                                     |
| **Registry index backfill** (7 → 27/27 modules)                | **DONE in-repo** (`ADR-0069`)                   | `registry/ledger.jsonl` + `registry/index.json` carry all 27 publishable modules (commits `695385d`+`505005e`); only the **deployed Worker bytes** lag — redeploy is **PENDING (Bucket B, DEPLOY-class)** |
| Real checkout wiring + EULA drafting                           | **PENDING (Bucket B, operator)**                | Paddle checkout + EULA is operator/legal content (`ADR-0082` fast-follows)                                                                                                                                |
| `services/support-bot` (Discord RAG + member-mgmt)             | **BUILT + DEPLOYED** (`ADR-0009`/`0105`/`0109`) | ● Online on Railway; remaining = enable 2 privileged intents + wire channel/role ids + scope role down (Bucket B)                                                                                         |
| `services/docs` + `llms.txt` (+ live embedder)                 | **BUILT + DEPLOYED** (`ADR-0096`)               | semantic at `docs-api.caisson.sh` (OpenRouter qwen3-embedding-8b wired)                                                                                                                                   |

### Stage-2 tails + follow-ups (from `integration/stage2`)

Bucketed by wave + class. Non-blocking; the streams themselves are BUILT + integrated.

| Item                                          | Class                         | Note                                                                                                                                                                                                                                                                             |
| --------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Edition members-fold**~~                  | **LOCKED — `ADR-0178`**       | fold `alerting`/`retention-runner` into the Compliance edition bundle + `tool-exec` into Agentic-Dev, vs keep them à-la-carte add-ons. **Decided 2026-07-01: FOLD into bundles** (PR#34); realized at the next gated edition republish. See §4                                   |
| **D8(a) tail** (site UI)                      | mechanical                    | migrate 3 more FAQ pages to `<Faq>` + broaden `<FeatureGrid>` adoption. Primitives shipped in Stream D                                                                                                                                                                           |
| **C2 streaming test hygiene**                 | build (small)                 | ~80 LOC of streaming-path coverage on the ai-kit inference lane                                                                                                                                                                                                                  |
| ~~**C5 local-ai `RentedTransport` drivers**~~ | **BUILT** (`ADR-0209`)        | wired Azure + Bedrock rented transports (hand-rolled vector-pinned SigV4, no AWS SDK per Gate-2); edition-tails-ops session 2026-07-02                                                                                                                                           |
| ~~**C7 write-half BYOK**~~                    | **BUILT** (`ADR-0182`/`0183`) | buyer key-submission UI (`apps/site` `/dashboard/ai-keys`) + the FREE credit-vs-BYOK pricebook policy (tenant-key actions debit 0 credits), edition seam-completion 2026-07-01 (read-half BYOK shipped Stream C, `ADR-0162`)                                                     |
| ~~**D6 harvest**~~ (`ADR-0133`)               | **TERMINAL** (`ADR-0210`)     | harvest program driven to terminal state 2026-07-02 (PR#47, lift-harvest slice-2): every ranked item **existing / built / deferred-with-reason** — `@caisson/agent-runner` + 10-pkg hardening wave (`ADR-0186`, `0210`–`0217`); `docs/state/harvest-program.md` §Terminal states |
| **`apps/admin` provisioning**                 | **DEPLOY-class**              | Railway apps + `admin.caisson.sh` DNS/CF-Access + the `admin` PG role + `OTEL` env (Grafana Cloud sole sink, `ADR-0177` — SigNoz removed, no longer part of this item). Later DEPLOY wave (`ADR-0138`/`0140`–`0143`)                                                             |

### Fast-follow (locked, no fork, ready NOW, not exit-gate-blocking)

| Item                                                     | Note                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| ~~`@caisson/migrate` base extract (assembler + runner)~~ | **BUILT** (ADR-0090, W2 / PR#17) — pays down the ADR-0070 debt       |
| ~~Compose-time migration-bundle copy step~~              | **BUILT** (ADR-0091, W2b / PR#19) — bundles under `@caisson/migrate` |

### Publish-readiness (deferred-fork — decision LOCKED to do at P6, no new picker)

| Item                                                                                    | Note                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Publishability flip (private→public) + license-split publishConfig + changeset gate~~ | **BUILT** — `ADR-0111` (PR#28 / integration)                                                                                                                                       |
| ~~`create-caisson` → `dist/cli.js` + npx bin~~                                          | **BUILT** — `ADR-0092`/`0111`                                                                                                                                                      |
| ~~MCP per-account rate-limit (token-bucket)~~                                           | **BUILT** — `ADR-0112` (fail-open, port-injected)                                                                                                                                  |
| ~~Registry index backfill (publish base + compliance/local-ai modules)~~                | **DONE in-repo** — ledger/index carry all 27/27 publishable modules (`695385d`+`505005e`); the deployed Worker redeploy is the remaining **PENDING (Bucket B, DEPLOY-class)** step |

### Code-review findings (Greptile)

> **Stream D re-verify 2026-07-01 (D10):** confirmed the two real cli-meter bugs (#1/#2) are fixed on
> `main` — `meter.integration.test.ts` now stages into an `mkdtemp` bundle dir with an injectable
> `bundleRoot` (never the real gitignored build artifact). Backlog stays **cleared**; no open D10 action.
>
> **Update 2026-06-30:** the test-hygiene backlog below (findings #1–#7) was **cleared by I6 (PR#26)**;
> the P6 **integration** additionally folded in every per-PR Greptile finding on the code-track PRs
> (#27/#28) — the two **P1s** (unguarded `issueLicense` rejection → structured 500; stale `0.0.0`
> ledger member pins → repinned + a new validation test) plus the P2 doc/trust-assumption nits. The
> 2026-06-29 table is retained below as the historical record.

The Greptile GitHub app reviews opened PRs (config landed PR#20: `.greptile/{config.json,rules.md}`

- advisory `.githooks/pre-push`). Across PRs #18–#20 it left **7 findings, all severity P2, all still
  live on `main`** — none block (P2 ≤ merge threshold). PR#21 (design+site, 116 files) **exceeded
  Greptile's 100-file limit and got zero AI review** — a coverage gap, not a clean pass. None of these
  are accidental TODOs; all are test-hygiene/clarity. Triaged here (NOT fixed in the CI-fleet branch —
  the real one needs a small, deliberate, test-injectable change, not a rushed patch):

| #   | File:line                                                  | Finding                                                                                                                                                                                                                                                                                                                                                      | Recommended fix                                                                                                                                                                                                                                                           | Priority     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `packages/cli/src/meter.integration.test.ts:396-398`       | `afterEach` does `rmSync(bundleRoot, {recursive,force})` on the **real** gitignored `packages/cli/migrations-bundle/` (a Turbo build output) → after the run the bundle is empty while Turbo still thinks it is fresh; the generator's `packageDir()` then finds no migrations until a forced rebuild (a local-dev hazard; low blast-radius on ephemeral CI) | Make the bundle root injectable into `readPackageMigrations`/`packageDir` so the test stages into a `mkdtemp` dir (as `bundle-migrations.test.ts` already does), OR scope cleanup to only the synthetic `field-crypto/` subdir + snapshot-restore any pre-existing bundle | **real bug** |
| 2   | `packages/cli/src/meter.integration.test.ts:389-394`       | paired `beforeEach` writes `0001_seam.sql` into the real bundle without cleaning first → if Turbo restores a populated `cli` cache, `readPackageMigrations` returns a non-deterministic set (passes today only because the kernel renumbers silently)                                                                                                        | same temp-dir isolation as #1                                                                                                                                                                                                                                             | **real bug** |
| 3   | `services/license/src/webhook.integration.test.ts:14-17`   | `beforeAll` execs `CREDIT_SCHEMA_SQL` but not the entitlement schema; passes today only because the test plan has `entitlements: []`. A future edition-plan webhook test fails with a confusing `relation account_entitlement does not exist`                                                                                                                | add the entitlement schema to `beforeAll` defensively                                                                                                                                                                                                                     | defensive    |
| 4   | `packages/cli/scripts/bundle-migrations.test.ts:42-45,128` | asserts exact filenames + `sequence.length === 3`; any new forward migration breaks CI for a data-driven bundler (the file IS otherwise `mkdtemp`-isolated)                                                                                                                                                                                                  | assert structural invariants (files present, `NNNN_*.sql` under `bundleRoot/<module>/migrations/`, non-empty) instead of exact counts                                                                                                                                     | nit          |
| 5   | `packages/billing/src/billing.test.ts:~91-109`             | the generic "invoice.paid → enriched event" fixture uses top-level `metadata.account_id` (the fallback), not the primary `subscription_details.metadata` path real cycle invoices use (the X-2 root cause) — the primary path IS covered by the adjacent dedicated test, so this is a clarity nit                                                            | swap the generic fixture to `subscription_details.metadata` so the primary path is the default                                                                                                                                                                            | nit          |
| 6   | `.githooks/pre-push:31-32`                                 | hardcoded `-b main` would diff against the wrong base for a non-`main` target                                                                                                                                                                                                                                                                                | derive base from the upstream tracking ref, or document the main-only assumption                                                                                                                                                                                          | nit          |
| 7   | `.githooks/pre-push:23`                                    | auth check scrapes `greptile whoami` stdout for `"not signed in"` — brittle if the CLI wording changes                                                                                                                                                                                                                                                       | use an exit-code-based auth check                                                                                                                                                                                                                                         | nit          |

**Process follow-up:** PRs over ~100 files silently bypass Greptile. For large design/site PRs, split
them or run an on-demand local pass (`/greptile` skill) before merge.

**PR #35 (edition-seam) — all 3 Greptile findings FIXED in-PR** (fail-closed BYOK crypto, Gemini key
out of the URL, `clearAction` Zod boundary). A follow-on adversarial sweep for sibling instances of the
same floor patterns surfaced **3 pre-existing P3 defense-in-depth items** (none in this PR's diff, none a
live hole — each guards only synthetic/demo data today).

> **✅ ALL 3 CLOSED — PR#37 merged (`84052aa`, 2026-07-01).** #1 `.strict()` appended. #2/#3 fail closed
> under `NODE_ENV=production` (byok.ts parity) — the compliance leg's #3 fix is a prod-throw, **not** the
> `fromEnv` switch the table proposed, because the leg is golden-deterministic and `fromEnv` would break
> the fixtures. Guards never fire today (apps not deployed; tests run `NODE_ENV=test`). Table kept as the
> historical record.

| #   | File:line                                     | Finding                                                                                                                                                                     | Fix                                                                   | Priority |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| 1   | `apps/site/app/dashboard/members/page.tsx:22` | `AddMemberInput` uses `z.object()` without `.strict()`; contained (hand-built parse object, trimmed/bounded, owner-gated, RLS, parameterized)                               | append `.strict()` for floor consistency                              | P3       |
| 2   | `apps/local-ai/app/demo/pipeline.ts:250`      | `demoProvider()` constant-key fallback has no `NODE_ENV==='production'` guard (unlike the now-fixed byok.ts); demo route seals only synthetic data into throwaway temp dirs | add the same fail-closed guard byok.ts uses (parity/defense-in-depth) | P3       |
| 3   | `apps/compliance/lib/harness.ts:41`           | `createLegHarness()` always builds `DerivedKeyProvider` from constant demo vectors; each call is a fresh in-memory PGlite + temp WORM with synthetic PHI only               | prefer `fromEnv` when set + throw under prod when unset (parity)      | P3       |

### Edition act-trail debt (non-blocking — lives in the per-phase SWEEP/VERIFY trails)

Surfaced from `outputs/specs/wave1-*/{VERIFY,SWEEP}.md` so it is discoverable from the backlog (not
just buried in act trails). All non-blocking; queue with the relevant edition's next pass:

- ~~**P4a local-ai** — the EVAL act was never recorded / phase `SECURITY.md` never authored.~~
  **CLOSED (`ac052f3`):** `outputs/specs/wave1-p4a-local-ai/EVAL.md` (PASS, golden-determinism
  substitute) + `SECURITY.md` (PASS, all 7 threats mitigated) both exist and are merged.
- ~~**P3 ai-kit** — streaming `infer()`; spend-counter concurrency test; soft-cap warn test; per-tenant
  encrypted BYOK (P3-25).~~ **CLOSED:** streaming `inferStream()` + concurrency + soft-cap tests
  shipped (`261d7ba`, green); **per-tenant encrypted BYOK BUILT** (Stream C, `ADR-0162` — buyer-facing
  key-submission UI + credit-vs-BYOK policy remain deferred).
- ~~**P2 compliance** — thin pinned-control depth (add a HIPAA leg); EU-AI-Act high-risk controls not
  authored; OSCAL export un-wired (T15).~~ **CLOSED (Stream C):** HIPAA evidence leg + OSCAL export
  bundle wired into `apps/compliance` (C3); EU-AI-Act high-risk catalog authored (`e4aaf8a`, 18
  controls). **Still deferred:** the live OSCAL _push_ (`OscalExportTransport.deliver()`, T15/P7).
- ~~**P4b agent-dev** — multi-tenant RLS on agent memory (seam)~~ **CLOSED (Stream C, `ADR-0073`):**
  `createAgentDevEdition({ tenant })` opens memory at the fail-closed file-per-tenant path (C4).
  **GA-promotion** partially open: embedding lane is the documented buyer-wired `Embedder` port
  (ADR-0067 engine-neutral); the Next.js inspector stays deferred (`ADR-0082` §4).

### Live-testing the by-design seams (needs external infra — DEPLOY-class)

S3 Object-Lock WORM · ONNX on-device + hosted/rented inference · OSCAL push · cloud KMS. No code
fork; operator sequences relative to commerce. See build-state honest-gaps #2/#3.

### Roadmap (P7, not actionable)

Compliance vertical packs · AI-feature packs · local-first verticals · the module marketplace.

## 4. Open operator decisions (forks needing a picker)

| Fork                                       | Status                | Why it needs you                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Final pricing numbers + grandfathering~~ | **LOCKED — ADR-0106** | numbers set 2026-06-29 (Compliance $2,499 · Bundle $3,499 · Updates $1,499/yr · Developer $499/yr · Enterprise contact-us); **edition one-time points superseded by ADR-0137 below-sum reprice (Compliance $749 · Bundle $1,499 · AI-Kit $599 · Local-first $349 · Agentic-Dev $249); recurring + grandfather hold**; forward grandfather; code track wires the pricebook |
| ~~`services/docs` scope~~                  | **CLOSED — ADR-0096** | standalone AI-native docs service (separate from `apps/site` Fumadocs)                                                                                                                                                                                                                                                                                                    |
| ~~Cloudflare Access go-live gate~~         | **LOCKED — ADR-0107** | keep gated; flip only when checkout works + Compliance buyable — the deliberate launch act (DEPLOY-class); go-live checklist in the ADR                                                                                                                                                                                                                                   |

| ~~**Edition members-fold**~~ (Stage-2) | **LOCKED — ADR-0178** | fold `alerting`/`retention-runner` (Stream B Compliance primitives) into the Compliance edition bundle + `tool-exec` into Agentic-Dev, vs keep them à-la-carte add-ons. **Decided 2026-07-01: FOLD into bundles** (PR#34); realized at the next gated edition republish |

_The 2026-06-29 GTM-report picker round closed all strategy forks (ADR-0094 open-core Base · ADR-0095
GTM offer structure · ADR-0096 services-docs); the **2026-06-29 P6 operator-gates round** then locked
the two remaining operator forks — **final pricing numbers + grandfathering (ADR-0106)** and the
**CF-Access go-live gate (ADR-0107)**. The one Stage-2 operator fork — **edition members-fold** (row
above) — is now **CLOSED (ADR-0178, 2026-07-01)**: the Stream-B commercial primitives fold into their
edition bundle rather than shipping à-la-carte. The remaining go-live action is otherwise the deliberate
CF-Access flip itself, held until the commerce spine + a buyable Compliance edition land (the ADR-0107
trigger)._

## 5. The two tracks — both substantially MERGED (status, 2026-06-29)

Work was bucketed into two disjoint-tree tracks (design + code-wiring). Both have since landed their
main body to `main`; what remains is the back half of each.

- **Design track** (`outputs/kickoffs/design-marketing-rebuild.md`) — **MERGED** (PR#6 brand+site P0,
  PR#21 design-system lock + Phase-2 site rebuild). Phase 1 (forks F1–F8 → ADR-0099–0102; `@caisson/ui`
  kit; 6 deterministic gates; brand mark ADR-0103) and Phase 2 (kit-first `apps/site` rebuild; static
  code-as-proof hero ADR-0104) are done. **Live residuals only:** the deferred **signature slot /
  three.js studio spike** (ADR-0103/0104) and the **SEO IntentLadder revisit** (§ Parked, decisions
  board) + the queued design launch-polish (`design-brand-site-seo/VERIFY-SWEEP.md` — docs-surface
  polish, Turnstile widget, consent checkbox).
- **Code/wiring track** (`outputs/kickoffs/code-wiring-track.md`) — **Buckets A+B MERGED** (PR#16 W1
  open-core; PR#19 W2 `@caisson/migrate`; PR#18 B1 billing-X2 + B2 entitlement resolver + worker
  filtering). **Bucket C BUILT:** **`services/docs`** (ADR-0096: corpus + `llms.txt` + Bearer `POST
/query`; real embedder = deploy seam) **+ `services/support-bot`** (`feature/p6-support-bot`,
  ADR-0009/0105: discord.py RAG over the docs `/query`, OpenRouter generation, thread+Postgres
  escalation; live secrets + cloud deploy = operator-gated seam). **D publish-readiness is now DONE**
  (publishability flip `ADR-0111` · npx bin `ADR-0092` · the registry index backfill is DONE in-repo,
  27/27 modules, only the Worker redeploy is pending — see §0/§3) → **E** GTM (free EU-AI-Act sample
  ADR-0095 · Enterprise tier) → **F** live-test
  runbook (W8). Plus the P6 commerce remainders in §3 (license **issuer** · revoke-on-cancel ·
  one-time-purchase entitlement · dashboards, now BUILDING per `ADR-0114`/`0115`) and the `apps/site`
  Apache-2 licensing-copy tail.

The codebase carries **zero** accidental TODO/FIXME markers; all in-source "seams" are ADR-sanctioned
ports. **Next coherent unit of work:** the license **issuer** (`ADR-0010`) + revoke-on-cancel +
one-time-purchase entitlement slices, or the **publish-readiness** pass (D) — gated only by the
deferred-by-decision pricing numbers + a Stripe account, neither of which blocks building the
mechanism. (P6 Bucket C — `services/docs` + `services/support-bot` — is now built; the support-bot's
live secrets + cloud deploy are the one operator-gated DEPLOY seam left in that bucket.)
