# Kickoff F — DX & reach wave: interactive CLI · Remotion demos · harness expansion · live-transport gate · compat expansion

**Authored:** 2026-07-06 (operator-directed, competitor-overview session; grounds:
`docs/state/compatibility-matrix.md` recon of the same day). **Shape:** each workstream runs
investigate/research FIRST, then presents its deep forks via AskUserQuestion (rounds of ≤4, never
auto-decide), then builds after locks. **Routing:** recon → haiku · bounded builds → sonnet ·
synthesis/picker prep → opus main thread · every dispatch sets `model`.

## W1 — Interactive `create-caisson` (the open-source enticement play)

Today the CLI is fully flag-driven, zero prompts (`packages/cli/src/cli.ts`), free-local by
ADR-0093. Goal: a first-run experience competitive with `create-t3-app`/`create-astro` — pick
modules/editions interactively, preview what you get, scaffold the whole Apache-2.0 base with
different configs in one run.

1. **Research:** prompt-library pick (`@clack/prompts` is the 2026 standard — MIT, used by
   create-astro/create-svelte, Bun-compatible; alternatives `prompts`, `inquirer`); how the
   existing Zod selection schema + registry allowlist maps onto interactive steps; what
   "config presets" means against the template engine (ADR-0091 migration bundling untouched).
2. **Deep forks:** interactive-vs-flags precedence (recommend: flags win, interactive fills
   gaps — CI stays scriptable) · preset shape (named base-stacks vs per-module toggles) ·
   whether the free sample path gets promoted to the default first-run.
3. **Build:** interactive mode behind isTTY detection; non-interactive path byte-identical to
   today (regression-locked). CLI is Apache-2.0 (ADR-0136) so an MIT dep is clean.

## W2 — Remotion demo videos on the UI kit (fills the ADR-0237 F2 media contract)

`media-placeholder.tsx` is the declared drop-in contract on every module depth page + edition
page; nothing real has ever filled it. **License verified 2026-07-06:** Remotion is free for
for-profit orgs ≤3 employees (remotion.dev/docs/license) — GridWork Digital qualifies today;
flag: must upgrade to Company License if the team ever grows past 3.

1. **Research:** Remotion + `@caisson/ui` token bridge (the kit's tokens as the video design
   system — same brand floor, ADR-0078); render pipeline (local render → static mp4/webm into
   `apps/site` public assets vs `@remotion/player` interactive embeds); one pilot module
   (recommend `field-crypto` or `audit-worm` — visually demonstrable flows).
2. **Deep forks:** static renders vs interactive Player embeds (bundle-size + CSP posture) ·
   per-module video set vs one hero reel first · where render source lives (`apps/site` vs a
   `tooling/` video workspace, taxonomy gate applies).
3. **Build:** pilot video for 1–2 modules through the `media` section kind, then fan out.
   Optionally pair with a `stackCompat` section kind rendering
   `docs/state/compatibility-matrix.md` data (badge row: Postgres · OTel · 8 AI lanes · 3
   harnesses) — same data, one new renderer kind.

## W3 — Agent-harness emitter expansion (Agentic-Dev edition)

`packages/agent-dev/src/emitter.ts` fans to 3 targets today: Claude Code, Codex (AGENTS.md),
Cursor. AGENTS.md is now a 60k-project open standard and GitHub Copilot's coding agent reads it
natively — so the Codex target already part-covers more than its name says; rename/reframe it.

1. **Research (mostly done, verify at build time):** target formats — Windsurf
   `.windsurf/rules/*.md` (globs frontmatter) · GitHub Copilot `.github/copilot-instructions.md`
   - path-scoped `.github/instructions/*.instructions.md` (applyTo) · Cline/Roo
     `.clinerules/*.md` · (optional tier-2: JetBrains `.aiassistant/rules/`, Amazon Q
     `.amazonq/rules/`). Activation-semantics fidelity mapping (always/paths/manual) differs per
     tool — the agentsmd RFC #179 table is the reference; emit a fidelity warning when a target
     can't represent the source semantics rather than silently degrading.
2. **Deep forks:** which targets make the cut (recommend Windsurf + Copilot + Cline; defer
   JetBrains/AmazonQ) · whether AGENTS.md becomes the declared universal base layer with
   tool-specific files as overlays (matches where the ecosystem is going).
