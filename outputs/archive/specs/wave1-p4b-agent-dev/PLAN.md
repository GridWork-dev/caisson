# PLAN — Wave 1 / P4b: Agentic-Dev edition (engine-neutral)

Act 2 (PLAN) for `SPEC.md`. Atomic tasks (one task = one commit). Bound by ADR-0065/0066/0067.
**Hard rules baked into every task:** TypeScript strict; Bun (never npm/yarn); Zod `.strict()` /
`strictObject` at every boundary; no `any` / no `console.log` in product code; integer credits;
`crypto.randomUUID()` for IDs; `fetchWithTimeout` on every outbound fetch; `crypto.timingSafeEqual`
(`safeEqual*`) for every secret/token compare; fail-closed. **NO live cloud/model/network call in CI
— every embedder/harness call is test-doubled.** Pro-private firewall: gridwork-core/tessera
**patterns** only, never `media-pipeline` implementation, never gw-prefixed content. Every new package
ships through `tooling/` (one standards gate) with a `manifest.ts` + `__golden__` + down-only depcruise
entry (ADR-0020-0022). Conventional atomic commits; scopes `agent-dev` / `local-ai`(store) / `kernel` /
`tooling`. Golden-before-logic per ADR-0013: the `__golden__` fixture task PRECEDES the logic it pins.

Routing legend: **gw-typescript-pro/sonnet** = bounded (<~300 LOC) scoped impl; **opus main-thread** =
context-bearing / cross-package design; **haiku** = recon/docs/content. Every dispatch
`run_in_background: true`; parallel writers use isolated worktrees.

---

## A. Scaffolds + boundary-gate registration (blocks all)

**T1 — Scaffold `@caisson/local-store` (base).** Creates `packages/local-store/{package.json,
tsconfig.json,manifest.ts,AGENTS.md,src/index.ts,src/__golden__/.gitkeep}`. `manifest.ts` =
`defineModule({ id:"@caisson/local-store", kind:"base", tier:"paid", priceCents:4900 /*placeholder, Pricing open*/, license:"LicenseRef-Caisson-Commercial", dependencies:["@caisson/kernel","@caisson/ai-config"], golden:"src/__golden__" })`; package.json `private:true`, `type:module`, agrees with manifest. VERIFY: `bun install && bun run gate`. Routing: **gw-typescript-pro/sonnet**.

**T2 — Scaffold `@caisson/agent-kernel` (base).** Mirror of T1 at `packages/agent-kernel/`; manifest `dependencies:["@caisson/kernel"]` (+ `@caisson/ai-config` for the model-lane seam), `kind:"base"`, paid, placeholder `priceCents`, `golden:"src/__golden__"`. VERIFY: `bun install && bun run gate`. Routing: **gw-typescript-pro/sonnet**.

**T3 — Register both new base packages in the boundary gate.** Edits `.dependency-cruiser.cjs`
(add `agent-kernel|local-store` to the `BASE_PKGS` regex so `down-only-no-base-to-edition` covers them) + `tooling/eslint-config/boundaries.js` (base import list); confirm `tooling/standards-gate` (`gate.ts`/`checks.ts`) derives base-vs-edition from `manifest.kind` (no hardcoded list to edit) and that `agent-dev` is already in `EDITIONS`. VERIFY: `bunx depcruise packages apps tooling --config .dependency-cruiser.cjs` (0 violations) + `bun run gate`. Routing: **opus main-thread** (shared cross-package tooling).

---

## B. `@caisson/local-store` track (parallel to track C after T3; isolated worktree)

**T4 — Embedder port + memory schema types.** `packages/local-store/src/{embedder.ts,schema.ts}` —
the pluggable `Embedder` port interface (engine-neutral; FTS-only when none configured), the
memory-item Zod `strictObject` schema, single-developer-local scope with a documented tenancy seam
(no `tenancy-rls` dep). VERIFY: `bun test ./packages/local-store && bun run check`. Routing: **gw-typescript-pro/sonnet**.

