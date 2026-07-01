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

| Need                | Env / resource                                                                                                            | When                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Database            | Neon Postgres `DATABASE_URL`                                                                                              | when an edition/reference app runs live (not for the static site)         |
| Auth runtime        | better-auth instance + `BETTER_AUTH_SECRET` + PG store                                                                    | when a logged-in surface ships                                            |
| Field encryption    | `MASTER_FIELD_KEY` + `FIELD_CRYPTO_SALT` (each 32-byte hex)                                                               | when the compliance edition runs live                                     |
| Field KMS (alt)     | `KMS_KEY_ID` + cloud KMS creds                                                                                            | optional alternative to `MASTER_FIELD_KEY`                                |
| WORM store          | AWS S3 bucket w/ Object-Lock + creds                                                                                      | compliance live path (post-v1)                                            |
| AI provider keys    | per-lane `apiKeyEnv` (OpenAI/Anthropic/Google)                                                                            | **BYOK** — buyer supplies, not operator                                   |
| Job queue           | Trigger.dev project + key                                                                                                 | when a live queue is required (in-memory driver ships)                    |
| Transactional email | Resend API key (injected at composition)                                                                                  | when live email ships (capture driver is exercised)                       |
| License issuer      | Ed25519 signing **keypair** — ✅ **provisioned** (`CAISSON_LICENSE_SIGNING_KEY` in env; public → `infra/license-issuer/`) | P6/B4 done; code-track bakes the public key + builds the issuer sign path |
| Waitlist function   | `RESEND_API_KEY` + `RESEND_SEGMENT_ID` (+ Turnstile, KV RL)                                                               | legacy/secondary seam post-ADR-0082 self-serve flip                       |
| Lighthouse CI       | `LHCI_GITHUB_APP_TOKEN`                                                                                                   | optional — audit runs without it (no GitHub status post)                  |

### Ops hygiene (non-blocking)

- **Terraform state is LOCAL + gitignored.** Move to a remote backend (R2 + lock) before a second
  operator or CI-driven apply. Single-operator OK today.
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

### Edition act-trail debt (non-blocking — lives in the per-phase SWEEP/VERIFY trails)

Surfaced from `outputs/specs/wave1-*/{VERIFY,SWEEP}.md` so it is discoverable from the backlog (not
just buried in act trails). All non-blocking; queue with the relevant edition's next pass:

- **P4a local-ai** — the **EVAL act was never recorded** for the phase, and a **phase-level
  `SECURITY.md` was never authored** (7 threats are coded but no adversarial-audit artifact exists).
- **P3 ai-kit** — streaming `infer()` (request/response only today); concurrency test for the atomic
  spend counter; soft-cap warn-without-block test; per-tenant encrypted BYOK (P3-25, deferred fork).
- **P2 compliance** — thin pinned-control depth (SOC2-TSC 3 controls; add a HIPAA leg); EU-AI-Act
  high-risk controls not yet authored (reserved named slot); OSCAL export un-wired (T15).
- **P4b agent-dev** — multi-tenant RLS on agent memory (seam); GA-promotion (embedding lane +
  deferred Next.js inspector).

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

_The 2026-06-29 GTM-report picker round closed all strategy forks (ADR-0094 open-core Base · ADR-0095
GTM offer structure · ADR-0096 services-docs); the **2026-06-29 P6 operator-gates round** then locked
the two remaining operator forks — **final pricing numbers + grandfathering (ADR-0106)** and the
**CF-Access go-live gate (ADR-0107)**. **No open operator forks remain.** The only remaining go-live
action is the deliberate CF-Access flip itself, held until the commerce spine + a buyable Compliance
edition land (the ADR-0107 trigger)._

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
