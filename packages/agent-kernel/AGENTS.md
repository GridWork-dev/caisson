# AGENTS — @caisson/agent-kernel

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire the agent kernel correctly.

## Invariants (do not violate)

- **Engine-neutral.** This package imports NO vendor SDK and runs NO LLM. It is the schema/FSM/hooks
  **mechanism** only. The model/engine wiring belongs to the consuming edition, never here.
- **Down-only (ADR-0022 Gate-3).** `@caisson/agent-kernel` is `kind: base`; it may be consumed by base
  (`cli`, `mcp-server`) and by the agent-dev edition, but it MUST NEVER import an edition. The agent-dev
  edition is a composition over this kernel (kernel + content + reference app), never the owner of the
  primitives.
- **`.strict()` at the boundary.** Every artifact is parsed through the Zod `.strict()` union — unknown
  fields are rejected, not dropped. Validate external/authoring input with `parseArtifact`; it throws a
  redaction-safe `ValidationError` (never the rejected values).
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

## Golden (ADR-0013)

`src/__golden__/lifecycle-trace.json` (the canonical transition trace) + `src/__golden__/agent-schema.json`
(a serialized agent/skill/rule sample). Both are deterministic — no clocks, randomness, or env. Update
only via `BLESS=1 bun test`, landing as a reviewable diff.

## Out of scope

No engine/model registry, no LLM call, no agent EXECUTION loop. This kernel is the primitive the
agent-dev edition (and base `cli`/`mcp-server`) compose; the curated agent/skill/rule content and the
reference app live in the edition.
