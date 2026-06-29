# Readiness & Backlog — Caisson

Operator-actionable companion to `docs/build-state.md` (the build-status SOT). Three buckets from
the **2026-06-29 state investigation** (5-agent fan-out + live Worker smoke-test + on-box gate run):
**(1)** live-test readiness, **(2)** configuration / secrets checklist, **(3)** prioritized next-work
backlog with fork gates. Canonical _decisions_ stay in `knowledge/decisions/` (ADRs); the live
_fork_ board stays in `docs/state/decisions-and-forks.md`. This file is a readiness map, not a
decision record.

Verified against `main` post-PR#21 (2026-06-29 — the code-wiring W1/W2/B1/B2 stack PR#16–19 + the
design-system + Phase-2 site rebuild PR#21 have all merged). Evidence: code-on-disk, ADR trail, a live
HTTP smoke-test of the deployed Worker, and `bun run check` on-box. The CI-fleet wiring (§0) is this
session's change.

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
- **Move the macOS `native-ext` CI leg onto the fleet** — provision Homebrew + extension-capable
  SQLite for the Mac mini's runner user, then flip that leg `runs-on: macos-latest` → `runs-on:
[self-hosted, gw-macos-arm64]` (saves the ~10×-cost hosted macOS minutes). The fleet macOS lane
  already dispatches (checkout + `bun install` green on PR#22); only the `brew install sqlite` prereq
  is missing. `docs/operations.md` §7.
- **Single amd64 runner serializes fleet CI** — the gate jobs run one-at-a-time on the one
  `gw-linux-amd64` runner (vs parallel on GitHub-hosted), so PR wall-clock is the serial sum. Fine for
  a solo repo; add a second amd64 lane if wall-clock becomes a constraint.

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

### Code-review findings (Greptile — unaddressed, triaged 2026-06-29)

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

| Fork                                       | Status                          | Why it needs you                                                                                         |
| ------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ~~Final pricing numbers + grandfathering~~ | **CLOSED — ADR-0095**           | deliberately deferred to P6/checkout; reports' $2,999–$4,999 anchor + ICP/keyword validation = the input |
| ~~`services/docs` scope~~                  | **CLOSED — ADR-0096**           | standalone AI-native docs service (separate from `apps/site` Fumadocs)                                   |
| **Cloudflare Access go-live gate**         | **decided (board): keep gated** | flip only when checkout works + Compliance is buyable — the deliberate launch act (DEPLOY-class)         |

_The 2026-06-29 GTM-report picker round closed all strategy forks (ADR-0094 open-core Base · ADR-0095
GTM offer structure · ADR-0096 services-docs). **No open operator forks remain** — the only
operator-owned remainders are deferred-by-decision (pricing numbers → P6; CF go-live → launch act)._

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
  filtering). **Remaining:** **C** support/docs (`services/{support-bot,docs}`, both empty scaffolds) →
  **D** publish-readiness (publishability flip · npx bin ADR-0092 · registry index backfill — only 7 of
  ~24 modules live today) → **E** GTM (free EU-AI-Act sample ADR-0095 · Enterprise tier) → **F**
  live-test runbook (W8). Plus the P6 commerce remainders in §3 (license **issuer** · revoke-on-cancel ·
  one-time-purchase entitlement · dashboards) and the `apps/site` Apache-2 licensing-copy tail.

The codebase carries **zero** accidental TODO/FIXME markers; all in-source "seams" are ADR-sanctioned
ports. **Next coherent unit of work:** P6 Bucket C (support-bot + docs) or the license **issuer** +
revoke/one-time entitlement slices — gated only by the deferred-by-decision pricing numbers + a Stripe
account, neither of which blocks building the mechanism.
