# AGENTS — @caisson-sh/agent-dev

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
consumer must know to wire the Agentic-Dev **edition** correctly.

## What this is

`@caisson-sh/agent-dev` is `kind: edition` — a **composition**, never a primitive. It binds three shipped
base seams into ONE import so an app authors agents/skills/rules **once in one typed
Caisson schema** and gets a governed lifecycle, local hybrid memory, and per-harness config emit:

- **Governed engine-neutral kernel** — `@caisson-sh/agent-kernel`: the agent/skill/rule schema +
  `define*()` builders, the reference-integrity validator, the pure lifecycle FSM, governance guards +
  the unified `HookResult`, the hooks dispatcher, and the opt-in **audited lifecycle** (the
  tamper-evident moat that records each governed step into the kernel audit-chain + versioning).
- **Local hybrid memory** — `@caisson-sh/local-store`: vec0 + FTS5 + RRF (RRF_K=60) with the **FTS-only
  offline floor**, the pluggable Embedder port, the cloud-egress secret-scrub guard, and the
  dedup/TTL/GC retention default.
- **Thin multi-harness emitter** — `./emitter.ts`: renders one schema into `.claude/` (Claude Code),
  `AGENTS.md` (Codex), and Cursor rules.
- **Governed sandboxed tool-exec gate** — `@caisson-sh/tool-exec`: a default-deny allowlist + execFile
  arg-arrays (never a shell), wired live on the composed edition so an app gets the exec gate from
  this one import home.

## Invariants (do not violate)

- **Edition, down-only (ADR-0003/0022).** This edition imports base packages
  (`@caisson-sh/{agent-kernel,local-store,ai-config,kernel}`) — it MUST NEVER import another edition, and
  no base package may import it. The composition owns no primitive; it wires the ones the base ships.
- **No harness is the substrate (ADR-0066).** Claude Code is ONE emit target among several. The same
  schema fans out to every harness shape; nothing in the kernel assumes `.claude/`.
- **Engine-neutral.** The composition holds NO credential and makes NO LLM/network call. The embedder
  is a seam (`@caisson-sh/ai-config` lane); with none wired, memory degrades to the FTS-only floor. The
  live embed transport stays the one un-exercised path — **no live cloud call in CI**.
- **Fail-closed at the write edge.** `emit` validates every file BEFORE any disk write: a path that is
  absolute, null-byte-bearing, or `..`-escaping the target root is REFUSED, and a credential-shaped
  string aborts the whole emit (nothing written). The refusal carries the path + a detector label
  only, never the matched secret span.
- **`.strict()` at the boundary.** Artifacts parse through the agent-kernel `.strict()` union; the
  curated set is reference-checked by `validateArtifactSet` — a ghost cross-ref THROWS at compose time,
  never reaching the lifecycle or the emitter.

## Compose

`createAgentDevEdition({ store, audited?, memoryDim, tenant?, memoryPath?, artifacts?, toolExec?, now? })`
wires the governed lifecycle (over a host-supplied `AuditLifecycleStore`; `audited: true` turns on the
tamper-evident record), opens the local hybrid memory, binds the emitter, and constructs the tool-exec
gate (`toolExec` configures its allowlist; omit for a fail-closed default-deny gate). It returns
`{ lifecycle, memory, toolExec, artifacts, render(hooks?), emit(targetRoot, hooks?), close() }`.
`artifacts` defaults to the curated `CAISSON_DEFAULT_ARTIFACTS`; `render` is pure and `emit` is the
guarded write.

**Multi-tenant hosts MUST pass `tenant: { root, tenantId }`** — the edition then opens memory at the
ADR-0073 file-per-tenant path (`tenantDbPath(root, tenantId)`), the resolved path IS the isolation
boundary, and a malformed id is refused fail-closed before any file opens. `tenant` and `memoryPath`
are mutually exclusive (both ⇒ throws); `memoryPath` alone is the single-tenant/explicit-path escape,
and omitting both opens an in-memory store (tests / ephemeral).

## Golden (ADR-0013)

`src/__golden__/emit/` — the byte-stable multi-harness bundle (`.claude/` + Codex `AGENTS.md` + Cursor)
the emitter must reproduce from one schema. Deterministic (no clocks/randomness/env); update only via
`BLESS=1 bun test`, landing as a reviewable diff.

## Out of scope

No LLM/harness runtime, no agent EXECUTION loop, no provider SDK. The reference CLI app that drives one
lifecycle act end-to-end lives in `apps/agent-dev`; the `create-caisson` generator and registry-publish
flow are separate.