**T5 — GOLDEN: RRF retrieval-ordering fixture.** `packages/local-store/src/__golden__/rrf-order.json`
— a deterministic vec-rank × FTS-rank input → fused-order output (RRF_K=60), authored before the
merge logic (ADR-0013). VERIFY: `BLESS=1 bun test ./packages/local-store` then `bun test` clean. Routing: **gw-typescript-pro/sonnet**.

**T6 — vec0 + FTS5 + RRF hybrid store.** `packages/local-store/src/store.ts` — raw `bun:sqlite`
over `vec0` (FLOAT[N], dim fixed at table creation) + FTS5; `hybridSearch` with RRF_K=60 merge that
**degrades to FTS5-only** when the vec leg is missing/fails. Rebuilt clean from the `memory-vec.ts`
RRF pattern. VERIFY: `bun test ./packages/local-store` (matches T5 golden, BLESS unset). **Depends on T5.** Routing: **gw-typescript-pro/sonnet**.

**T7 — GOLDEN: egress secret-scrub fixture.** `packages/local-store/src/__golden__/scrub.json` —
credential-bearing input → scrubbed output the guard must produce, before the guard logic. VERIFY:
`BLESS=1 bun test ./packages/local-store` then clean. Routing: **gw-typescript-pro/sonnet**.

**T8 — Egress / secret-scrub guard (SECURITY).** `packages/local-store/src/egress-guard.ts` —
`looksLikeSecret`-style scrub of credential-bearing content **before any cloud-embed**, never logs
secrets, `fetchWithTimeout` on the embed fetch; the embedder is a seam, **test-doubled, no live CI
call**. VERIFY: `bun test ./packages/local-store` (matches T7 golden) + grep proves no `console.log`.
**Depends on T7.** **Threats to model:** PII/credential content egressing to a cloud embedder; a secret
landing in logs or a telemetry sink; a live cloud call sneaking into CI. Routing: **gw-typescript-pro/sonnet**.

**T9 — GC/decay/dedup default + finalize manifest/AGENTS.md.** `packages/local-store/src/gc.ts`
(dedup-on-write + TTL/GC, buyer-config) + final `AGENTS.md` contract + `index.ts` exports. VERIFY:
`bun test ./packages/local-store && bun run gate` (package fully green through the standards gate).
**Depends on T6, T8.** Routing: **gw-typescript-pro/sonnet**.

---

## C. `@caisson/agent-kernel` track (parallel to track B after T3; isolated worktree)

**T10 — Typed agent/skill/rule schema + `define*()` builders.** `packages/agent-kernel/src/schema.ts`
— Caisson-native field set (name/description/model-lane/tools/capabilities/dependencies/status) via
`strictObject`; `defineAgent`/`defineSkill`/`defineRule` builders; `model-lane` references the
`@caisson/ai-config` lanes (seam). Harvest skeleton-2 SHAPE only — no gw-prefixed content. VERIFY:
`bun test ./packages/agent-kernel && bun run check`. Routing: **gw-typescript-pro/sonnet**.

**T11 — GOLDEN: schema-validation fixture.** `packages/agent-kernel/src/__golden__/schema.json` —
valid + invalid artifact inputs → parse/error outputs, before the validator. VERIFY: `BLESS=1` then clean. Routing: **gw-typescript-pro/sonnet**.

**T12 — Validator + reference-integrity (ghost-ref) guard.** `packages/agent-kernel/src/validate.ts`
— resolves an artifact's cross-refs (dependencies/skill refs) against the authored set at validate
time, reusing the mcp-server registry-allowlist pattern where refs name modules; throws (never
guesses) on a dangling ref. VERIFY: `bun test ./packages/agent-kernel` (matches T11 golden). **Depends on T11.** Routing: **gw-typescript-pro/sonnet**.

**T13 — GOLDEN: FSM transition-sequence fixture.** `packages/agent-kernel/src/__golden__/fsm.json`
— a start state + event sequence → the deterministic state/transition trace, before the reducer.
VERIFY: `BLESS=1` then clean. Routing: **gw-typescript-pro/sonnet**.

