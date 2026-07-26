# SPEC — Agent-ready design-system surface for `@caisson/ui`

- **Date:** 2026-07-13 · **Status:** IMPLEMENTED — core v1 shipped in PR #237 (forks locked → ADR-0330, PLAN locks ADR-0345); ADR-0379 closes the residual with the generated 39-component manifest, byte drift guard, and shared contrast implementation. Site-copy follow-ups remain intentionally outside this no-copy wave.
- **Tags:** `product` `frontend` `ai` `security` (eval act fires on `ai`; security audit fires on `security` — this spec now depends on an MCP transport/auth boundary decision and an entitlement-gated doctor surface, CR-09)
- **Provenance:** Astryx pattern (github.com/facebook/astryx — "fully customizable and agent ready", CLI as _the primary interface for humans and agents_ + MCP server, beta, 7k★); Storybook 10.3+ `componentsManifest` (default-on since storybookjs/mcp #208, 2026-04); caisson agent-visibility thesis (ADR-0254 lineage, llms.txt shipped). Amended post-audit against the 2026-07-13 adversarial review round (below).

## Amendment record (2026-07-13)

The original draft locked a v1 that spanned two MCP servers (one open+unauthenticated), both CLI and MCP fronts, and runtime a11y checks. The 18-lane red-team + Codex `gpt-5.6-sol` adversarial review scored this SPEC **rethink** (`AUDIT-SYNTHESIS.md` §B; `codex-adversarial-review.md` verdict table). Findings that forced this amendment:

- **CR-09** — "open, unauthenticated MCP" was locked without stating transport. An unauthenticated _HTTP_ MCP violates `identity/security.md`; the existing `packages/mcp-server` is deliberately fail-closed pre-auth. Fix: the only unauthenticated tier in this spec is now a **local stdio-only** discovery server — no network listener, ever.
- **CR-08** — the locked "extend `packages/cli`" fork ignored that `packages/cli` is Apache-2.0 and exposes only the `create-caisson` bin (a credit-metered scaffold), not a buyer CLI. Shipping gated `doctor` logic there either gives it away or invents an undocumented remote dependency. Fix: that fork (F) is reopened to PLAN with three named options.
- **WR-04** — the shadcn install-path reference used `npx` and an unqualified `@caisson/button` path; GitHub registries resolve as `owner/repo/item` and require a configured/indexed namespace. Fixed inline.
- **WR-10** — the fork board's "full-featured / future-proof" bias inflated v1 to two servers + two fronts + runtime axe in one shot — independent proof obligations stacked into a single unshippable increment. Fix: v1 re-cut to five vertical slices (below); runtime axe and the CLI packaging host move to later increments/PLAN.
- The Claude red-team lane separately flagged that runtime a11y (Fork E) contradicts this SPEC's own no-browser buyer story (jsdom can't evaluate contrast; no renderer is owned by this repo — Storybook is a trial, not a dependency).

The operator re-locked all six forks in the same pass (`FORK-LOCKS.md` ✅ RE-LOCKS → "DS surface" row: _"Re-cut v1 + stdio discovery server"_). Those re-locks are recorded as **ADR-0330** on `docs/state/decisions-and-forks.md`. This document is the amended SPEC produced from that re-lock — the Scope, Fact fixes, Forks, and Verification sections below are rewritten; the Goal, Buyer story shape, What-exists table, and Competitive positioning survive with only factual corrections.

## Goal

Make `@caisson/ui` the component kit a buyer's **coding agent** can adopt without a human reading docs: discover components, read props/variants/tokens as typed JSON, install/scaffold usage, and verify correct usage mechanically (`doctor`). WHY: caisson's differentiation is agent-era compliance infrastructure; Mintlify's data shows agents are ~45% of docs traffic, and Meta just validated "agent-ready DS" as a category with Astryx. Caisson sells a kit — the agent-facing surface is both a conversion lever (agents recommend what they can read) and a sellable feature of the commercial tiers.

## Scope (re-cut v1, 2026-07-13 amendment)

