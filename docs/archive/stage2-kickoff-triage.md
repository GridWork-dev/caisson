# Stage-2+ kickoff triage — 4 parallel independent streams

Status: **TRIAGE (operator-locked model, streams await per-stream SPEC)** · 2026-07-01 · grounded in
the 14-agent recon (`wf_6a11b902-537`). Companion to `stage2-deploy-plan.md` (the deploy is a
separate act; these streams are pure local build, **no live deploy**).

## Model (operator lock, 2026-07-01)

All remaining next-work is partitioned into **4 streams that do not depend on each other**, each its
own kickoff, each a **local checkout off clean `main`**, each with a **reserved ADR range** and
**reserved branch** so parallel locking never collides. **Nothing deploys live from a stream.** One
dedicated **integration session** merges all 4, rebuilds the registry index once, reconciles the ADR
board, runs the gate, and does any combined deploy.

**Partition axis = file-tree ownership** (not initiative). This guarantees parallel-mergeable
branches; where an initiative (e.g. the ADR-0133 harvest) spans trees, its slices land in the owning
stream. Each stream's tasks are sized **≤2 sessions**.

| Stream | Domain                                         | Reserved ADRs | Branch                     | Tree it OWNS (nothing else touches)                                                                                                                                                                                    |
| ------ | ---------------------------------------------- | ------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**  | Observability + Admin control-plane (ADR-0138) | **0140–0149** | `stream/obs-admin`         | `apps/admin` (new), `apps/studio` (removed), `packages/observability`, `services/*` OTLP instrumentation, SigNoz infra config                                                                                          |
| **B**  | New sellable packages + audit harness          | **0150–0159** | `stream/harvest-modules`   | NEW `packages/{alerting,retention-runner,audit-harness}` + greenfield harvest extractions (new dirs only)                                                                                                              |
| **C**  | Edition + AI package hardening & drivers       | **0160–0169** | `stream/edition-hardening` | `packages/{compliance,audit-worm,ai-kit,ai-meter,prompt-registry,guardrails,ai-evals,local-ai,local-store,agent-kernel,agent-dev,ai-config,license-verify,mcp-server}` + `apps/{compliance,ai-kit,local-ai,agent-dev}` |
| **D**  | Base substrate drivers + go-live surface + CI  | **0170–0179** | `stream/base-golive`       | `packages/{kernel,auth,tenancy-rls,billing,credits,jobs,email,field-crypto,migrate,cli,pricebook,registry-schema,ui}` + `apps/site` + `.github` + `infra` + test-hygiene                                               |

(`0139` = the Stage-2 deploy's own ADR — Railway provisioning topology. `0180+` reserved for the
integration session + P7 intake.)

## Stream A — Observability + Admin control-plane (ADR-0138)

Build `admin.caisson.sh` (fresh `apps/admin`, absorbs+removes `apps/studio`, CF-Access-gated) + the
self-hosted SigNoz fleet-observability backend. Local build only; the Railway deploy of admin+SigNoz
happens in the integration/deploy session.

| Task                                                                                          | Size | Internal dep | Note                                           |
| --------------------------------------------------------------------------------------------- | ---- | ------------ | ---------------------------------------------- |
| A1 `apps/admin` scaffold + `git mv` studio → `apps/admin/app/design/*` + remove `apps/studio` | 2    | —            | gates A4–A7                                    |
| A2 SigNoz self-host stack (ClickHouse + otel-collector + UI, CF-Access) as Railway config     | 1    | —            |                                                |
| A3 Per-service OTLP wiring (`services/{docs,license,support-bot}`) + Worker tail→OTLP bridge  | 2    | A2 (verify)  | reuses `@caisson/observability` Node bootstrap |
| A4 Business-admin read views (tenants/purchases/entitlements/credits) over Railway PG         | 2    | A1           | fail-closed RLS reads                          |
| A5 Ops/observability dashboard section (SigNoz-backed widgets)                                | 1    | A1, A2       |                                                |
| A6 Hybrid live architecture diagram (auto-topology + annotations)                             | 2    | A1           |                                                |
| A7 Decisions/SOT board + ADR-trail render                                                     | 1    | A1           |                                                |

