# Build Plan — Forge (phase-based, exit criteria, no dates)

Implements `specs/00-product-spec.md §5`. Per gridwork-core: spec-first, atomic commits,
golden-file regression before any compliance logic, no product code before Gate 4. Each phase
lists tasks + an **exit gate** (the verify). `tooling/` standards seam first; the module
production-standards pipeline is a **separate dedicated session** (D9) — P0 fixes the seam only.

## P0 — Foundations

- T0.1 Monorepo init: Bun workspaces + Turborepo + changesets (ADR-0001).
- T0.2 `tooling/`: eslint-config + tsconfig + testing harness + the lint-gate (ADR-0002). Wire
  the D9 standards layer: `@stack/standards-gate` (AGPL + down-only, ADR-0022), the provider-SDK
  boundary in `eslint-config/boundaries.js` (ADR-0022), and the module golden-fixture contract
  `testing/golden-module.ts` against the ADR-0013 runner.
- T0.3 `kernel`: typed config/schema + validator (← gridwork-core).
- T0.4 CI: build + lint + test + the standards gate; the golden-file harness skeleton. The gate
  job runs `stack-gate` + eslint + the golden run; the registry-index update job runs only after a
  green gate and stamps a `gateAttestation` (ADR-0021).
- **Exit:** a package builds, lints, tests; standards gate green; `bun run check` clean.

## P1 — Base substrate

- T1.1 `auth` (← gridwork) · T1.2 `tenancy-rls` fail-closed (← gwdigital, ADR-0005) ·
  T1.3 `billing` (MoR/Stripe) · T1.4 `credits` integer wallet + append-only ledger + 402 (ADR-0007) ·
  T1.5 `ai-config` provider-agnostic (ADR-0011) · T1.6 `mcp-server` auth-gated (ADR-0008) ·
  T1.7 `ui` token floor (← tessera) · T1.8 `jobs` + `email`.
- T1.9 `apps/base`: runnable reference wiring all base packages.
- **Exit:** base app runs; RLS fails closed under a missing filter (test proves it); a credit
  debit is atomic + idempotent; the buyer MCP answers an authed query.

## P2 — Compliance edition (hero)

- T2.1 `audit-worm` (S3 Object-Lock + SHA-256 hash chain, ADR-0006) · T2.2 `field-crypto`
  (column custom-type + key-version registry) · T2.3 append-only versioning (supersede-never-mutate) ·
  T2.4 `compliance`: config-as-code module registry + golden-file harness + **SOC2/HIPAA
  evidence-pack generator** + "flag, never guess".
- T2.5 `apps/compliance`: reference app emitting an evidence pack.
- **Exit:** evidence pack validates against a golden fixture; locked artifact is immutable +
  hash-chained; field encryption round-trips; unresolved flags block generation.

## P3 — AI Production Kit

- T3.1 token-metering (PG-atomic) · T3.2 per-tenant spend caps + circuit breaker ·
  T3.3 eval-harness + CI gate · T3.4 versioned prompt registry · T3.5 guardrails
  (input/output moderation, PII redaction) · T3.6 agent-assisted setup (the coach).
- **Exit:** a metered AI feature enforces a spend cap (402 on breach) + passes an eval gate in CI;
  the agent configures providers from a settings file end-to-end.

## P4 — Local-first AI + Agentic-Dev

- T4.1 `local-ai`: compute seam + privacy gate + sqlite-vec ANN + offline Ed25519 license
  (← tessera) · T4.2 local canonical store (← health-service) · T4.3 `agent-dev`: typed
  agent/skill/rule schema + lifecycle state machine + local hybrid memory + hooks (← gridwork-core).
- **Exit:** local-first reference app runs fully offline (FTS fallback when no embeddings);
  license verifies offline; the kernel drives one lifecycle act.

## P5 — Generator + registry (Option C)

- T5.1 `registry/`: the catalog/index + publish flow — the standards-gate is the only ingress
  (ADR-0020 manifest · ADR-0021 publish flow + attestation · ADR-0022 lint gates). Each module
  carries a `manifest.ts` + SPDX `license` + `AGENTS.md` + golden fixture.
- **T5.1b backfill:** publish P2–P4 packages as the initial registry module set — each through the
  same gated publish flow (no special path; the "backfill" is each module's first gated publish).
- T5.2 `cli` `create-stack`: compose a repo from a selection — **validate every caller-supplied
  module/edition id against the registry allowlist (`assertKnownModule`) before any path/subprocess
  (ADR-0021/0004)** · T5.3 agent-driven generation via the MCP server (same allowlist gate,
  ADR-0008) · T5.4 codegen-credit metering on each generation.
- **Exit:** the buyer's agent generates a tailored repo from the registry; a `generation` row +
  credit debit is recorded; the CLI path produces the same output; an unknown module id is rejected
  before any file/subprocess.

## P6 — Commerce + support + docs

- T6.1 `services/license`: Ed25519 issuer + MoR webhook + credit grants (idempotent) ·
  T6.2 entitlement/registry-access on purchase · T6.3 `services/support-bot` (Discord + Python
  LLM dispatch + codebase RAG + hosted inference, cloud-runner deploy, ADR-0009) · T6.4
  `services/docs` AI-native + `llms.txt` · T6.5 buyer dashboard + seller cockpit.
- **Exit:** a real purchase grants access + license + credits; the bot answers from the codebase
  and escalates a tagged ticket with an AI brief; docs feed both bot + buyer agents.

## P7+ — Round-out (roadmap)

Compliance vertical packs (legal-doc, fin-ops, certified-payroll, EU-AI-Act Annex-IV) · AI-feature
packs · local-first verticals · the module marketplace (per-module commerce at scale).

## Cross-phase invariants (every task)

TS strict · Zod `.strict()` boundaries · integer credits · append-only versions · fail-closed RLS ·
`fetchWithTimeout` · `crypto.timingSafeEqual` for secrets/licenses · no `any`/`console.log` ·
conventional atomic commits · golden-file regression before compliance logic · pro-private firewall held.
