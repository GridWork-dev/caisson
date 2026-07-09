# Kickoff E — Independent build wave: flip mechanics · inspector · build-state rework · measurement loops

**Authored:** 2026-07-05 (post-merge split picker: Program-vs-Independent, parallel worktrees).
**Sibling:** `KICKOFF-D-catalog-program.md` (the catalog chain — D owns all price NUMBERS; this
kickoff never waits on it). **Branch:** `feat/independent-build-wave` off `main` (worktree).
**Shape:** each workstream runs investigate/research FIRST, then presents its deep forks via
AskUserQuestion (rounds of ≤4, never auto-decide), then builds after locks. Workstreams are
tree-disjoint enough to fan out as parallel workflows inside the session. **Routing:** recon →
haiku · research/bounded builds → sonnet · synthesis/picker prep → opus main thread · the
billing/license seams in W1 → fable per the caisson routing note · every dispatch sets `model`.

## W1 — Checkout-flip mechanics (ADR-0244/0245; tags: `billing`)

The flip itself stays operator-gated go-live; this builds the MECHANICS so the flip session
only flips.

1. **Research:** the entitlement resolver + registry Worker gating path (ADR-0136/0223) for the
   version-publish-date window check — enforcement point candidates: issuer-side claim,
   Worker-side filter, or both; the credits ledger schema for grant-level `expires_at` + FIFO
   burn (ADR-0245 — wallet is integer+ledgered, expiry is additive); Paddle sandbox renewal-SKU
   plumbing (products exist per-SKU; **cents are placeholders until Kickoff D Stage 2**); the
   live EULA text vs ADR-0244 (it currently reads unbounded-updates — the contradiction is live
   on a self-serve site).
2. **Deep forks:** window-check enforcement point (issuer vs Worker vs both) · FIFO tie-break +
   expiry-notification posture · EULA/checkout copy draft approval (operator reads the exact
   language) · renewal-SKU sandbox shape.
3. **Build:** the four rows — window check · expiry+FIFO ledger logic · renewal plumbing
   (sandbox, placeholder cents) · corrected EULA/checkout copy. Greptile critical paths
   (billing/credits/license) — expect the gate.

## W2 — Agentic-Dev inspector (ADR-0243; lock-and-go; tags: `security` at SHIP)

No research round needed — all forks resolved. Execute
`outputs/specs/deferred-respec/SPEC-agent-dev-inspector.md` Tasks 1–7 as written: `LocalStore.
list()` (B1, patch changeset) · `Bun.serve` inspector at `apps/agent-dev/src/inspector.ts` (A1,
`127.0.0.1` bind only) · tenant-traversal + tamper-badge tests · docs flip · the two backlog
ref corrections. The SHIP security audit covers the bind + `tenantDbPath` boundary.

## W3 — build-state.md rework (docs tree)

1. **Research:** what the doc is FOR post-SOT-expansion (the deep per-package build-status view;
   `outstanding-work.md` owns work, `deploy/STATE.md` owns deploys) — and the 3 accepted-but-real
   count stalenesses (agent-dev test count, ai-evals coverage 6x, ai-meter file/loc — ledger ids
   3aa54d29/0d5291a4/f5d1a436).
2. **Deep fork (small):** rework shape — collapse the stacked timeline into frontmatter-dated
   sections vs full rewrite to a generated-table + prose split (and whether counts become a
   `sot`-checkable grounds relationship).
3. **Build:** the rework + fresh counts off disk truth; frontmatter per the house convention.

## W4 — Measurement pair (both un-parked by the 2026-07-05 operator call)

1. **AI-citation tracking loop** (research gap #9): research the tracker options — Peec,
   Ahrefs Brand Radar, hand-rolled periodic probes (ChatGPT/Claude/Perplexity cite-checks) —
   cost, cadence, API access, and how the feed lands where `gw-aeo-strategist` reads it.
   **Deep forks:** tool + monthly budget · probe question set · cadence · where results live
   (repo doc vs PostHog vs both).
2. **Docs-conversion instrumentation** (research gap #12): discover→quickstart→signup funnel on
   the docs surface. Research: what the split-analytics posture (ADR-0237, Plausible + PostHog
   dashboard-scoped) allows without new consent surface (ADR-0236 precedent); event schema
   candidates; where API-key/account-creation conversion events already exist.
   **Deep forks:** tool assignment (Plausible goals vs PostHog funnels vs both) · event schema ·
   consent posture.
3. **Build after locks:** wire both; each ends with a first real report artifact (a citation
   baseline snapshot · a funnel dashboard link in `docs/gtm/channels-launch.md`).

## Inputs on disk

`docs/state/outstanding-work.md` §2 (the rows this kickoff absorbs) · ADR-0243/0244/0245 ·
`outputs/specs/deferred-respec/SPEC-agent-dev-inspector.md` · `docs/gtm/{channels-launch,
gaps-and-plays}.md` (gap #9/#12 evidence rows) · `outputs/research/monorepo-bigpicture-2026-07.md`
§2 rows 9/12 · `docs/build-state.md`.

## Boundaries

Parallel with Kickoff D — whichever merges second rebases. **D owns every price number**; W1
ships placeholder cents in sandbox and never commits a displayed price. The flip itself
(production Paddle, CF-Access, publish) stays in the operator-gated go-live sequence — out of
scope here. No new required CI check without a later lock. `bun run sot` green at every wrap.
