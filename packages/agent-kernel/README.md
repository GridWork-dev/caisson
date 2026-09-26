# @caisson-sh/agent-kernel

The engine-neutral agent kernel — the shared base layer both the base packages (`cli`, `mcp-server`)
and the **Agentic-Dev bundle** compose down-only.

Shared at the base layer because the agent/skill/rule schema, the lifecycle FSM, and the hooks
dispatcher are needed by **both** the edition AND base `cli`/`mcp-server`; a base package may never
import an edition (ADR-0022 down-only), so the shared layer sits below the edition line.

## What it gives you

- **Agent / skill / rule schema (Zod `.strict()`).** A discriminated union over `kind`
  (`agent` | `skill` | `rule`); unknown fields are rejected at the boundary, round-trips are exact.
  `parseArtifact` throws a redaction-safe `ValidationError` (reused from `@caisson-sh/kernel`).
- **Lifecycle act FSM.** The 7 acts (`spec → plan → execute → verify → sweep → eval → ship`) with the
  legal-transition adjacency only. An illegal transition **throws** (flag-never-guess) — never a silent
  skip. `runLifecycle` produces a deterministic, golden-pinnable transition trace.
- **Hooks dispatcher.** Register handlers at `${'before'|'after'}:${act}` points; `dispatch` runs them
  in registration order and awaits each. An unregistered point is a no-op (0 handlers), never a throw.
  A `commandHandler`'s `CommandHookSpec` may set an optional `env: { … }` to narrow the spawned
  process's environment; absent (the default), the child inherits the parent's full environment —
  unchanged from before this option existed. Supplied, the object is used verbatim (never merged
  with `process.env`). A default flip to always-narrow would be a separate major version.

## Entry points

- `.` — the full surface, node-capable (the hooks dispatcher's `execFile` command handler and the
  audited lifecycle's hash-chain recorder).
- `./browser` — the browser-safe subset: the artifact schema and its authoring helpers, the
  lifecycle act FSM, the governance decision algebra, and the redacting logger. Every name on
  `./browser` is also on `.`; a module joins it only once its whole value-import graph passes the
  package's static source-graph walk (`src/browser-safety.test.ts`).

## Engine-neutral (binding)

No vendor SDK import. Does NOT run an LLM. The kernel contributes the schema/FSM/hooks **mechanism**;
an edition contributes the curated agent/skill/rule **content** + a reference app + the engine wiring.

## Use

```ts
import {
  parseArtifact,
  runLifecycle,
  transition,
  HookDispatcher,
} from "@caisson-sh/agent-kernel";

const agent = parseArtifact({ kind: "agent", name: "reviewer" /* … */ });
const next = transition("plan", "execute"); // "execute"; transition("spec","execute") throws
const trace = runLifecycle([
  "spec",
  "plan",
  "execute",
  "verify",
  "sweep",
  "eval",
  "ship",
]);

const hooks = new HookDispatcher();
hooks.on("before:execute", (ctx) => {
  /* … */
});
await hooks.dispatch("before:execute", { act: "execute", phase: "before" });
```

## Tests

`bun test packages/agent-kernel/src` — the lifecycle trace matches its golden; an illegal transition
throws; the schema round-trips + rejects unknown fields. Golden fixtures live in `src/__golden__`;
update only via `BLESS=1` (ADR-0013).
