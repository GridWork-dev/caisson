# Build state & roadmap

Live build status for the Caisson monorepo. **This file OWNS the synthesized build-status
view** - `plan.md` (the P0-P7 plan) and `SUMMARY.md` (the consolidated job rollup) route here
for "what is actually built right now". Canonical _decisions_ stay in `knowledge/decisions/`
(ADRs) and `specs/`; the live _fork_ board stays in `docs/state/decisions-and-forks.md`. This
is a map/catalog, not a re-statement of those.

Verified against the working tree on `main` at 2026-06-28 (post-PR#12; P5 generator merged, on top of PR#11 wave-1 integration).
Method: `packages/*/src` + test presence, `apps/`/`services/` contents, ADR + spec artifact
trail, git chronology. Status reflects code-on-disk, not marketing copy.

> **Accuracy note (read first):** `ADR-0082` §3 (`knowledge/decisions/ADR-0082-go-live-site-posture.md`,
> the go-live _site-copy_ ADR) says four edition packages are "currently empty stubs". That line
> was written on a site-copy branch **before** the wave-1 edition branches merged (ADR-0082 commit
> `1d84a92` predates the PR#11 merge `76fd474`, same day). It governs _site copy honesty_, not
> repo build-state, and is **stale as a build-status claim**. The post-merge tree (below) shows the
> edition packages carry real implementations + passing tests. They are _not_ empty - but they are
> _not_ production-complete either (un-exercised live transports, no VERIFY trail, reference apps
> only). `SUMMARY.md` (dated 2026-06-27) is likewise stale on wave-1 ("editions P2-P4 ... remain").
> This file supersedes both for build-status.

## Status legend

| Label       | Meaning                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| **shipped** | real implementation + green tests, wired into a consumer (app/CI), no known un-built seam                                |
| **partial** | merged with real code + tests, but with un-exercised live transports, un-wired adapters, OR no recorded VERIFY/SWEEP act |
| **pending** | scaffold only (package.json + README/gitkeep), no implementation                                                         |

Canonical test command is `bun run check` (turbo: build + lint + test + standards gate). A naive
`bun test <pkg>` mis-fires on compiled `dist/__golden__` fixtures (known dist-glob gotcha) - it is
not the source suite. CI green = PR#11.

## Phase status (P0-P7)

Phases map to `plan.md`. "Artifacts" = the `outputs/specs/<slug>/` act trail.

| Phase                                    | Scope                                                                                                  | Status                                                            | Artifacts                                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 Foundations**                       | `tooling/` (eslint-config, tsconfig, testing, standards-gate) + `kernel` + golden harness + CI         | **shipped**                                                       | `wave1-shared-base` (substrate), founding ADRs                       | `tooling/{eslint-config,standards-gate,testing,tsconfig}`, `.github/workflows/{ci,deploy-site,lighthouse}.yml`, `ADR-0001`,`ADR-0013`,`ADR-0016`,`ADR-0022`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **P1 Base substrate**                    | `auth tenancy-rls billing credits ai-config mcp-server ui jobs email` + `apps/base`                    | **shipped**                                                       | -                                                                    | 9 pkgs w/ src+tests; `apps/base` real-HTTP 402->grant->200->MCP loop; `ADR-0005`,`ADR-0007`,`ADR-0008`,`ADR-0011`,`ADR-0015`,`ADR-0017`,`ADR-0018`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Wave-0 shared substrate**              | `field-crypto`, `registry/`, `cli` (create-caisson skeleton), kernel primitives                        | **shipped** (registry worker LIVE)                                | `wave0-shared-substrate` (SPEC+PLAN+VERIFY+SWEEP+SECURITY)           | `ADR-0045`-`0049`,`0053`,`0055`; registry `index.json`+`ledger.jsonl` built; `registry/worker/` now LIVE (ADR-0047 seam→live, `caisson-registry.broken-wood-97a9.workers.dev`, deploy-entry inlines the index)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **P2 Compliance (hero)**                 | `audit-worm`, `compliance`, field-crypto evidence path + `apps/compliance`                             | **partial** (VERIFY+SWEEP recorded; transports = by-design seams) | `wave1-p2-compliance` (SPEC+PLAN+VERIFY+SWEEP)                       | `ADR-0006`,`0051`-`0058`; PR#11. Live S3 ObjectLock un-exercised (DI stub in CI), OSCAL export an un-wired seam (T15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **P3 AI Production Kit**                 | `ai-meter`, `ai-evals`, `prompt-registry`, `guardrails`, `ai-kit` gateway + `apps/ai-kit`              | **partial** (VERIFY+SWEEP recorded; transports = by-design seams) | `wave1-p3-ai-kit` (SPEC+PLAN+VERIFY+SWEEP)                           | `ADR-0059`-`0063`; PR#11. Gateway + spend-cap + eval gate present; live provider calls behind a seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **P4 Local-first AI + Agentic-Dev**      | `local-ai`, `local-store`, `agent-dev`, `agent-kernel`, `license-verify` + `apps/{local-ai,agent-dev}` | **partial** (VERIFY+SWEEP recorded; transports = by-design seams) | `wave1-p4a-local-ai`, `wave1-p4b-agent-dev` (SPEC+PLAN+VERIFY+SWEEP) | `ADR-0050`,`0064`-`0067`,`0073`,`0083`; PR#11. On-device ONNX + hosted/rented inference are un-exercised seams (CI uses `StubInferenceBackend`, ADR-0064)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **P5 Generator + registry (full drive)** | real disk FileSetWriter, MCP-driven generation, gated publish + index backfill, `@caisson/migrate`     | **shipped** (PR#12 merged; security audit PASS)                   | `wave1-p5-generator` (SPEC+PLAN+VERIFY)                              | `ADR-0004`,`0048`,`0049`,`0068`-`0071`,`0077`. Built: 10 base manifests + ADR-0077 pin-map; path-safe atomic FileSetWriter + templated engine (golden); `runGeneration` debit-before-spend→write→audit-row (PGlite, 402-writes-nothing, idempotent); buyer-MCP `generate` converged on the index (id+version validate, ADR-0071 entitlement-expand, mint/reuse key) **driving** `runGeneration` end-to-end (composition test); test-doubled publish→byte-identical index; runnable create-caisson bin. Deferred (board forks): publishability flip (T2/T3), compose-time migration-bundle (empty no-op today), `@caisson/migrate` promotion, MCP rate-limit |
| **P6 Commerce + support + docs**         | `services/license`, `services/support-bot`, `services/docs`, dashboards                                | **pending**                                                       | -                                                                    | `services/*` are empty scaffolds (package.json + README only, 0 TS); `ADR-0009`,`0010`,`0069`,`0074`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **P7+ Round-out**                        | compliance vertical packs, AI-feature packs, marketplace                                               | **pending** (roadmap)                                             | -                                                                    | `plan.md` P7; Agentic-Dev labeled roadmap edition per `ADR-0082` §4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Adjacent (not in the P0-P7 spine, shipped separately):** the GTM site + static docs
(`apps/site`, Next + Fumadocs -> Cloudflare Pages, `ADR-0084`-`0087`, brand `ADR-0078`-`0081`,
go-live posture `ADR-0082`/`0083`) and the design decision studio (`apps/studio`, `ADR-0040`-`0042`).
Both **shipped**. Note: the public docs live in `apps/site`; `services/docs` (the AI-native docs
_service_, P6) is unbuilt.

## Per-package reality check

`src` = non-test source files under `packages/<p>/src`; `tests` = `*.test.ts` count; `loc` =
source LOC. Counts are the disk truth on `main`, not a quality judgement.

### Base + foundations (shipped)

| Package       | src / tests / loc | Verdict          | Owns                                                                                           |
| ------------- | ----------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `kernel`      | 12 / 9 / 1363     | **built**        | typed config/schema + error model (`ADR-0019`), SHA-256 chain + append-only version primitives |
| `auth`        | 3 / 1 / 143       | **built**        | session/RLS seam (`ADR-0015`)                                                                  |
| `tenancy-rls` | 2 / 1 / 75        | **built (thin)** | fail-closed RLS (`ADR-0005`); small by design, the guard is the whole package                  |
| `billing`     | 4 / 1 / 249       | **built**        | Stripe MoR + webhook events (`ADR-0017`)                                                       |
| `credits`     | 3 / 2 / 328       | **built**        | integer wallet + append-only ledger + 402 + idempotency index (`ADR-0007`,`0024`)              |
| `ai-config`   | 2 / 1 / 49        | **built (thin)** | provider-agnostic config (`ADR-0011`); minimal surface, verify before extending                |
| `mcp-server`  | 3 / 2 / 514       | **built**        | auth-gated buyer MCP (`ADR-0008`); `coach.ts` has setup-flow TODOs                             |
| `ui`          | 6 / 1 / 381       | **built**        | token floor (`ADR-0042`/`0078`)                                                                |
| `jobs`        | 2 / 1 / 73        | **built (thin)** | job seam (`ADR-0018`)                                                                          |
| `email`       | 2 / 1 / 82        | **built (thin)** | email seam (`ADR-0018`)                                                                        |

### Wave-0 substrate (shipped)

| Package                                     | src / tests / loc | Verdict                                 | Owns                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ----------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field-crypto`                              | 13 / 9 / 1319     | **built**                               | per-tenant HKDF + AES-256-GCM + versioned envelope + Drizzle column + KMS seam + crypto-shred/row-AAD (`ADR-0043`,`0045`,`0046`,`0055`)                                                                                                                                               |
| `cli`                                       | 5 / 3 / 488       | **built (full P5 drive, PR#12 merged)** | create-caisson index gate + templated engine + path-safe atomic disk FileSetWriter + `runGeneration` (debit-before-spend → write → audit row) + migrate assemble + runnable bin (git-init post-gen). Full P5 drive on `feature/p5-generator` (`ADR-0004`,`0048`,`0049`,`0068`-`0070`) |
| `registry/` (workspace, not in `packages/`) | schema+worker     | **built (worker LIVE)**                 | module-manifest + index + ledger schema + CI rebuild + static read path; `worker/` now deployed to Cloudflare (`deploy-entry.ts` inlines the index, `caisson-registry.broken-wood-97a9.workers.dev`; `handler.ts` env-seam + tests untouched) (`ADR-0020`,`0021`,`0047`,`0071`)       |

### Edition packages (merged via PR#11, partial - verify before claiming complete)

| Package           | src / tests / loc | Verdict         | Reality                                                                                                                                                                                                                                       |
| ----------------- | ----------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance`      | 16 / 11 / 2871    | **substantial** | evidence collectors (rls-force, chain-verify, worm-retention), SOC2/HIPAA/EU-AI-Act frameworks, pack-format + Ed25519/RFC-3161 signing, `withTenantCrypto`, migration assembly. **OSCAL export is an un-wired seam (T15).** `ADR-0056`-`0058` |
| `audit-worm`      | 7 / 6 / 1302      | **substantial** | SHA-256 hash chain store + retention + S3 ObjectLock adapter. **Live S3 path never run in CI** (DI stub by design, `ADR-0054`); local store is the exercised path. `ADR-0006`,`0051`,`0052`,`0054`                                            |
| `ai-meter`        | 6 / 3 / 957       | **substantial** | PG-atomic token metering + per-tenant spend caps + circuit breaker (`ADR-0060`)                                                                                                                                                               |
| `ai-evals`        | 6 / 1 / 800       | **substantial** | eval harness + CI gate (`ADR-0062`); thin test coverage (1 file)                                                                                                                                                                              |
| `prompt-registry` | 4 / 2 / 582       | **substantial** | versioned prompt registry + render (`ADR-0061`); render TODOs present                                                                                                                                                                         |
| `guardrails`      | 4 / 2 / 520       | **substantial** | input/output moderation + PII redaction (`ADR-0063`); PII path carries TODOs                                                                                                                                                                  |
| `ai-kit`          | 3 / 2 / 358       | **partial**     | inference gateway composing the above (`ADR-0059`); thinnest edition root                                                                                                                                                                     |
| `local-ai`        | 14 / 9 / 2209     | **substantial** | compute seam + privacy gate + sqlite-vec ANN + offline license + two-way sync. **ONNX on-device + rented/hosted inference are un-exercised seams** (CI = `StubInferenceBackend`, `ADR-0064`); now commercial (`ADR-0050`,`0083`)              |
| `local-store`     | 8 / 7 / 1043      | **substantial** | local canonical store, file-per-tenant (`ADR-0067`,`0073`)                                                                                                                                                                                    |
| `agent-kernel`    | 8 / 7 / 1101      | **substantial** | base governed-agent kernel (`ADR-0065`)                                                                                                                                                                                                       |
| `agent-dev`       | 7 / 3 / 761       | **substantial** | typed agent/skill/rule schema + lifecycle + emitter (`ADR-0066`); roadmap edition per `ADR-0082` §4                                                                                                                                           |
| `license-verify`  | 4 / 2 / 272       | **substantial** | offline Ed25519 license verify (consumed by local-ai/agent-dev)                                                                                                                                                                               |

### Apps + services

| Path                   | ts files / loc | Status      | Note                                                                                         |
| ---------------------- | -------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `apps/site`            | 69 / 8528      | **shipped** | GTM marketing + Fumadocs static docs -> Cloudflare Pages                                     |
| `apps/studio`          | 10 / 653       | **shipped** | design decision-surface app                                                                  |
| `apps/base`            | 4 / 295        | **shipped** | P1 reference wiring (402->grant->200->MCP loop); plain-TS consumer (src only, excl. `dist/`) |
| `apps/compliance`      | 7 / 798        | **partial** | P2 reference app (T19), not deployed                                                         |
| `apps/ai-kit`          | 11 / 804       | **partial** | P3 reference app, not deployed                                                               |
| `apps/local-ai`        | 6 / 687        | **partial** | P4a reference app, not deployed                                                              |
| `apps/agent-dev`       | 3 / 362        | **partial** | P4b reference app, not deployed                                                              |
| `services/license`     | 0 / 0          | **pending** | scaffold only (`ADR-0009`,`0010`)                                                            |
| `services/support-bot` | 0 / 0          | **pending** | scaffold only (Discord + Python RAG, `ADR-0009`)                                             |
| `services/docs`        | 0 / 0          | **pending** | scaffold only (AI-native docs service)                                                       |

## Honest gaps (the brutal-honesty section)

1. **~~No VERIFY/SWEEP trail for the editions.~~ RESOLVED (2026-06-28).** All four editions now
   carry `VERIFY.md` + `SWEEP.md` (goal-backward Act 4 + Act 5): P2-compliance PASS (in-scope),
   P3-ai-kit / P4a-local-ai / P4b-agent-dev PARTIAL (every SPEC clause met with real tests; live
   transports stubbed by design — gap #2). Edition completeness is now verified at the artifact
   level _for the in-scope surface_; the un-exercised live transports remain (gap #2).
2. **Live transports are un-exercised seams, by design.** S3 ObjectLock (audit-worm), ONNX
   on-device + hosted/rented inference (local-ai) run only as deterministic DI stubs in CI
   (`ADR-0054`/`0064`). The ports exist and are typed; the live paths have never run against real
   infra. This is sound engineering, not a defect - but "compliance edition works" must not be read
   as "WORM-locks a real S3 bucket today".
3. **Explicitly un-wired adapters.** OSCAL SAR/POA&M export (`compliance`, T15) is committed as an
   un-wired seam. Grep `un-wired`/`seam` in source headers before assuming an adapter is live.
4. **`ai-config` (49 loc), `ai-kit` (358 loc), and `ai-evals` (1 test file)** are the thinnest
   surfaces - present and green, but verify depth before quoting them as feature-complete.
5. **Stale upstream claims:** `ADR-0082` §3 ("empty stubs") and `SUMMARY.md` ("editions ... remain")
   both predate PR#11. Do not cite either for build-status; cite this file.

## What's genuinely next

- **P6 - Commerce + support + docs** is now the single big pending phase. `services/{license,support-bot,docs}`
  are empty scaffolds. Carries the **X-2 billing gap** — now with a locked-pending design:
  `outputs/specs/billing-x2/{DESIGN.md,ADR-DRAFT-billing-credit-grant.md}` (grant on `invoice.paid`,
  new `@caisson/pricebook`, cycle→grant mapper in `services/license`). Also carries the deferred
  **publishability flip** (P5 T2/T3) + **MCP rate-limit** — both operator-gated forks below.
- **~~P5 generator~~ DONE** (PR#12) and **~~edition VERIFY debt~~ CLOSED** (2026-06-28) and the
  **~~un-deployed registry worker~~ LIVE** (`caisson-registry.broken-wood-97a9.workers.dev`).
- **Open operator forks awaiting a picker (do NOT auto-decide):** billing grant approach · `@caisson/migrate`
  promotion · compose-time migration bundling · MCP rate-limit timing · `create-caisson` bin runtime ·
  local-CLI debit scope · publishability flip · final pricing numbers + grandfathering. Board:
  `docs/state/decisions-and-forks.md` Open table. Research-backed recommendations carried in the session
  picker round.

## Routing (canonical sources - this file does not duplicate them)

| For                                                        | See                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Why a decision was made                                    | `knowledge/decisions/ADR-NNNN-*.md` (append-only; `ADR-0088` records the GTM 0045-0048 -> 0084-0087 renumber) |
| Architecture + package boundaries                          | `specs/01-architecture.md`, `specs/00-product-spec.md`                                                        |
| The phase plan + exit gates                                | `plan.md`                                                                                                     |
| Live + open _decision_ forks                               | `docs/state/decisions-and-forks.md` (CLAUDE.md source-of-truth #1)                                            |
| Live-test readiness · config/secrets · prioritized backlog | `docs/state/readiness-and-backlog.md` (2026-06-29 investigation — operator-actionable buckets)                |
| Consolidated job rollup (research -> spec)                 | `SUMMARY.md`                                                                                                  |
| Per-phase act trail                                        | `outputs/specs/<slug>/{SPEC,PLAN,VERIFY,SWEEP}.md`                                                            |
| Engineering invariants                                     | `knowledge/decisions/ADR-0002-engineering-invariants.md`, root `CLAUDE.md`                                    |