**T14 — Lifecycle FSM (pure typed reducer).** `packages/agent-kernel/src/fsm.ts` — a hand-rolled
pure typed reducer (zero-dep, matching kernel's deterministic-primitive idiom) + a small **default
lifecycle** over a generic FSM core the buyer can override (act enum SHAPE from `session-stream.ts`,
not gw skill mapping). VERIFY: `bun test ./packages/agent-kernel` (matches T13 golden). **Depends on T13.** Routing: **gw-typescript-pro/sonnet**.

**T15 — Governance guards + unified `HookResult`.** `packages/agent-kernel/src/governance.ts` —
a transition-**guard** primitive (pure predicate per transition) + a typed
`HookResult = allow | deny(reason) | mutate(ctx)` shared by guards and hook veto, so governance has
ONE shape. VERIFY: `bun test ./packages/agent-kernel`. **Depends on T14.** Routing: **gw-typescript-pro/sonnet**.

**T16 — Hooks dispatcher (security-adjacent).** `packages/agent-kernel/src/hooks.ts` — an in-process
TS dispatcher over lifecycle-native events (act-enter/exit/guard/tool-pre/tool-post); **fail-open by
default** (a down sink never blocks the loop), **per-handler exception isolation**, **no secret
logging**, **pluggable sink** interface (drop the seed's tg-bridge/postgres coupling). TS handlers are
first-class; if shell-command hooks are ever admitted they MUST use `execFile` arg-arrays (no
interpolation, no secret in argv). VERIFY: `bun test ./packages/agent-kernel`. **Depends on T14.**
**Threats to model:** a handler logging secrets; a down telemetry sink blocking the buyer's loop;
shell-injection via a `command` hook; one handler's exception bleeding into the loop. Routing: **gw-typescript-pro/sonnet**.

**T17 — Audited-lifecycle persistence (the moat).** `packages/agent-kernel/src/audit-lifecycle.ts`
— an opt-in mode that records each governed FSM transition into the kernel **audit-chain**
(`chainEntry`/`anchorChain`/`verifyChain`) + **versioning** (append-only `supersedes_id`); a pure
engine where the host supplies the store, with the audited mode as the tamper-evident upgrade.
VERIFY: `bun test ./packages/agent-kernel` — a tampered transition **fails `verifyChain`** against the
anchor; `bun run gate` (package fully green). **Depends on T15, T16; reuses `packages/kernel/src/{audit-chain,versioning}.ts`.** Routing: **opus main-thread** (cross-package, governance-bearing).

---

## D. `@caisson/agent-dev` edition — emitter + composition (depends on B + C)

**T18 — GOLDEN: multi-harness emit fixture.** `packages/agent-dev/src/__golden__/emit/` — one typed
schema input → byte-stable expected `.claude/` (agents/skills/rules + hooks), Codex `AGENTS.md`, and
Cursor-rules outputs, before the emitter logic (ADR-0013). VERIFY: `BLESS=1 bun test ./packages/agent-dev` then clean. **Depends on T10.** Routing: **gw-typescript-pro/sonnet**.

**T19 — Multi-harness emitter (ENGINE-NEUTRAL; security-adjacent).**
`packages/agent-dev/src/emitter.ts` — renders one `agent-kernel` schema into per-harness bundles
(`.claude/`, Codex `AGENTS.md`, Cursor). **Binding:** Claude Code is one target among several — no
harness becomes the substrate. Path-safe writes (reject `..`/absolute/null-byte targets;
`path.resolve` + assert under the target root); **no secret written into any emitted bundle**. VERIFY:
`bun test ./packages/agent-dev` (matches T18 golden, byte-stable). **Depends on T18.** **Threats to
model:** path traversal escaping the emit target dir; a credential leaking into an emitted
`.claude/`/`AGENTS.md`/Cursor file. Routing: **gw-typescript-pro/sonnet**.

**T20 — Curated Caisson-native agents/skills/rules content.** `packages/agent-dev/src/content/` — a
minimal, rebuild-clean default set authored against the T10 schema (NO gw-prefixed lift, NO
`capabilities.toml` paste). VERIFY: `bun test ./packages/agent-dev` (content parses + validates).
**Depends on T10, T12.** Routing: **haiku** (content authoring against a locked schema).

**T21 — Edition composition + manifest finalize.** `packages/agent-dev/{manifest.ts,src/index.ts}`
— `kind:"edition"`, `editions:["agent-dev"]`, `dependencies:["@caisson/agent-kernel","@caisson/local-store","@caisson/ai-config","@caisson/kernel"]`, `golden` dir; wire the edition to compose the
governed kernel + hybrid memory + emitter. VERIFY: `bun run gate` + `bunx depcruise packages apps
tooling` (edition→base only, 0 violations). **Depends on T9, T17, T19, T20.** Routing: **opus main-thread** (cross-package dep graph).

---

## E. Reference app + goal-backward exit

**T22 — `apps/agent-dev` CLI reference app.** `apps/agent-dev/src/` — a CLI that drives **one
lifecycle act end-to-end** with the governed kernel (audited record on) + hybrid memory retrieval +
an emit, running offline (FTS fallback when no embedder). Document the **ADR-0044 CLI exception** (a
kernel demo is not a Next.js page; an optional Next inspector is deferred). VERIFY: `bun test
./apps/agent-dev && bun run check`. **Depends on T21.** Routing: **gw-typescript-pro/sonnet**.

**T23 — Integration + goal-backward exit test.** `apps/agent-dev/test/exit.test.ts` — proves the
SPEC goal: kernel drives one act with a **tamper-evident** record (anchor verifies, tampered step
fails `verifyChain`); hybrid memory returns results **offline via FTS5 fallback** and via RRF when
embeddings exist; the emitter produces all **three** byte-stable harness bundles with no secret and no
path escape. Whole-surface `bun run gate` + `bun run check` + `bunx depcruise …` green; all goldens
matched **BLESS unset**. **Depends on T22.** Routing: **opus main-thread** (goal-backward VERIFY input).

---

## Dependency notes

- **Blocking front:** T1, T2 (independent, parallel) → T3 (shared boundary-gate config) gates every
  later package from passing the gate as base.
- **Parallel tracks (isolated worktrees) after T3:** Track **B** (local-store, T4-T9) and Track **C**
  (agent-kernel, T10-T17) write disjoint packages and run concurrently. Each writer in its own worktree.
- **Golden-before-logic (ADR-0013):** T5→T6, T7→T8, T11→T12, T13→T14, T18→T19. The fixture commit
  always precedes the logic commit it pins.
- **Convergence / critical-path dependency:** the edition composition (**T21**) cannot start until
  **both** base packages are green — agent-kernel's audited-lifecycle moat (**T17**) **and**
  local-store's hybrid memory (**T9**) — **and** the emitter (**T19**). T17 (opus, reuses the kernel
  audit-chain seams) is the longest single chain (T2→T3→T10→T13→T14→T15→T17→T21→T22→T23) and is the
  critical path; T9 and T19 must land before T21 or the edition can't compose.
- **Exit:** T22 → T23 run last, on the main thread, after the convergence.

## Threats to model (SHIP `security` audit targets)

- **T8 (local-store egress):** credential/PII content must be scrubbed before any cloud-embed; no
  secret logged or sent to a sink; `fetchWithTimeout` on the embed call; embedder test-doubled — **no
  live cloud call in CI**.
- **T16 (hooks dispatcher):** fail-open so a down sink never blocks the loop; per-handler exception
  isolation; no secret logging; any shell-command hook routes through `execFile` arg-arrays (no
  string interpolation, no secret in argv).
- **T19 (emitter):** path-traversal safety on the emit target (reject `..`/absolute/null-byte;
  `path.resolve` + assert under the root); no secret written into any emitted config bundle.
