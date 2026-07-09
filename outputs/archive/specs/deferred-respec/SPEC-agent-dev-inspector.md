# SPEC — Agentic-Dev local inspector (read-only, localhost)

**Status: DRAFT — operator lock required. Does NOT authorize building.** Two operator
forks are live (Fork A framework, Fork B memory-listing) and one carries an
ADR-0044 interaction that must be resolved at lock (see Design). There is **no forcing
trigger yet**; the standing recommendation is **keep deferred** until (a) a design-partner
/ buyer asks to _see_ their local runs, or (b) the operator promotes Agentic-Dev off the
labeled-roadmap site posture toward GA and wants a demoable dev tool. This draft exists so
that, when a trigger fires, the build is lock-and-go rather than a fresh research round.

- **Surface:** `apps/agent-dev` (the Agentic-Dev edition's reference app; `bin:
caisson-agent-dev`) — one new sibling entrypoint next to `demo.ts` / `runner-demo.ts` /
  `index.ts`, plus one small additive read method on the base package `@caisson/local-store`.
  The concrete file (`inspector.ts` route script vs a Next route group) is selected at
  Fork A lock.
- **Type:** NEW read-only local-dev tool over the three seams the edition _already
  produces_ — agent-runner run transcripts, the governed-lifecycle audit chain, hybrid
  memory. No new capability in the packages; no fabricated columns.
- **Tags:** `security` (reads per-tenant memory stores through the ADR-0073 fail-closed
  `tenantDbPath` boundary and binds a local HTTP listener — the boundary + the
  `127.0.0.1`-only bind want a SHIP audit); `observability` (classification — a read-only
  runs/audit/memory view).

## Goal (WHAT + WHY)

The Agentic-Dev edition ships without any way to _look at_ what its own machinery
produced. A buyer running the edition locally accumulates three durable stores — agent-runner
run transcripts, the governed-lifecycle audit chain, and hybrid memory — and today the only
way to read any of it is to write bespoke code against each package. This SPEC defines a
**minimal, read-only, localhost-only inspector**: one small web surface over the three seams
the edition _actually produces_, so a buyer can see runs, per-run tool-call counts, the
lifecycle audit chain (with tamper-evidence), and recent memory docs — nothing fabricated,
nothing hosted. It reads existing stores only; it never wires a new package into the edition.

## Scope

**In:** three read-only routes rendering server-side HTML — `GET /` (runs table), `GET
/audit` (lifecycle chain + tamper badge), `GET /memory` (paged memory docs); one small
additive read method on `@caisson/local-store` for the memory list (Fork B); a `127.0.0.1`
bind; boot + tenant-traversal + tamper-badge tests. Localhost only, launched by the buyer on
their own machine.

**Out (each backed by a fact in Design):**

- **No guardrail-verdict view.** `packages/guardrails` is not a dependency of
  `@caisson/agent-dev` or `@caisson/agent-runner` and produces zero verdicts in this edition
  today — the inspector must not render a column for data that does not exist. Wiring
  guardrails into the edition is a separate ADR-worthy change.
- **No spend / cost view.** `packages/ai-meter` is likewise unwired; agent-runner's own
  `AGENTS.md:44-46` names `@caisson/ai-meter` wiring as **explicitly deferred**. No spend
  data exists to show.
- **No tool-exec history view.** `packages/tool-exec/src/tool-exec.ts` returns `ExecResult`
  in-process and **never persists it**. The only durable tool-call signal is the transcript's
  `tool_use` events (tool _name_ only — no argv, no exit code). Adding persistence to
  `@caisson/tool-exec` is out of the "read-only over existing stores" scope.
- **Not a hosted service.** Bound to `127.0.0.1`, no `next build` deploy artifact, no auth
  layer (localhost trust boundary — see Design). Never a Railway/CF surface.
- **No writes.** The inspector never mutates a run, an audit chain, or a memory store.

## Design

**What the edition composes (current state, cited).** `packages/agent-dev/src/index.ts`:
`createAgentDevEdition({ store, audited?, memoryDim, tenant?, memoryPath?, artifacts?,
toolExec?, now? })` composes (down-only, ADR-0003) `@caisson/agent-kernel` +
`@caisson/local-store` + `@caisson/tool-exec` + `./emitter.ts` + `./content/index.ts`,
re-exporting `@caisson/ai-config` embedder types and `@caisson/kernel` audit-chain
primitives. `packages/agent-dev/package.json` deps: `agent-kernel, agent-runner, ai-config,
kernel, local-store, tool-exec` — **no** `next`, **no** `guardrails`, **no** `ai-meter`.

**Seam 1 — runs + tool-call counts.** `packages/agent-runner/src/agent-runner.ts`:
`createAgentRunner({ runsRoot })` exposes `.spawn/.tail/.status/.kill/.list/.finalReport`
over a directory of `<runId>.jsonl` (stream-json transcript) + `<runId>.meta.json` (`RunMeta`:
runId/pid/jsonlPath/worktree/task/binary/model/startedAt/status/endedAt).
`summarize(events)` parses `assistant`/`result` events into `{ totalLines, toolCalls,
filesTouched, lastText }`; the `tool_use` / `EDIT_TOOLS` extraction is at
`agent-runner.ts:262-306`. `.list()` gives a directory-wide run listing — the natural data
source for a runs table. The runner is a dependency of `apps/agent-dev` (wired in
`apps/agent-dev/src/runner-demo.ts` as `runAgentRunnerDemo`) but is **not** re-exported by
`@caisson/agent-dev`, so the inspector reaches `@caisson/agent-runner` directly, exactly as
`runner-demo.ts` does.

**Seam 2 — governed lifecycle / audit chain.**
`packages/agent-kernel/src/audit-lifecycle.ts`: `AuditedLifecycle.record()/.snapshot()/
.verify()` over `AuditLifecycleSnapshot { entries: AuditChainEntry[], versions:
VersionRecord[], anchor: AuditChainAnchor | null }`. Each `LifecycleAuditPayload` is `{ from:
Act, to: Act, decision: "allow"|"mutate", at: ISO }` — deliberately **secret-free** (no
context/reason recorded). `.verify()` against the `anchor` is the tamper indicator. This is
per-lifecycle-_step_ (SPEC/PLAN/EXECUTE… acts), not per-agent-run.

**Seam 3 — memory.** `packages/local-store/src/store.ts`: `LocalStore.open({ dim, path })`
(vec0 + FTS5 + RRF, `RRF_K=60`), `.upsert(doc)`, `.hybridSearch({ queryText, queryVector?,
limit? }) → SearchHit[]{ id, score }`. **There is no listing API** — only targeted hybrid
search. The schema (`docs(rowid, doc_id, text)` + `docs_fts` + `docs_vec`) is at
`store.ts:86-91`. Tenant isolation: `packages/local-store/src/tenant-db.ts`
`tenantDbPath(root, tenantId)` — file-per-tenant, fail-closed path validation (ADR-0073).

**Routes.** Three read-only handlers, each rendering server-side HTML (no client framework):
`GET /` → `createAgentRunner({ runsRoot }).list()` + per-row `.status()/.finalReport()` →
`summarize()` fields; tool calls shown as **count + names only**, and the "no argv/exit-code"
limit is surfaced in the UI, not papered over. `GET /audit` →
`AuditedLifecycle.snapshot()` (the inspector accepts the same `store: AuditLifecycleStore`
the host holds, the way `createAgentDevEdition` accepts `audited`) → the `entries` chain +
a **verify badge** from `.verify()` against `snapshot.anchor`. `GET /memory` → a bounded,
paged list of memory docs via the Fork-B read method; when a `tenant` is supplied, the store
path resolves **only** through `tenantDbPath(root, tenantId)`, never a raw filesystem path
from a query param — preserving the ADR-0073 fail-closed boundary. **These handlers are
framework-independent** — the same logic runs under either Fork-A shell.

**Localhost trust model.** No auth. The bind is `127.0.0.1` and the SPEC forbids any other
bind; the SHIP security audit confirms the bind constant and the `tenantDbPath` resolution
are the only two things standing between a query param and a cross-tenant read.

### Fork A — framework / delivery shape (operator picks; ADR-0044 interaction — do NOT pre-bind)

**ADR-0044 governs this fork.** ADR-0044 (Binding) locks: "Edition reference apps scaffold
on Next.js App Router … moving a single edition off Next.js requires a superseding ADR," and
its Scope covers "first-party reference apps **+ web surfaces**." A three-route
HTML-serving inspector _is_ an edition web surface — it is exactly the "eventual web surface"
that `apps/agent-dev/README.md:22-30` and `src/index.ts:6-9` pre-committed as an "optional
**Next.js** inspector," worded that way to stay ADR-0044-compliant. So the framework fork is
**not framework-neutral**: one option is the locked standard, the other is a deviation the
lock explicitly requires a superseding ADR to authorize.

- **A2 — Next.js route group. ADR-0044-COMPLIANT; no superseding ADR needed.** Scaffolds on
  the repo's locked edition-app standard. _Cost:_ adds `next` as this edition's **first-ever**
  framework dependency, purely for a deferred, non-sellable localhost dev tool, and there is
  no existing buyer template app to host the route group (`packages/cli/templates/agent-dev/`
  contains only `src/__golden__/agent-run.json`; the one Next surface in the repo,
  `apps/admin`, is the CF-Access-gated operator control-plane — a different trust domain, not
  a buyer-local template).
- **A1 — Bun.serve localhost script.** Zero new dependency, matches the plain Bun/tsc CLI
  shape `apps/agent-dev` already is. **Deviation cost: this is a new non-Next edition web
  surface, so ADR-0044 §Binding REQUIRES a superseding ADR** (a narrow one — localhost-only,
  read-only, dev-tool scope) filed at lock. Note: `apps/base` also serves over Bun.serve, but
  its own `package.json:6` description ("App framework per edition is deferred") is the
  pre-ADR-0044 fork language — it is **stale pre-lock debt never migrated**, not a sanctioned
  current exception, so it does **not** authorize a new non-Next surface.
- **Recommendation:** for a non-sellable, read-only localhost tool, A1 (Bun.serve) is the
  lighter engineering choice, and the superseding ADR it costs is the _narrow, explicitly
  anticipated_ mechanism ADR-0044 provides for exactly this. Choose A2 only if the operator
  intends to promote the inspector into buyer-shipped tooling on the Next standard, in which
  case the `next` dependency is bought deliberately and no ADR is spent. **Confidence:
  medium** (the ADR-0044 interaction raises A1's cost above a pure zero-dep read).

### Fork B — memory listing access (operator picks; do NOT pre-bind)

`LocalStore` has no listing API, so the `/memory` route needs one.

- **B1 (recommended) — add `LocalStore.list({ limit, offset })`** to `store.ts` (`SELECT
doc_id, text FROM docs ORDER BY rowid DESC LIMIT ? OFFSET ?`, clamp `limit`). Small,
  additive, keeps the SQL inside the package that owns the schema. `@caisson/local-store` is
  an Apache-2.0 base package, so it ships through the standards gate + a changeset. _Cost:_ a
  tiny API-surface addition to a base package other editions also consume.
- **B2 — inspector issues a direct `SELECT` against the `docs` table.** _Cost:_ couples the
  app to `store.ts:86-91`'s internal schema; breaks silently on schema drift. More coupled,
  less safe.
- **Recommendation: B1. Confidence: high.**

### ADR interactions

- **ADR-0044 (edition app/web-surface framework = Next.js) — governs Fork A; A1 requires a
  superseding ADR, A2 is compliant.** See Fork A above. The lock, the README's
  pre-committed "optional Next.js inspector" framing, and the `apps/base` stale-debt caveat
  are all reconciled there.
- **ADR-0186 (agent-runner sandboxed + governed) — realizes (read-only consumer).** The
  inspector consumes `.list()/.status()/.finalReport()` and the `<runId>.jsonl` /
  `<runId>.meta.json` layout exactly as `runner-demo.ts` does. No runner change; no supersede.
- **ADR-0199 (agent-dev tool-exec wired) — boundary acknowledgment (no change).** 0199's
  `ExecResult` is in-process/ephemeral, so the inspector _cannot_ show a tool-exec history
  without a persistence change 0199 does not provide; it reads the transcript's `tool_use`
  names instead. Nothing extended or superseded.
- **ADR-0073 (local tenancy DB, file-per-tenant) — realizes / must respect.** The `/memory`
  route resolves tenant stores only through `tenantDbPath()` fail-closed validation; the SPEC
  strengthens, never relaxes, this boundary (tested in Tasks). No supersede.
- **ADR-0082 (go-live site posture, §4 "Agentic-Dev — the one honest exception") —
  references, does NOT supersede.** §4 locks _site marketing copy_ (Agentic-Dev stays a
  labeled-roadmap edition), **not** the inspector's technical deferral — that deferral lives
  in `apps/agent-dev/README.md:27-30`, `src/index.ts:6-9`, and
  `outputs/specs/wave1-p4b-agent-dev/PLAN.md:147`. A localhost dev tool changes no site copy,
  so 0082 is untouched. Two backlog lines mis-cite "0082 §4" as the deferral record — Task 6
  corrects them.

## Tasks (atomic — Fork-conditioned; the branch is fixed at operator lock, not here)

1. **Memory listing (Fork B).** _If B1:_ add `LocalStore.list({ limit, offset })` to
   `packages/local-store/src/store.ts` + a round-trip test (upsert N, list, assert
   DESC order + bound). _If B2:_ no store change; the `/memory` handler issues the direct
   `SELECT`. Verify: `bun test packages/local-store/src/store.test.ts` (B1) or the
   inspector test (B2).
2. **Inspector server (framework shell = Fork A; handlers identical either way).** The three
   read-only route handlers over `createAgentRunner(...).list()/.status()/.finalReport()`,
   `AuditedLifecycle.snapshot()`, and the Fork-B memory list, **bound to `127.0.0.1`**. _If
   A1:_ a `Bun.serve` entrypoint `apps/agent-dev/src/inspector.ts`, argv `[runsRoot]
[memoryRoot]`. _If A2:_ a Next App-Router route group in the edition app. Add a smoke test
   that boots on an ephemeral port over a temp `runsRoot`/`memoryRoot` fixture and asserts all
   three routes return `200` with the expected shape. Verify: `bun test
apps/agent-dev/src/inspector.test.ts`.
3. **Tenant-path safety test.** Assert `/memory?tenant=...` resolves **only** via
   `tenantDbPath()` and that a traversal id (`../../etc`) is rejected fail-closed (never opens
   a store outside `memoryRoot`). Verify: `bun test apps/agent-dev/src/inspector.test.ts`
   (traversal-rejection case).
4. **Audit tamper-evidence surface.** `/audit` renders the `.verify()` badge; a test flips it
   to fail on a tampered snapshot. Verify: `bun test apps/agent-dev/src/inspector.test.ts`
   (verify-badge case).
5. **Docs flip.** Update `apps/agent-dev/README.md:27-30` and the `src/index.ts:6-9` module
   header from "deferred" to "shipped (local-dev only)"; document the launch command + the
   localhost-only / read-only scope. _If A1 was chosen,_ update the README ADR-0044 note to
   cite the new superseding ADR. Verify: `grep -n inspector apps/agent-dev/README.md && bun
run check`.
6. **Correct the mis-attributed backlog refs.** Point `docs/state/readiness-and-backlog.md:367`
   and `outputs/specs/stream-c-edition-hardening/SWEEP.md:39` at this SPEC's realized
   inspector rather than "ADR-0082 §4" (that ADR governs _site copy_, not the inspector's
   technical deferral). Verify: `grep -n inspector docs/state/readiness-and-backlog.md`.
7. **Lock ADR + changeset.** File one ADR (next free number — ADR ceiling is currently
   **0217**, so **0218**) recording the chosen Fork A + Fork B and the localhost-only /
   read-only scope. **If A1 (Bun.serve) was chosen, this ADR IS the ADR-0044-superseding ADR**
   — it must cite ADR-0044 and record the narrow non-Next edition-web-surface deviation; if A2
   (Next.js) was chosen, no supersession is needed and the ADR just records the decision. If
   Fork B = B1, add a changeset naming `@caisson/local-store` (patch) for the `list()` addition
   (`apps/*` are gate-exempt; the base package is not). Verify: `bunx changeset status
--since=origin/main`.

## Verify (goal-backward)

Re-ask the Goal: _can a buyer see the runs / lifecycle audit / memory the edition actually
produced, read-only, on localhost, with no fabricated columns and no ADR left un-reconciled?_

- The inspector binds `127.0.0.1` only (no `0.0.0.0`, no hosted artifact) and serves the
  three routes.
- `/` lists every run from `agent-runner.list()` with per-run tool-call **count + names**,
  and the UI states the "names only, no argv/exit-code" limit rather than hiding it.
- `/audit` renders the lifecycle chain and a `.verify()` badge that flips red on a tampered
  snapshot.
- `/memory` pages docs via the Fork-B access path, and a `tenant`-scoped read resolves
  through `tenantDbPath()` — a traversal id is rejected, never opening a store outside
  `memoryRoot` (ADR-0073 boundary intact).
- **No guardrail column, no spend column, no tool-exec-history column** anywhere — the edition
  produces none of them.
- **ADR-0044 reconciled:** the lock ADR (Task 7) records the framework decision — and _if
  Fork A = A1_, it explicitly supersedes ADR-0044 for this one narrow surface; _if A2_,
  `grep -rn "next" apps/agent-dev/package.json` shows the deliberately-added dep and no
  supersession is claimed. `bun run check` green; changeset present if Fork B = B1.

## Effort: S–M (~0.5–1 day incl. tests — one route file + one additive store method + 3 tests; +1 short ADR if A1). Value: LOW — a non-sellable localhost dev tool, currently un-triggered; **keep-deferred is the honest default** until a buyer asks or GA promotion fires.
