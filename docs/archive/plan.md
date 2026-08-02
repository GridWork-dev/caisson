# Build Plan — Caisson (phase-based, exit criteria, no dates)

Implements `specs/00-product-spec.md §5`. Per gridwork-core: spec-first, atomic commits,
golden-file regression before any compliance logic, no product code before Gate 4. Each phase
lists tasks + an **exit gate** (the verify). `tooling/` standards seam first; the module
production-standards pipeline is a **separate dedicated session** (D9) — P0 fixes the seam only.

**Live per-phase + per-package status detail: `docs/build-state.md`** (this file = the plan;
that file = the state). If `docs/build-state.md` is absent, the per-phase **STATUS** tags below
plus `docs/state/decisions-and-forks.md` (the live board, CLAUDE.md SoT #1) are authoritative.
The tags here are a synthesized phase index, NOT a new source of truth — canonical status stays
in the board + `knowledge/decisions/` ADRs.

**STATUS legend** (verified against the tree, 2026-06-29 — post-PR#24):
`SHIPPED` = built + tested + in `main`, exit gate met · `MERGED (Wave-1)` = packages landed in
`main` with real, tested implementation but NOT yet wired into a runnable, entitlement-gated
edition product · `SPEC+PLAN ready` = design locked, code not yet written · `PENDING` = not
started · `ROADMAP` = post-v1, no code.

## P0 — Foundations

> **STATUS: SHIPPED.** `tooling/` (eslint-config · tsconfig · standards-gate · testing),
> `kernel` (12 src / 9 tests), `registry/` runtime + the CI workflows
> (`.github/workflows/{ci,lighthouse}.yml`) are all in `main`; exit gate met.
> Owners: ADR-0001/0002/0021/0022.

- T0.1 Monorepo init: Bun workspaces + Turborepo + changesets (ADR-0001).
- T0.2 `tooling/`: eslint-config + tsconfig + testing harness + the lint-gate (ADR-0002). Wire
  the D9 standards layer (all 3, ADR-0022): `@caisson/standards-gate` (AGPL ext+ws · down-only ·
  manifest agreement), the provider-SDK boundary in `eslint-config/boundaries.js`, and
  `.dependency-cruiser.cjs` (graph reach + base→edition); plus the module golden-fixture contract
  `testing/golden-module.ts` against the ADR-0013 runner. Fix the workspace install first (empty
  `services/*`/`apps/*` members + missing lockfile block `bun install` today).
- T0.3 `kernel`: typed config/schema + validator (← a private GridWork repo).
- T0.4 CI: build + lint + test + the standards gate; the golden-file harness skeleton. The gate
  job runs `caisson-gate` + eslint + the golden run; the registry-index update job runs only after a
  green gate and stamps a `gateAttestation` (ADR-0021).
- **Exit:** a package builds, lints, tests; standards gate green; `bun run check` clean.

## P1 — Base substrate

> **STATUS: SHIPPED.** `auth` · `tenancy-rls` (fail-closed RLS + integration test) · `billing` ·
> `credits` (integer wallet + append-only ledger) · `ai-config` · `mcp-server` · `ui` · `jobs` ·
> `email` + `apps/base` all built + tested in `main` (P0+P1 base substrate green). `ai-config`/
> `jobs`/`email` are real but minimal; the core (auth/tenancy-rls/billing/credits) is substantial.
> Owners: ADR-0005/0007/0008/0011/0014–0019, ADR-0024.

- T1.1 `auth` (← a private GridWork repo) · T1.2 `tenancy-rls` fail-closed (← a private GridWork repo, ADR-0005) ·
  T1.3 `billing` (MoR/Stripe) · T1.4 `credits` integer wallet + append-only ledger + 402 (ADR-0007) ·
  T1.5 `ai-config` provider-agnostic (ADR-0011) · T1.6 `mcp-server` auth-gated (ADR-0008) ·
  T1.7 `ui` token floor (← a private GridWork repo) · T1.8 `jobs` + `email`.
- T1.9 `apps/base`: runnable reference wiring all base packages.
- **Exit:** base app runs; RLS fails closed under a missing filter (test proves it); a credit
  debit is atomic + idempotent; the buyer MCP answers an authed query.

## P2 — Compliance edition (hero)

> **STATUS: MERGED (Wave-1).** `compliance` (16 src / 11 tests, ~2.9k LOC: deterministic
> evidence-pack generator · soc2/hipaa/eu-ai-act catalogs · Ed25519 signing · OSCAL seam ·
> flag-never-guess), `audit-worm` (S3 Object-Lock store + SHA-256 hash chain + version store +
> migrations), `field-crypto` (per-tenant HKDF AEAD, AES-256-GCM) and `apps/compliance` all
> landed in `main` with real, tested code. NOT yet a runnable, entitlement-gated product (apps
> thin, no commerce wiring). Owners: ADR-0006/0043/0045/0046/0051–0058.
> **Flag:** ADR-0082 §3's "empty stub" line predates Wave-1 and is stale for these packages.

- T2.1 `audit-worm` (S3 Object-Lock + SHA-256 hash chain, ADR-0006) · T2.2 `field-crypto`
  (column custom-type + key-version registry) · T2.3 append-only versioning (supersede-never-mutate) ·
  T2.4 `compliance`: config-as-code module registry + golden-file harness + **SOC2/HIPAA
  evidence-pack generator** + "flag, never guess".
- T2.5 `apps/compliance`: reference app emitting an evidence pack.
- **Exit:** evidence pack validates against a golden fixture; locked artifact is immutable +
  hash-chained; field encryption round-trips; unresolved flags block generation.

## P3 — AI Production Kit

> **STATUS: MERGED (Wave-1).** `ai-kit` (single metered-inference gateway, Vercel AI SDK v5
> chokepoint), `ai-meter` (estimate→reserve→reconcile, PG-atomic spend, ~957 LOC), `prompt-registry`,
> `ai-evals`, `guardrails` and `apps/ai-kit` landed + tested in `main`. Package code is real;
> not yet wired into a runnable product. Owners: ADR-0059/0060.

- T3.1 token-metering (PG-atomic) · T3.2 per-tenant spend caps + circuit breaker ·
  T3.3 eval-harness + CI gate · T3.4 versioned prompt registry · T3.5 guardrails
  (input/output moderation, PII redaction) · T3.6 agent-assisted setup (the coach).
- **Exit:** a metered AI feature enforces a spend cap (402 on breach) + passes an eval gate in CI;
  the agent configures providers from a settings file end-to-end.

## P4 — Local-first AI + Agentic-Dev

> **STATUS: MERGED (Wave-1).** `local-ai` (~2.2k LOC, 9 tests), `local-store`, `license-verify`
> (offline Ed25519), `agent-dev` + `agent-kernel`, and `apps/{local-ai,agent-dev}` landed +
> tested in `main`. Local-first is now fully-commercial (AGPL flank killed, ADR-0050/0083).
> Agentic-Dev is the thinnest surface of the four (per-package truth: `docs/build-state.md`;
> the ADR-0082 §4 roadmap label was retired by ADR-0237 rider 2).

- T4.1 `local-ai`: compute seam + privacy gate + sqlite-vec ANN + offline Ed25519 license
  (← a private GridWork repo) · T4.2 local canonical store (← a private GridWork repo) · T4.3 `agent-dev`: typed
  agent/skill/rule schema + lifecycle state machine + local hybrid memory + hooks (← a private GridWork repo).
- **Exit:** local-first reference app runs fully offline (FTS fallback when no embeddings);
  license verifies offline; the kernel drives one lifecycle act.

## P5 — Generator + registry (Option C)

> **STATUS: SHIPPED (PR#12 merged; security audit PASS).** Real disk `FileSetWriter` (path-safe
> atomic write) + templated engine (golden), `runGeneration` (debit-before-spend → write → audit
> row, PGlite, 402-writes-nothing, idempotent), buyer-MCP `generate` converged on the registry
> index (id+version validate, ADR-0071 entitlement-expand) **driving** `runGeneration` end-to-end,
> test-doubled publish → byte-identical index, runnable `create-caisson` bin, `@caisson/migrate`
> assemble. The registry-read Worker is now **LIVE** (`caisson-registry.broken-wood-97a9.workers.dev`,
> ADR-0047 seam → live). **Deferred (P6 forks):** publishability flip (T2/T3), compose-time
> migration-bundle (empty no-op today), `@caisson/migrate` promotion, MCP rate-limit.
> Owners: ADR-0004/0020/0021/0047/0048/0049/0068–0071/0077.

- T5.1 `registry/`: the catalog/index + publish flow — the standards-gate is the only ingress
  (ADR-0020 manifest · ADR-0021 publish flow + attestation · ADR-0022 lint gates). Each module
  carries a `manifest.ts` + SPDX `license` + `AGENTS.md` + golden fixture.
- **T5.1b backfill:** publish P2–P4 packages as the initial registry module set — each through the
  same gated publish flow (no special path; the "backfill" is each module's first gated publish).
- T5.2 `cli` `create-caisson`: compose a repo from a selection — **validate every caller-supplied
  module/edition id against the registry allowlist (`assertKnownModule`) before any path/subprocess
  (ADR-0021/0004)** · T5.3 agent-driven generation via the MCP server (same allowlist gate,
  ADR-0008) · T5.4 codegen-credit metering on each generation.
- **Exit:** the buyer's agent generates a tailored repo from the registry; a `generation` row +
  credit debit is recorded; the CLI path produces the same output; an unknown module id is rejected
  before any file/subprocess.

## P6 — Commerce + support + docs

> **STATUS: SHIPPED.** `services/docs` (AI-native corpus + `llms.txt` + Bearer `/query`, PR#23,
> ADR-0096) + `services/support-bot` (Discord RAG, PR#24, ADR-0009/0105) BUILT + merged;
> `services/license` carries the X-2 cycle→grant mapper + entitlement resolver + Worker filtering
> (B1/B2, PR#18, ADR-0089/0098/0071), the Ed25519 license **issuer** (ADR-0110), revoke-on-cancel +
> one-time-purchase entitlement (ADR-0113), and publish-readiness (ADR-0111); the buyer dashboard
> shipped in `apps/site`. NB: the GTM marketing+docs site (`apps/site`, Fumadocs) shipped separately in
> the GTM wave (ADR-0084–0087) and is distinct from P6's `services/docs`.

- T6.1 `services/license`: Ed25519 issuer + MoR webhook + credit grants (idempotent) ·
  T6.2 entitlement/registry-access on purchase · T6.3 `services/support-bot` (Discord + Python
  LLM dispatch + codebase RAG + hosted inference, cloud-runner deploy, ADR-0009) · T6.4
  `services/docs` AI-native + `llms.txt` · T6.5 buyer dashboard + seller cockpit.
- **Exit:** a real purchase grants access + license + credits; the bot answers from the codebase
  and escalates a tagged ticket with an AI brief; docs feed both bot + buyer agents.

## P7+ — Round-out

> **STATUS: SPLIT (operator picker 2026-07-01).** Three items pulled into the **pre-launch**
> sellable-surface roadmap; the rest stays post-v1. Pulled items are spec-gated — SPEC/ADR locked
> before code, same cadence as edition-seam-completion.

**Pulled to pre-launch (spec next, alongside the lift phase):**

- **EU-AI-Act Annex-IV compliance vertical pack** — shortest hop off the just-shipped OSCAL v1.2.2 +
  EU-AI-Act framework/collector (ADR-0179/0181); a demoable vertical for the hero compliance edition.
- **OSCAL push** — the ingest/delivery side of the export the seam build just built (export → live
  GRC-platform push/pull); scope + target fork to be surfaced. **Includes** finishing the OSCAL
  attestation-wizard seam (operator picker 2026-07-01): the compliance-leg endpoint that turns the
  wizard's filled `manualSlots[]` into a validate-conformant SAR+POA&M pack (JSON+XML) the buyer can
  download — apps/site ships the slot-fill half today; the pack-gen half lands here.
- **Module marketplace** — per-module commerce at scale (browse/discover), extending the existing
  on-site cart + multi-item Paddle checkout.

**Post-v1 (roadmap; no code):**

- AI-feature packs · local-first verticals · the remaining compliance vertical packs (legal-doc,
  fin-ops, certified-payroll).

## Cross-phase invariants (every task)

TS strict · Zod `.strict()` boundaries · integer credits · append-only versions · fail-closed RLS ·
`fetchWithTimeout` · `crypto.timingSafeEqual` for secrets/licenses · no `any`/`console.log` ·
conventional atomic commits · golden-file regression before compliance logic · pro-private firewall held.