Five vertical slices, each independently shippable and independently verifiable — the FORK-LOCKS bias-upgrade to "both servers + both fronts + runtime axe" in one increment is retracted (WR-10):

1. **Component manifest** — committed to the repo, produced by caisson's own build-time generator (Fork B1, sibling of `gen-tokens-css.ts`) from the 39 `@caisson/ui` primary components: props-as-JSON from TS types, variants derived from TS prop types, token dependencies, a11y notes, RECIPE.md conventions.
2. **CLI `describe --json`** — deterministic, same data layer as the manifest. Which package/bin hosts it is Fork F, deferred to PLAN.
3. **Static doctor** — imports, version skew, token misuse, `data-*` variant validity, and the contrast-gate check (`tokens-contrast.test.ts` logic reused as a lib, not re-implemented). Deterministic, CI-safe, no renderer required.
4. **Authed MCP tools** — `list_components` / `describe_component` / `get_tokens` / `check_usage` registered into the existing entitlement-gated `packages/mcp-server` via ADR-0216 `registerTool`. Reuses auth/rate-limit/entitlement infra as-is — no new server.
5. **Local stdio-only discovery MCP** — an open, unauthenticated _local process_ (no network listener) exposing read-only discovery (`list_components` / `describe_component` / `get_tokens`) over the Apache-base manifest only. No hosted surface, no HTTP, no pro metadata reachable through it — this is the entire "open server" this spec authorizes (CR-09).

**Not v1:** runtime/a11y doctor (axe on rendered components) — a later increment, gated on the Storybook 10.5 trial outcome (Fork E). The no-browser buyer story stands for v1: jsdom cannot evaluate contrast, and no renderer is owned by this repo today.

## Fact fixes (2026-07-13 amendment)

- Component count is **39**, not the historical 38/40 estimates: one stem-matching primary export
  per component module. `LedgerRow` and `ToastRegion` remain deliberate secondary exports.
- Variants derive from **TS prop types**, not `data-*` attribute scanning alone—source-owned
  `data-*` attrs cover 27 of the 39 primaries (including conditional object-literal spreads); a
  scan-only approach would silently drop variant data for the other 12.
- Any shadcn-registry reference uses **`bunx`** (never `npx` — repo convention). GitHub registries resolve as `owner/repo/item`; `@caisson/button` requires a configured/indexed `@caisson` namespace before that install path is real (WR-04).
- `@caisson/ui` is described as **"native-first,"** never "zero-dependency" — it declares `radix-ui` and `zod` as runtime dependencies (WR-03).

## Non-goals

- Not a Storybook replacement or docs-site rewrite (Fumadocs + services/docs stay).
- Not a new registry — ADR-0097's registry service and the shadcn-registry distribution task stay separate (this surface _reads_ them, never re-implements).
- No StyleX/architecture changes to the kit itself; zero new runtime deps in `@caisson/ui`.
- Not `ui-pro` source disclosure — whatever Fork F resolves at PLAN, pro _source_ stays license-gated.
- No hosted, unauthenticated network MCP surface — the only unauthenticated tier is the local stdio discovery server (Scope item 5); this spec authorizes no new public endpoint (CR-09).
- No runtime/a11y doctor in v1 (Scope + Fork E).

## Buyer story

Two entry points, matching the D1 gating line:

- **No-credentials discovery** — any agent with just the repo checkout or a local stdio MCP config: reads the committed manifest or calls `list_components` / `describe_component` on the local stdio server → 39 components with one-liners, full props/variants/tokens JSON for any one of them; or runs `describe --json` from the CLI. No caisson account needed.
- **Authenticated verify** — a buyer's Claude/Codex session with buyer-MCP credentials: scaffolds a screen using the kit's conventions (RECIPE.md rules as machine-readable constraints), then calls `check_usage` (the static doctor) — "form-field missing `aria-describedby` wiring; token `--cs-color-x` overridden outside theme API" — typed, fixable findings, zero findings on correct usage. The agent never opens a browser — the doctor is static, no renderer needed for v1.