**Open forks (SPEC-time, await your lock):** admin auth — CF-Access alone vs a `better-auth` operator
role behind it (rec: CF-Access alone first); business-admin — read-only cockpit vs operator mutation

- its RLS/audit posture (rec: read-only first); SigNoz sizing/retention/sampling (rec: single-node
  ClickHouse, 7–14d retention, 100% head sampling); diagram render tech (rec: server-rendered Mermaid/
  dagre-SVG regenerated on deploy).

## Stream B — New sellable packages + audit harness (ADR-0134/0135 + greenfield ADR-0133)

Greenfield only — new package dirs, zero conflict with any existing tree.

| Task                                                                                                                                                                                                                    | Size | Note     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- |
| B1 `@caisson/audit-harness` — cross-domain audit/validate harness (ADR-0134, generalizes the ADR-0101 gates as a reusable package; adoption into `tooling/`/`packages/ui` is a follow-up at integration, not in-stream) | 2    | new pkg  |
| B2 `@caisson/alerting` commercial Compliance module (ADR-0135)                                                                                                                                                          | 2    | new pkg  |
| B3 `@caisson/retention-runner` commercial Compliance module (ADR-0135)                                                                                                                                                  | 2    | new pkg  |
| B4 Greenfield harvest extractions routed to AI-Kit / Agentic-Dev that are **new packages** (ADR-0133 §1, new-dir slices only; in-place lifts belong to C/D)                                                             | 2    | new pkgs |

**Open forks (SPEC-time):** which gridwork-core packages ship first (rec: harness → alerting →
retention-runner); alerting transport (rec: reuse `@caisson/email` + a webhook port); retention-runner
scheduling (rec: `@caisson/jobs` port, in-memory dev driver). Pro-private firewall binding: patterns
only from `media-pipeline`, harvest from PUBLIC `tessera`.

## Stream C — Edition + AI package hardening & drivers

Edition act-trail debt + un-exercised seams + AI-surface driver expansion + the AI/edition in-place
slice of the ADR-0133 harvest.

| Task                                                                                                                                     | Size | Note                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------- |
| C1 P4a local-ai — record the missing EVAL act + author phase `SECURITY.md` (7 coded threats, no audit artifact)                          | 1    |                        |
| C2 P3 ai-kit — streaming `infer()` + spend-counter concurrency test + soft-cap warn test                                                 | 2    |                        |
| C3 P2 compliance — HIPAA control leg + EU-AI-Act high-risk controls + wire OSCAL export (T15 seam)                                       | 2    |                        |
| C4 P4b agent-dev — tenant RLS on agent memory + GA-promotion path                                                                        | 2    |                        |
| C5 AI inference drivers — AWS Bedrock / Azure OpenAI / Ollama backends (adapter-expansion, ADR from C range)                             | 2    |                        |
| C6 MCP Streamable-HTTP remote transport beside stdio (`mcp-server`)                                                                      | 1    |                        |
| C7 ai-kit P3-25 — decide+maybe build per-tenant encrypted BYOK                                                                           | 1–2  | has a build/defer fork |
| C8 Live-test the AI/edition by-design seams (ONNX on-device, hosted/rented inference) — external infra, DEPLOY-class, operator-sequenced | —    | external accounts      |
| C9 Reconcile stale edition act-trail debt in `readiness-and-backlog.md`/`build-state.md`                                                 | 0.5  | doc                    |

