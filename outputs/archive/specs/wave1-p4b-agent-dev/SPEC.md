# SPEC — Wave 1 / P4b: Agentic-Dev edition (engine-neutral governed kernel + multi-harness emitter)

Act 1 (SPEC) of the 7-act cycle for the Wave-1 P4b agent-dev build. Bound by **ADR-0065**
(`@caisson/agent-kernel` base package), **ADR-0066** (governed engine-neutral kernel + thin
multi-harness emitter), **ADR-0067** (`@caisson/local-store` base package) — do not relitigate.
Research input: `outputs/research/wave1-forks.md` §P4b-agent-dev (26 forks, all LOCKED). Build plan:
`plan.md` §P4 (T4.3). Format reference: `outputs/specs/wave0-shared-substrate/`.

## Goal

Ship the **Agentic-Dev edition as a governed, _engine-neutral_ TS kernel plus a thin multi-harness
emitter**, so a buyer can author agents/skills/rules **once in one typed Caisson schema** and (1)
run a deterministic, policy-guarded lifecycle whose every governed step is recorded as a
**tamper-evident record** (reusing the shipped `kernel/audit-chain.ts` + `versioning.ts` compliance
substrate), (2) retrieve from a **local hybrid memory** (vec0 + FTS5 + RRF) that works fully offline,
and (3) **emit per-harness config bundles** (`.claude/` for Claude Code, `AGENTS.md` for Codex,
Cursor rules) from that one schema. The binding constraint VERIFY re-asks against: the kernel
**governs, validates, and records — it does NOT run the LLM and is NOT coupled to any single harness;
Claude Code is one emit target among several, never the substrate** (ADR-0066). The work also
extracts the two reusable primitives (agent-kernel, local-store) to **base** so `cli`/`mcp-server`
and both P4 editions consume them down-only (ADR-0065/0067), never up into an edition (ADR-0003/0022).

## Tags

`ai` (agent schema / lifecycle / memory — fires **EVAL** at SHIP) · `security` (hook-dispatcher
egress + the cloud-embed **secret-scrub** guard + emitter write-path safety — fires the **SECURITY
audit**). No `ui`/`frontend` (the reference app is a CLI; an optional Next.js inspector is deferred).
No `external-system`/`secrets`/`data-migration` — single-developer-local, no live cloud call in CI.

## Scope

**Creates (two NEW base packages):**

- **`@caisson/local-store`** (`kind: base`, paid) — raw `bun:sqlite` over `vec0` (FLOAT[N]) + FTS5,
  RRF hybrid merge (RRF_K=60, degrade to FTS5-only when the vec leg is missing/fails), a pluggable
  **Embedder port** (FTS offline floor; inference is a seam the consuming edition wires), a
  Caisson-native **egress/secret-scrub guard** before any cloud-embed, and a dedup-on-write + TTL/GC
  default. Single-developer-local scope with a tenancy seam left open (no `tenancy-rls` dep). (ADR-0067)
- **`@caisson/agent-kernel`** (`kind: base`, paid) — typed agent/skill/rule schema + `define*()`
  builders, a validator with reference-integrity (ghost-ref) checks, a **pure typed-reducer lifecycle
  FSM** (default lifecycle over a generic core), governance **transition-guard** primitives + a unified
  `HookResult = allow | deny(reason) | mutate(ctx)`, an in-process **hooks dispatcher** (lifecycle-native
  events, fail-open, per-handler isolation, no-secret-logging, pluggable sink), and an opt-in
  **audited-lifecycle** mode that records each governed step into the kernel audit-chain + versioning.
  Engine-neutral: no LLM call, no vendor SDK, no `.claude/`-specific assumption in the core. (ADR-0065/0066)

**Extends:**

- **`@caisson/agent-dev`** (`kind: edition`, `editions: ["agent-dev"]`) — the **composition**:
  the thin **multi-harness emitter** (one typed schema → `.claude/` + Codex `AGENTS.md` + Cursor) +
  curated Caisson-native agents/skills/rules content. Consumes `{agent-kernel, local-store, ai-config,
kernel}` down-only. (ADR-0066)
- **`apps/agent-dev`** — a **CLI reference app** that drives one lifecycle act end-to-end with the
  governed kernel + audited record + hybrid memory, offline (FTS fallback). Needs a documented
  ADR-0044 CLI exception (a kernel demo is not a Next.js page).