## What exists already (build on, don't duplicate)

- `packages/mcp-server` — auth-gated buyer MCP, `list_modules`/`describe_module`/`generate`, **extensible `registerTool` with per-tool declarative manifests (ADR-0216)**. Component-level tools register into this server directly — the v1 authed-tools slice (Scope item 4) needs no new server.
- `packages/cli` is **Apache-2.0 and exposes only the `create-caisson` bin** (the credit-metered scaffold) — not a buyer CLI today. This is the ground truth Fork F must resolve before any `caisson ui doctor` command is promised (CR-08).
- Registry schema already carries a per-module **`agents` field → AGENTS.md** ("agent-facing; distinct from README") — the prose half of the manifest exists as a convention.
- `packages/ui/manifest.ts` is a _registry_ manifest (module-level), not component-level — the component manifest (Scope item 1) is the genuinely new artifact.
- Storybook 10.5 trial (design kickoff task 10): its `componentsManifest` generates props/stories JSON from CSF — if the trial lands, it is a candidate enrichment source for the manifest (Fork B) and the renderer prerequisite for a future runtime-axe increment (Fork E).
- `services/docs` llms.txt + `/query` — discovery wiring point.

## Competitive positioning

Astryx is free but is _Meta's system_ — adopting it means adopting StyleX + Meta's tokens. Caisson's version is the same **surface contract** on a kit buyers already pay for, plus the parts Astryx doesn't sell: compliance-flavored components (audit-timeline, payload-viewer), the contrast test gate as a doctor check, and entitlement-aware tooling — the agent surface respects tiers/licenses, and (per the entitlement-negative test requirement below) proves it under test, itself a demo of caisson's auth/entitlement packages. Sellable claim: "your agent can adopt, use, and _verify_ this kit unattended."

## Rough surface sketch (post-amendment, v1)

- **Authed MCP** (registered into `packages/mcp-server`): `list_components`, `describe_component`, `get_tokens`, `check_usage` (doctor core). Any pro-tier tools/fields are declared entitlement-gated in the ADR-0216 tool manifest at registration time (see Entitlement boundary below).
- **Local stdio discovery MCP**: `list_components`, `describe_component`, `get_tokens` — same shapes as the authed tools, scoped to the 39 Apache-base primary components only, no auth, no network transport.
- **CLI**: `describe --json` — same data layer as the MCP tools. Packaging host is Fork F, resolved at PLAN.
- **Manifest generation**: build-time script in `packages/ui` (sibling of `gen-tokens-css.ts`) emitting `components-manifest.json` from TS types (props + variants) plus a `data-*` scan (coverage note only — variants are TS-type-derived per Fact fixes, `data-*` is not the source of truth); committed to the repo per Fork B1.

## Dependencies on other kickoff items

- Storybook 10.5 trial outcome (design kickoff) → Fork B enrichment, and the renderer prerequisite for a future runtime-axe increment (Fork E).
- shadcn GitHub-registry task (platform kickoff task 13) → the install-path story this surface should reference is `bunx shadcn@latest add owner/repo/item` against a configured/indexed namespace, not `npx shadcn add @caisson/button` (WR-04) — the namespace itself is that task's deliverable, not this spec's.
- DTCG tokens.json export (platform kickoff task 12) → `get_tokens` should serve the DTCG form, not a third format.

## Entitlement boundary (2026-07-13 amendment, CR-09 fix)

Every MCP tool that can return pro-tier metadata (props/variants for `ui-pro` components, if/when those register into this surface) must declare that in its ADR-0216 tool manifest at registration time — which tools may expose pro metadata is a recorded, reviewable list, not an implicit property of the endpoint. Required tests:

- The local stdio discovery server's tool set is asserted to be a strict subset of the Apache-base 39 primary components — it can never resolve a pro-tier component even if one is added to the monorepo later.
- An unentitled/unauthenticated caller against the buyer MCP's pro-tagged tools/fields is denied (entitlement error), never a silent downgrade or a partial pro-shaped response.
- A cross-tenant/cross-tier denial test for `check_usage` matching the existing entitlement-gate pattern in `packages/mcp-server`.

