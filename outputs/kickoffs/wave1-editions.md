# KICKOFF — Caisson Wave 1: the four editions (P2 Compliance · P3 AI Production Kit · P4 Local-first + Agentic-Dev · P5 Generator/registry full drive)

You are starting the **Wave-1 editions** build for Caisson, in the worktree
`/home/gw/lab/caisson-wave1` on branch `wave1/editions`, branched off the green Wave-0 substrate
(`wave0/shared-substrate`, PR #2). This file is the brief for the whole wave; each surface gets its
own SPEC→PLAN→EXECUTE→VERIFY→SWEEP→SHIP cycle once its forks are locked.

**Read first (in this repo, in order):** `CLAUDE.md` · `docs/state/decisions-and-forks.md` ·
`plan.md` (§P2–P5) · `specs/00-product-spec.md` · the Wave-0 seams you consume:
`packages/field-crypto/src/*` (encrypted column · per-tenant keys · KMS port),
`packages/kernel/src/{audit-chain,versioning,errors}.ts`, `registry/{schema,scripts}/*` +
`packages/cli/src/*` (allowlist gate · debit-before-spend), `packages/{credits,tenancy-rls,auth,billing,ai-config,mcp-server}/src/*`,
`tooling/{standards-gate,testing}/src/*`.

This is an **ULTRACODE** wave: spec-first 7-act per surface, orchestrated with the **Workflow tool**,
research-backed, adversarially verified. **Never auto-decide a fork** — Wave-1 has MANY open
sub-decisions across five surfaces; they are SURFACED by the research workflow (below) and put to the
operator via `AskUserQuestion` **before any product code**. No product code before the SPEC/ADR it
implements is locked (CLAUDE.md cadence). Pro-private firewall holds: **nothing from `media-pipeline`
seeds any package — patterns only; harvest the PUBLIC `tessera` seed.**

## Mission

Build the four premium editions on top of the shipped base + substrate, each a **composition** of
packages (never a fork; a package never depends "up" on an edition — ADR-0003/0022). The Compliance
edition is the **hero** (compliance wedge under a production-rigor umbrella, ADR-0040) and leads.

## Surfaces (each = its own gated cycle)

1. **P2 — Compliance edition (hero).** `audit-worm` (S3 Object-Lock + the kernel SHA-256 hash chain,
   ADR-0006) · `field-crypto` column wiring alongside `withTenant` (encryption boundary == RLS
   boundary) · append-only versioning (supersede-never-mutate) · `compliance`: config-as-code control
   registry + golden-file harness + **SOC2/HIPAA evidence-pack generator** + "flag, never guess" ·
   `apps/compliance` reference app. **Consumes Wave-0:** `encryptedColumn`/`TenantFieldCrypto`,
   `audit-chain` (+ the new `anchorChain` WORM tip-store), `versioning`.
2. **P3 — AI Production Kit.** token-metering (PG-atomic) · per-tenant spend caps + circuit breaker ·
   eval-harness + CI gate · versioned prompt registry · guardrails (input/output moderation, PII
   redaction) · agent-assisted setup coach. **Consumes:** `credits` (402 gate), `ai-config`, `mcp-server`.
3. **P4a — Local-first AI.** compute seam + privacy gate + sqlite-vec ANN + **offline Ed25519
   license** (← PUBLIC tessera) · local canonical store. AGPL is the sole open flank (ADR-0023).
4. **P4b — Agentic-Dev.** typed agent/skill/rule schema + lifecycle state machine + local hybrid
   memory + hooks (patterns ← gridwork-core).
5. **P5 — Generator + registry full drive.** publish flow (gate = the only ingress) · **T5.1b
   backfill** (publish P2–P4 packages, each through the gated publish) · full `create-caisson`
   generation (disk writer behind the shipped `FileSetWriter` seam — re-assert path safety) ·
   MCP-driven generation (same allowlist gate, ADR-0008) · codegen-credit metering. **Consumes:** the
   registry allowlist + `runGeneration` debit seam already shipped.

## Locked context (binding — implement to, do not relitigate)

ADR-0002 (engineering invariants) · ADR-0003 (composable packages, never forks) · ADR-0005
(fail-closed RLS) · ADR-0006/0043 (WORM + audit chain + field-crypto) · ADR-0007/0024 (credits) ·
ADR-0008 (buyer MCP entitlement) · ADR-0009 (support) · ADR-0010/0023 (license; fully-commercial,
AGPL local-first the sole open flank) · ADR-0011 (provider-agnostic AI config) · ADR-0013 (testing) ·
ADR-0014 (Drizzle/Neon) · ADR-0019 (error model) · ADR-0020–0022 (module pipeline + boundary gates) ·
ADR-0040–0042 (brand) · ADR-0044 (reference apps = Next.js; packages never import a framework) ·
ADR-0045–0049 (Wave-0 substrate). Open board forks carried in: **Pricing numbers** (deferred),
**field-crypto row-level AAD** (deferred to this Compliance surface), **registry prevention-gate**
(operator action — DONE: branch protection + real CODEOWNERS).

## Pipeline (how this wave runs)

1. **RESEARCH (Workflow fanout) — now.** A multi-agent investigation, several agents per surface
   (fork-surfacer · SDK/landscape via exa · seed-mapping), then per-surface synthesis, then a
   completeness critic across all surfaces. Output: a structured fork list for EVERY surface →
   `outputs/research/wave1-forks.md`. **Surfaces forks; decides nothing.**
2. **FORKS (AskUserQuestion).** Every surfaced fork goes to the operator, grouped by surface. Each
   locked fork → an append-only ADR (next free number after 0049) + a board row. No code before locks.
3. **EXECUTE (Workflow fanout) — after locks.** Per surface, an isolated-worktree execute cycle;
   parallel writers get `isolation: "worktree"`. Bounded tasks → specialist subagents; context-bearing
   edits stay main-thread. One task = one commit.
4. **VERIFY → SWEEP → SHIP (Workflow) — per surface.** Goal-backward verify; conditional audits per
   tag (security/eval/ui/infra); REVIEW always. Open a PR per surface; **stop at the merged PR. No
   DEPLOY.**

## Standards (binding)

gridwork-core security floor (`crypto.timingSafeEqual`, Zod `.strict()`, traversal-safe paths, no
secret logging) · ADR-0002 invariants (TS strict, Bun, no `any`/`console.log`, integer credits,
append-only, `fetchWithTimeout`, fail-closed) · ADR-0022 four gates (AGPL · provider-SDK · down-only ·
manifest agreement) · ADR-0019 typed errors · ADR-0013 PGlite integration + golden-file-before-logic ·
ADR-0005 RLS boundary == encryption boundary. UI surfaces (reference apps) add WCAG AA + the
production-response header floor.

## Out of scope / firewall

No GTM (own track — `caisson-gtm`/PR #3) · no commerce/license issuer or support-bot unless a surface
explicitly reaches P6 · no live cloud calls in CI (S3/KMS test-doubled) · **No DEPLOY** (stop at the
PR) · **pro-private firewall** (no `media-pipeline` implementation; PUBLIC `tessera` is the harvest).
Do not relitigate a locked ADR (source-of-truth: board > ADRs > specs > plan).