**Open forks (SPEC-time):** BYOK build-now vs defer (C7); harvest AI-lifts reference-only vs replace
existing metering (rec: reference/pattern-only, don't touch persistent metering); whether to spend on
external-account seam testing now (C8).

## Stream D — Base substrate drivers + go-live surface + CI

Base-package driver expansion + the base in-place harvest lifts + customer-facing go-live polish +
design residuals + CI ops-hygiene + test-hygiene.

| Task                                                                                                                                                                                                         | Size | Note                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------- |
| D1 Module-level Paddle **sandbox** price-id provisioning + pricebook wiring (P1, commerce prerequisite)                                                                                                      | 1    | sandbox only                             |
| D2 EULA drafting + `/legal/eula` route (P1)                                                                                                                                                                  | 1    |                                          |
| D3 Storefront customer-facing copy rewrite (ADR-0080/0129/0130)                                                                                                                                              | 2    |                                          |
| D4 Buyer-account/tenant mapping (personal vs org account)                                                                                                                                                    | 2    | **fork**                                 |
| D5 Base-substrate adapters — email SMTP/SES/Postmark, KMS (AWS; defer GCP/Azure/Vault), SSO WorkOS, R2 ArtifactStore, pg-boss JobQueue, Supabase Transactor, LemonSqueezy/Polar billing, Slack/Telegram chat | 2×N  | one ADR per port-family from the D range |
| D6 Base in-place harvest lifts (Wardfile top-6 minus audit-worm: jobs/kernel/billing/field-crypto/auth)                                                                                                      | 2    | pattern-reference hardening              |
| D7 Design residual: three.js signature-slot spike vs CSS/SVG four-beat                                                                                                                                       | 1    | **fork**                                 |
| D8 SEO IntentLadder revisit (options a/b/c)                                                                                                                                                                  | 1    | rec option (b) flexible union            |
| D9 Design launch-polish: Turnstile widget wired + consent checkbox                                                                                                                                           | 1    |                                          |
| D10 Greptile P2 backlog #1–#7 (2 real bugs in `cli` meter integration test + test-hygiene)                                                                                                                   | 1    |                                          |
| D11 CI ops-hygiene: fleet macOS `native-ext` leg + Terraform remote backend + `registry-index` required-check                                                                                                | 1    |                                          |
| D12 Fresh code-review pass on the PR#33 Stage-1 merge                                                                                                                                                        | 1    | process                                  |
| D13 Services-hardening audit reconcile (fixes shipped; doc only)                                                                                                                                             | 0.5  | doc                                      |

**Open forks (SPEC-time):** buyer-account personal-vs-org model (D4 — real product decision); three.js
vs CSS/SVG signature (D7 — the one live deferred design fork, ADR-0102/0103); SEO scaffold approach
(D8). **Absorbed by the Stage-2 deploy, not this stream:** the hardcoded-Plausible-domain live bug
(ADR-0118) is fixed in the deploy's B-SITE alongside the `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` ARG.

## Cross-stream independence + integration

**No stream depends on another** (every internal dep is within its own stream). Deliberately-shared
files, resolved by the **integration session** only:

- **Root workspace config** (`package.json` workspaces, `bun.lock`, `turbo.json`) — B/C/D add
  packages. Integration re-resolves the lockfile once.
- **`registry/{ledger.jsonl,index.json}`** — B/C/D add publishable modules. **Rebuild the index ONCE
  at integration** (the known "must-rebuild-index.json" gotcha; never hand-merge index bytes).
- **`docs/state/decisions-and-forks.md` + `docs/adr-index.md`** — all streams append ADRs. Reserved
  ranges prevent number collision; the board/index merge is append-only.
- **`knowledge/decisions/ADR-NNNN-*.md`** — distinct filenames per reserved range → no conflict.

**ADR-numbering housekeeping:** the `adapter-expansion.md` "ADR-0119+" proposals are **advisory
placeholders only** — each adapter/driver takes its real number from the **owning stream's reserved
range** (C: 0160–0169, D: 0170–0179) at lock time. This retires the ADR-0119 collision (Railway
topology board entry vs adapter queue) noted on the board.

**Integration session:** dedicated session, off the 4 merged branches. Merge ascending by ADR range
(A→B→C→D); after all four land: rebuild `registry/index.json`+`ledger.jsonl` once, reconcile the ADR
board + `adr-index.md` append-only, `bun run check` (`turbo --concurrency=50%`) + `bun run gate`
green, then the combined DEPLOY (Stream A's admin app + SigNoz stack — the only live-deploy act in the
whole Phase-2 arc). Streams never deploy on their own.

## Sequenced / gated (NOT one of the 4 parallel streams — has cross-dependencies)

- **P7 roadmap intake** (first vertical/feature pack SPEC) — gated on the harvest program (B/C) +
  Stage-2 go-live landing. Opens after the integration session.
- **The Stage-2 deploy itself** (`stage2-deploy-plan.md`) — prerequisite to nothing in the streams
  (streams build off clean `main`), but its live services are what Stream A's business-admin views
  (A4) read at deploy time.