## Forks (LOCKED 2026-07-13 — recorded as ADR-0330)

**Fork A — Where does the surface live? LOCKED: no new hosted server.**
Authed tools register into the existing entitlement-gated `packages/mcp-server` (Scope item 4). Apache-base discovery ships as a second, **local stdio-only** MCP process (Scope item 5) — no network listener, no unauthenticated HTTP surface anywhere in this spec. This retracts the FORK-LOCKS "both servers" bias-upgrade as originally scoped (open+unauthenticated HTTP): CR-09 — an unauthenticated HTTP MCP violates `identity/security.md`, and the committed manifest + CLI `describe --json` already serve free discovery with no server at all; local stdio is the cheapest way to still hand agents a live tool-call surface for the open tier without opening a public endpoint.

**Fork B — Component-manifest data source? LOCKED: B1.**
Own build-time generator (TS-types → JSON, sibling of `gen-tokens-css.ts`). Zero new deps; output shape fully owned (can include tokens/a11y/RECIPE constraints Storybook doesn't model). Ingest/merge Storybook `componentsManifest` later only if the 10.5 trial sticks (enrichment, not replacement) — unchanged from the original recommendation.

**Fork C — CLI-first or MCP-first? LOCKED: both fronts, staged.**
Long-run architecture keeps two thin fronts (CLI + MCP) over one shared data layer, per the operator's bias upgrade. v1 concretely ships both: the committed manifest (data artifact), CLI `describe --json` (front 1), and the authed MCP tools including `check_usage` (front 2) — but the doctor logic ships once as a lib consumed by the MCP tool, not duplicated into a CLI subcommand yet (that packaging question is Fork F).

**Fork D — Open vs commercial-gated? LOCKED: D1, unchanged.**
Discovery free — served by the committed manifest plus the local stdio server, not by any hosted call. `check_usage` (doctor) and any pro-component tools stay entitlement-gated behind the buyer MCP (ADR-0094 open-core line).

**Fork E — Doctor depth (v1)? LOCKED: E1, static only.**
Static checks only for v1 — reverses the FORK-LOCKS bias-upgrade to "static + runtime a11y." Axe-on-rendered-components contradicts this SPEC's own no-browser buyer story, jsdom cannot evaluate contrast, and no renderer is owned by this repo today (Storybook is a trial, not a dependency the doctor can assume). Runtime axe is a later increment, gated on the Storybook 10.5 trial landing an owned renderer.

**Fork F — Naming/packaging of the buyer-visible command? REOPENED → PLAN decision.**
Not locked. Ground truth: `packages/cli` is Apache-2.0 and exposes only the `create-caisson` bin (the credit-metered scaffold) — it is not a buyer CLI today. "Extend `packages/cli`" (`caisson ui doctor`) was locked without checking that boundary; CR-08 requires resolving bin compatibility before promising the command. Three options carried to PLAN, none pre-selected:

- (a) keep `@caisson/cli` open as a thin authenticated client that calls the buyer-MCP doctor tools;
- (b) ship a separate commercial CLI/package for `doctor`;
- (c) ship the static doctor open (no gate) and monetize only pro manifests/runtime checks.

The `describe --json` capability in Scope item 2 is locked to exist in v1; which package/bin hosts it is part of this same PLAN decision.

## Verification (goal-backward, when built)

An agent session with **no prior caisson context**, given only the repo checkout (reads the committed manifest, runs `describe --json`) _or_ a local stdio MCP config (calls `list_components` / `describe_component` on the discovery server) — no caisson credentials required for this half — produces a working, brand-conformant screen using ≥3 kit components. A second, **authenticated** session then calls `check_usage` (the static doctor): zero findings on that usage, typed findings on a deliberately broken usage (wrong token override, missing `aria` wiring). A third, **unentitled** call against the same authed tool is denied outright (see Entitlement boundary). That three-run set — open discovery, authed verify, denied-when-unentitled — is the acceptance test AND the marketing demo.