**OUT of scope:** running an LLM or any harness runtime; coupling the kernel to Claude Code; the P5
generator / registry publish / topological backfill (only manifests + goldens + down-only depcruise
entries land here); multi-tenant RLS on memory; a bundled local embedding model (port + FTS floor
only); the AGPL local-ai sibling (separate edition, separate app — boundary stays clean); any DEPLOY.

## Locked decisions implemented (ADR → code)

| ADR                                                 | Requires in code                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0065** — `@caisson/agent-kernel` base package     | The agent/skill/rule **schema + lifecycle FSM + hooks dispatcher** live in a NEW `kind: base` package, consumable by `cli`/`mcp-server` (base→base) and the agent-dev edition (edition→base); **no base→edition import** (depcruise `BASE_PKGS` + `gate.ts` down-only). Ships `LicenseRef-Caisson-Commercial`.                                                       |
| **0066** — governed engine-neutral kernel + emitter | Deterministic policy/guards + FSM whose governed steps are recorded into `audit-chain.ts` + `versioning.ts` (tamper-evident). Kernel core **MUST NOT** run the LLM, hard-import a vendor SDK, or assume one harness. A **thin emitter** renders one typed schema into `.claude/` / `AGENTS.md` / Cursor bundles — Claude Code is one emit target, not the substrate. |
| **0067** — `@caisson/local-store` base package      | All hybrid local retrieval (sqlite-vec + FTS5 + **RRF_K=60**, FTS-only degrade) lives in exactly ONE `kind: base` package both P4 editions compose down-only; embedding stays a seam the edition wires; ships `LicenseRef-Caisson-Commercial`. Rebuilt clean from the gridwork-core `memory-vec.ts` RRF **pattern** only.                                            |

## Consumed seams (down-only; a package NEVER depends up on an edition — ADR-0003/0022)

- `packages/kernel/src/audit-chain.ts` — `canonicalize` / `chainEntry` / `buildChain` / `anchorChain` /
  `verifyChain(entries, anchor)` (tamper-evident lifecycle record; the moat).
- `packages/kernel/src/versioning.ts` — `validateVersionSet` / `isCurrent` / `currentVersions` /
  `versionChain` (append-only lifecycle/version history).
- `packages/kernel/src/` — `errors.ts` (typed `CaissonError` family), `crypto.ts`
  (`safeEqualFixed`/`safeEqualVariable`), `fetch.ts` (`fetchWithTimeout`), `schema.ts`
  (`strictObject`/`parseStrict`).
- `@caisson/ai-config` — the provider-agnostic **embedder lane seam** (base→base; never reads a key,
  no network).
- `tooling/` standards gate + `.dependency-cruiser.cjs` (`BASE_PKGS`) + `eslint-config/boundaries.js`
  — the single ship gate every new package passes (manifest + golden + AGENTS.md + down-only).
- **Patterns only** (rebuild-clean, pro-private firewall holds): gridwork-core `memory-vec.ts` (RRF k=60),
  `skeleton-2`/`agents-schema` (typed-head schema SHAPE), `hooks.py`/`session-stream.ts` (dispatcher +
  pure-FS state SHAPE). **No implementation lift; no gw-prefixed content; PUBLIC `tessera` only; nothing
  from `media-pipeline`.**

## Exit gate

Done when: `bun install` clean; `bun run gate` + `bun run check` green; `bunx depcruise packages apps
tooling` 0 violations (both new base packages registered, no base→edition edge); **all golden fixtures
matched with `BLESS` unset** (schema-validation, FSM transition-sequence, RRF retrieval-ordering,
multi-harness emit); the **CLI reference app drives one lifecycle act end-to-end** and its governed
record **verifies against an anchor and a tampered step fails `verifyChain`**; **hybrid memory returns
results fully offline via the FTS5 fallback** (no embedder configured) and via RRF when embeddings
exist; the **emitter produces byte-stable `.claude/` + `AGENTS.md` + Cursor bundles from one schema**
with **no secret written into any bundle and no path escape** of the target dir; the cloud-embed path
**scrubs credential-bearing content and makes no live cloud call in CI** (test-doubled); each new
package carries a `manifest.ts` (`kind: base`, paid, placeholder `priceCents` pending the open Pricing
lock) + `__golden__` + `AGENTS.md`; PR open + CI green; no service restarted.
