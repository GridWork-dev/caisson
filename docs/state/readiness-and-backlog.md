# Readiness & Backlog — Caisson

Operator-actionable companion to `docs/build-state.md` (the build-status SOT). Three buckets from
the **2026-06-29 state investigation** (5-agent fan-out + live Worker smoke-test + on-box gate run):
**(1)** live-test readiness, **(2)** configuration / secrets checklist, **(3)** prioritized next-work
backlog with fork gates. Canonical _decisions_ stay in `knowledge/decisions/` (ADRs); the live
_fork_ board stays in `docs/state/decisions-and-forks.md`. This file is a readiness map, not a
decision record.

Verified against `main` post-PR#13 (2026-06-29). Evidence: code-on-disk, ADR trail, a live HTTP
smoke-test of the deployed Worker, and `bun run check` on-box.

## 0. Live verification done this session

- **Registry Worker — LIVE + smoke-tested GREEN.** `https://caisson-registry.broken-wood-97a9.workers.dev`:
  `/index.json` → 200 (serves the real allowlist), `/modules/@caisson/ai-evals` → 200, `/nope` → 404,
  `POST` → 405 (GET-only). **Gap:** the live index carries only **7 modules** (`@caisson/ai-evals,
ai-kit, ai-meter, cli, field-crypto, guardrails, prompt-registry`) — the registry **ledger has 7
  entries**; base substrate (kernel/auth/billing/credits/…) and the compliance/local-ai editions are
  **not yet published** to the index (incremental backfill, ADR-0069 — completing it is a P6 item).
- **Whole-monorepo gate** — `bun run gate` (standards-gate) green ("36 checked, 2 scaffold-skipped,
  all conform, ADR-0002"); `turbo run build lint test` green on-box (`--concurrency=50%` per the
  PGlite-fan-out gotcha).

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

| Surface                                                 | Flip                                                       | Gates                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Stripe live checkout + real webhook + cycle→grant (X-2) | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + Stripe CLI | the X-2 cycle→grant code **does not exist yet** (P6 / ADR-0089) |

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
- **Stripe** (`STRIPE_SECRET_KEY` + per-endpoint `STRIPE_WEBHOOK_SECRET`) — **real commerce blocker**;
  no account/keys exist anywhere. Needed for live paid checkout + the X-2 grant path.

### Missing — un-exercised seams (needed only when that surface goes GA)

| Need                | Env / resource                                                      | When                                                              |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Database            | Neon Postgres `DATABASE_URL`                                        | when an edition/reference app runs live (not for the static site) |
| Auth runtime        | better-auth instance + `BETTER_AUTH_SECRET` + PG store              | when a logged-in surface ships                                    |
| Field encryption    | `MASTER_FIELD_KEY` + `FIELD_CRYPTO_SALT` (each 32-byte hex)         | when the compliance edition runs live                             |
| Field KMS (alt)     | `KMS_KEY_ID` + cloud KMS creds                                      | optional alternative to `MASTER_FIELD_KEY`                        |
| WORM store          | AWS S3 bucket w/ Object-Lock + creds                                | compliance live path (post-v1)                                    |
| AI provider keys    | per-lane `apiKeyEnv` (OpenAI/Anthropic/Google)                      | **BYOK** — buyer supplies, not operator                           |
| Job queue           | Trigger.dev project + key                                           | when a live queue is required (in-memory driver ships)            |
| Transactional email | Resend API key (injected at composition)                            | when live email ships (capture driver is exercised)               |
| License issuer      | Ed25519 signing **keypair** (`CAISSON_LICENSE_TOKEN` = verify side) | P6 — issuer is the missing half; verify key is compiled in        |
| Waitlist function   | `RESEND_API_KEY` + `RESEND_SEGMENT_ID` (+ Turnstile, KV RL)         | legacy/secondary seam post-ADR-0082 self-serve flip               |
| Lighthouse CI       | `LHCI_GITHUB_APP_TOKEN`                                             | optional — audit runs without it (no GitHub status post)          |

### Ops hygiene (non-blocking)

- **Terraform state is LOCAL + gitignored.** Move to a remote backend (R2 + lock) before a second
  operator or CI-driven apply. Single-operator OK today.
- **Registry tamper-prevention** — `CODEOWNERS` present + `registry-index` job detects hand-edits;
  PREVENTION needs `registry-index` marked a required check + branch protection (operator GitHub
  settings, tracked on the fork board).
- **`CAISSON_PUBLISH_DRY_RUN`** — the `publish-and-index` job is wired + active but dry-run by default;
  set `=false` to actually publish (moot until editions are GA + the publishability flip lands).

## 3. Next-work backlog (prioritized, fork-gated)

P5 is SHIPPED; editions merged-but-partial; Worker LIVE; edition VERIFY-debt closed. The remaining
spine is **P6**, plus locked fast-follows and one true open operator fork.

### P6 — Commerce + support + docs (the single big pending phase)