3. **Build:** new emitter targets + per-target golden-file tests (the existing emitter test
   pattern); marketing copy on the agent-dev module page updates in the same PR (sells-claim
   honesty).

## W4 — Live-transport test gate (launch blocker, docs-first)

Every live transport must be enumerated + proven (or explicitly waived) before launch. The
`live/` + `test:live` self-skipping convention exists (ADR-0201); what's missing is the
checklist doc.

1. **Build (no research round):** `docs/state/live-transport-checklist.md` — one row per live
   transport: package · test command · creds needed · last-proven date · status.
   Seed from known state: **proven** S3 WORM (`caisson-worm`), AWS KMS (real-CMK 2026-07-02),
   OpenRouter both lanes, ONNX (G1-A recipe); **never live-run:** Azure OpenAI + Bedrock probes
   (self-skipping, no creds), Ollama/local lanes, WorkOS SSO, LemonSqueezy/Polar billing
   drivers, Supabase tenancy driver.
2. **Also:** refresh the stale rows in `docs/state/adapter-expansion.md` flagged by
   `docs/state/compatibility-matrix.md` §6 (Bedrock/Azure/Ollama, WorkOS, AWS KMS, LS/Polar,
   MCP-HTTP all shipped since it was authored).
3. **Fork:** which unproven transports are launch-gating vs documented-as-unproven (operator
   call per row; recommend gating only what a launch-day buyer touches: billing + OpenRouter).

## W5 — Compatibility expansion (which new adapters actually widen the market)

Ranked candidates, composing `docs/state/adapter-expansion.md`'s still-open rows with new
market-pull items the matrix recon surfaced:

| Rank | Add                                                                                                            | Why                                                                                                       | Effort |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| 1    | **Drizzle adapter** for `tenancy-rls`/`migrate`                                                                | every boilerplate competitor is Drizzle/Prisma-native; raw-SQL-only is the single biggest adoption filter | M      |
| 2    | **Framework quickstart adapters** (Next.js route handlers · Hono · Elysia) for auth/mcp-server/billing-webhook | "framework-agnostic" currently means "wire it yourself"; competitors demo drop-in                         | M      |
| 3    | **Deploy templates** in generated repos (Dockerfile + Railway/Fly/Vercel configs)                              | zero deploy story shipped today; cheap, high-perceived-value                                              | S      |
| 4    | Email: **SMTP-generic + SES**                                                                                  | Resend-only blocks buyers with existing mail stacks (Tier 1A, still open)                                 | S      |
| 5    | Storage: **R2** (S3-compat reuse), then GCS/Azure Blob                                                         | ~trivial for R2 (Tier 2A)                                                                                 | S      |
| 6    | Jobs: **pg-boss driver** for the `JobQueue` port                                                               | zero-new-infra self-host; check overlap with ADR-0256's pg-boss scheduler first — may be partly done      | S–M    |
| 7    | KMS: GCP/Azure Key Vault/Vault                                                                                 | enterprise procurement breadth beyond AWS (Tier 1B tail)                                                  | M      |
| 8    | Chat: **Slack** support-bot driver                                                                             | needs the ChatPlatform port extraction first (Tier 3)                                                     | M      |
| 9    | AI lanes: Groq/Mistral/Together **as documented openai-compatible recipes**                                    | mostly zero code — they ride `@ai-sdk/openai-compatible` already; docs + config examples                  | XS     |

**Deep forks:** which ranks make the wave (recommend 1–5) · Drizzle-only vs Drizzle+Prisma ·
per-family ADRs per the adapter-expansion convention (one ADR per port-family).

## Inputs on disk

`docs/state/compatibility-matrix.md` (2026-07-06 recon) · `docs/state/adapter-expansion.md`
(stale rows flagged in matrix §6) · `packages/cli/src/{cli,generate,meter}.ts` + ADR-0093 ·
`packages/agent-dev/src/emitter.ts` · `apps/site/components/{media-placeholder,page-sections}.tsx`

- ADR-0237 F2 · ADR-0245 (credits policy) · `outputs/research/monorepo-bigpicture-2026-07.md`.

## Boundaries

No price numbers (Kickoff D owns those). No new required CI check without a lock. Remotion
license posture re-verified if headcount changes. W1 must not break the non-interactive CLI
contract (CI consumers). Each adapter family lands behind its existing port — never a port-contract
fork (ADR-0003/0108). `bun run sot` green at every wrap.
