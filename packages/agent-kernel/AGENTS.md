# AGENTS — @caisson-sh/agent-kernel

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire the agent kernel correctly.

## Invariants (do not violate)

- **Engine-neutral.** This package imports NO vendor SDK and runs NO LLM. It is the schema/FSM/hooks
  **mechanism** only. The model/engine wiring belongs to the consuming edition, never here.
- **Down-only (ADR-0022).** `@caisson-sh/agent-kernel` is `kind: base`; it may be consumed by base
  (`cli`, `mcp-server`) and by the Agentic-Dev bundle, but it MUST NEVER import a bundle. Agentic-Dev
  pins this kernel alongside the runner, tool-exec, memory, and AI-config primitives.
- **`.strict()` at the boundary.** Every artifact is parsed through the Zod `.strict()` union — unknown
  fields are rejected, not dropped. Validate external/authoring input with `parseArtifact`; it throws a
  redaction-safe `ValidationError` (never the rejected values).
- **Reference integrity over a set.** An artifact may depend on another BY NAME (`dependencies`).
  `validateArtifactSet(artifacts)` resolves every cross-ref against the authored set and returns the
  sorted `"<name>-><dep>"` edges; a ref naming nothing in the set is a GHOST — it THROWS a
  redaction-safe `ValidationError`, never silently drops or guesses. Author artifacts through
  `defineAgent` / `defineSkill` / `defineRule` (each validates `.strict()` at module load).
- **Two entry points.** `.` is the full node-capable surface; `./browser` is the browser-safe subset
  (schema + authoring helpers, lifecycle FSM, governance, redacting logger). A client bundle imports
  `./browser`, never `.` — the barrel reaches `node:child_process` through `hooks.ts` and
  `node:crypto` through `audit-lifecycle.ts`'s `@caisson-sh/kernel/node` edge. A module joins
  `./browser` only if its whole graph passes the package's static source-graph walk
  (`src/browser-safety.test.ts`), and every `./browser` name must also exist on `.`.
- **Flag-never-guess transitions.** The lifecycle FSM exposes only the legal-transition adjacency. An
  illegal transition THROWS — do not catch-and-continue to "guess" a next act. `verify → plan` (re-plan
  on a failed goal-backward verify) and `sweep → ship` (untagged skip-eval) are the only branch edges;
  everything else is the single canonical path.

## The lifecycle (ADR-0065)

The 7 acts: `spec → plan → execute → verify → sweep → eval → ship`. Legal edges:

| from    | to            | meaning                                             |
| ------- | ------------- | --------------------------------------------------- |
| spec    | plan          | a SPEC precedes a PLAN                              |
| plan    | execute       | no EXECUTE without a PLAN                           |
| execute | verify        | always verify the diff                              |
| verify  | sweep \| plan | pass → SWEEP; goal-backward fail → re-PLAN cycle    |
| sweep   | eval \| ship  | `ai`-tagged → EVAL; otherwise → SHIP                |
| eval    | ship          | eval pass → SHIP (a regression fail-stops; no edge) |
| ship    | —             | terminal                                            |

`runLifecycle(sequence)` validates each consecutive pair and returns the transition trace
(`{ seq, from, to }[]`). The canonical full path is golden-pinned at `src/__golden__/lifecycle-trace.json`.

## Hooks

`HookDispatcher` registers handlers at `${'before'|'after'}:${act}` points and dispatches them in
registration order, awaiting each. Handlers are side-effecting observers — they do not alter the FSM
transition. Dispatching to a point with no registered handlers is a no-op, never an error.

## Governance guards (allow / deny / mutate)

A transition **guard** is a pure predicate over one edge that returns the unified `HookResult<C>`
(`allow()` / `deny(reason)` / `mutate(context)`) — the same shape a hook veto returns. A guard is
layered ON TOP of FSM legality: `canTransition` says the edge is structurally legal, a guard says
whether policy permits it. `evaluateGuards(guards, transition)` runs a list in order: the first
`deny` short-circuits (fail-closed — remaining guards never run); a `mutate(ctx)` threads its context
into every remaining guard; a guard that THROWS is treated as `deny("guard threw")` — a buggy guard
can never silently admit a transition. `predicateGuard(predicate, reason)` lifts a plain boolean
check into a guard. `isAllow`/`isDeny`/`isMutate` narrow a `HookResult` to its variant.

## Audited lifecycle (opt-in tamper-evident record)

`AuditedLifecycle` wraps the FSM with an OPT-IN recording layer: every ADMITTED transition is
chained into the shipped kernel compliance substrate (`@caisson-sh/kernel`'s audit-chain + append-only
version lineage), so the run's transition history is tamper-**evident** — an altered, reordered,
dropped, or rewritten step fails `verifyChain` against the anchor. A VETOED transition (`deny`) is
never recorded as having happened. The host supplies any `AuditLifecycleStore`
(`InMemoryAuditLifecycleStore` ships for offline/CLI use) and an optional clock seam. With auditing
off, transitions are still FSM-validated but nothing is recorded.

## Redacting logger

`makeRedactingLogger(sink)` builds a `log(event)` function that redacts `event` through
`@caisson-sh/kernel`'s `scrubDeep` (credential-span redaction + secret/PHI-named subtree drop) before
handing one JSON Lines record to the host-supplied `sink`. This is the default redaction pass any
audit-trail event (a `LifecycleAuditPayload`, or a host-defined event shape) should run through
before it reaches a persisted sink. `toRedactedJsonlLine(event)` is the pure redact-and-serialize
step alone, for a caller that owns the write.

## Golden (ADR-0013)

`src/__golden__/lifecycle-trace.json` (the canonical transition trace) + `src/__golden__/agent-schema.json`
(a serialized agent/skill/rule sample). Both are deterministic — no clocks, randomness, or env. Update
only via `BLESS=1 bun test`, landing as a reviewable diff.

## Out of scope

No engine/model registry, no LLM call, no agent EXECUTION loop. This kernel is the primitive the
Agentic-Dev bundle (and base `cli`/`mcp-server`) composes alongside the runtime packages.