| Item                                                                           | State                               | Depends on / gate                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| `services/license` issuer + grants (Ed25519 + MoR webhook + idempotent grants) | **ready** (ADR-0089) — anchor of P6 | needs `@caisson/pricebook` + billing `invoice.paid` enrichment                |
| X-2 billing: `@caisson/pricebook` + cycle→grant mapper                         | **mechanism ready** (ADR-0089)      | the **numbers** are the open pricing fork                                     |
| Entitlement-on-purchase resolver wiring (ADR-0071/0076)                        | ready after license service         | depends on `services/license` purchase flow                                   |
| Registry Worker entitlement filtering (ADR-0047 defers it)                     | ready after the resolver            | the one **genuine code loose end** today                                      |
| Buyer dashboard + seller cockpit                                               | ready after commerce backend        | depends on license + resolver + final pricing                                 |
| Real Stripe checkout + EULA drafting (CLAUDE.md/ADR-0082 fast-follows)         | partial-blocked                     | Stripe account; EULA is operator/legal content                                |
| `services/support-bot` (Discord + Python RAG + hosted inference)               | **ready** (ADR-0009)                | grounding quality depends on the docs corpus; cloud-runner deploy is separate |
| `services/docs` + `llms.txt`                                                   | **scoping fork** (no ADR)           | see §4 — separate service vs extend `apps/site` Fumadocs                      |

### Fast-follow (locked, no fork, ready NOW, not exit-gate-blocking)

| Item                                                     | Note                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@caisson/migrate` base extract (assembler + runner)     | ADR-0090 — pays down ADR-0070 debt before more consumers fork the copy                    |
| Compose-time migration-bundle copy step (CLI build-step) | ADR-0091 — mirrors the proven `templates/` pattern; may relocate under `@caisson/migrate` |

### Publish-readiness (deferred-fork — decision LOCKED to do at P6, no new picker)

| Item                                                                                             | Note                                                                       |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Publishability flip (24 pkgs private→public) + `@caisson/registry` coherence + changeset/T3 gate | one P6 readiness pass                                                      |
| `create-caisson` → `dist/cli.js` + `#!/usr/bin/env node` (npx reach)                             | ADR-0092 — rides into the publishability flip                              |
| MCP per-account rate-limit (PG token-bucket, T21b)                                               | build with the entitlement store; debit-before-spend stays primary control |
| Complete the registry index backfill (publish base + compliance/local-ai modules)                | only 7 of ~24 in the live index today                                      |

### Live-testing the by-design seams (needs external infra — DEPLOY-class)

S3 Object-Lock WORM · ONNX on-device + hosted/rented inference · OSCAL push · cloud KMS. No code
fork; operator sequences relative to commerce. See build-state honest-gaps #2/#3.

### Roadmap (P7, not actionable)

Compliance vertical packs · AI-feature packs · local-first verticals · the module marketplace.

## 4. Open operator decisions (forks needing a picker)

| Fork                                       | Status                          | Why it needs you                                                                                         |
| ------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ~~Final pricing numbers + grandfathering~~ | **CLOSED — ADR-0095**           | deliberately deferred to P6/checkout; reports' $2,999–$4,999 anchor + ICP/keyword validation = the input |
| ~~`services/docs` scope~~                  | **CLOSED — ADR-0096**           | standalone AI-native docs service (separate from `apps/site` Fumadocs)                                   |
| **Cloudflare Access go-live gate**         | **decided (board): keep gated** | flip only when checkout works + Compliance is buyable — the deliberate launch act (DEPLOY-class)         |

_The 2026-06-29 GTM-report picker round closed all strategy forks (ADR-0094 open-core Base · ADR-0095
GTM offer structure · ADR-0096 services-docs). **No open operator forks remain** — the only
operator-owned remainders are deferred-by-decision (pricing numbers → P6; CF go-live → launch act)._

## 5. The two queued tracks (kickoffs ready)

Work is bucketed into two disjoint-tree tracks; **sequencing is the next operator picker.**

- **Design track** — `outputs/kickoffs/design-marketing-rebuild.md`. Phase 1: design-system lock +
  harden (resolve forks F1–F8 → ADRs 0097+; component kit into `packages/ui`; the 6 deterministic
  gates) → sketch in `apps/studio`. Phase 2: rebuild `apps/site` ground-up (IntentLadder SEO template,
  kit-first, hero "the denial" → "break the chain" standout → caisson cross-section diagram). Touches
  `packages/ui` + `apps/site` + `apps/studio`. Research: `wardfile-frontend-playbook.md` +
  `marketing-hero-concepts.md`.
- **Code/wiring track** — `outputs/kickoffs/code-wiring-track.md`. **Bucket-A progress: W1 open-core
  re-licensing ✅ SHIPPED** (ADR-0097: open `@caisson/registry-schema` split + 11 base pkgs → Apache-2.0
  - standards-gate enforces the split & open↔commercial boundary; `apps/site` licensing copy is the
    design-track tail). Buckets: **A** fast-follows (W2 `@caisson/migrate` extract + bundle · ~~W1~~) → **B** P6 commerce spine
    (`@caisson/pricebook` · `services/license` annual cycle→grant · entitlement resolver · worker
    filtering · dashboards) → **C** support/docs → **D** publish-readiness (flip · npx bin · index
    backfill) → **E** GTM (free EU-AI-Act sample · Enterprise tier) → **F** live-test runbook (W8).
    Touches `services/*` + `packages/{migrate,cli,billing,…}` + `tooling/` + `registry/`.

The two tracks touch **disjoint trees** → can run as parallel worktree streams (playbook §4), merged
at a barrier. The codebase carries **zero** accidental TODO/FIXME markers; all in-source "seams" are
ADR-sanctioned ports.
