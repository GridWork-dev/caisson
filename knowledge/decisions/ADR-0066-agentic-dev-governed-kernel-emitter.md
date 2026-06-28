# ADR-0066 — Agentic-Dev: governed TS kernel + engine-neutral multi-harness emitter

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Defines the P4b agent-dev
deliverable on top of the `@caisson/agent-kernel` base package from ADR-0065.)

The agent-dev edition is scaffold-only and its product spine was undecided: a governed runtime, a
thin wrapper over an existing agent framework, or a config-bundle generator — and orthogonally,
whether it is coupled to Claude Code or neutral across harnesses. This ADR locks both.

## Decision

The agent-dev edition is a **governed TS kernel PLUS a thin multi-harness emitter**, composed over
the base `@caisson/agent-kernel` (ADR-0065) — it consumes that package's schema, lifecycle FSM, and
hooks dispatcher and adds the edition's curated content, the governance runtime, and the emitter.

- **Governed kernel = the moat (governance-by-architecture).** Deterministic policy/guards over agent
  actions + a lifecycle FSM, with each governed step recorded as a **tamper-evident record of what an
  agent did** by reusing the existing compliance substrate — `kernel/audit-chain.ts` (SHA-256 hash
  chain) + append-only `versioning.ts`. This is on-brand with the compliance _hero_ and is the one
  thing the commodity TS-agent-framework race does not ship.
- **The kernel is ENGINE-NEUTRAL (binding).** It **governs, validates, and records**; it does **not**
  run the LLM and is **not** coupled to any single agent harness. No `.claude/`-specific assumption,
  no hard import of a vendor SDK, in the kernel core. Consistent with the provider-agnostic ethos
  (ADR-0011) and the no-framework-import package rule (ADR-0044).
- **Thin multi-harness emitter.** From **one typed Caisson schema** the emitter generates config
  bundles for whatever harness the buyer runs: `.claude/` (agents/skills/rules + hooks) for Claude
  Code, `AGENTS.md` for Codex, Cursor rules, and so on. **Author once in Caisson's schema → emit for
  the buyer's tool.** Claude Code is a first-class emit target (persona B4), one of several — not the
  substrate.
- TypeScript-strict, Bun runtime/PM, Zod `.strict()` at the schema boundary (ADR-0002). Ships
  `LicenseRef-Caisson-Commercial` — uniformly commercial, since ADR-0050 closed the local-ai AGPL
  flank, so no copyleft path reaches the kernel or emitter.

## Rejected

- **Thin wrapper over the Claude Agent SDK / Mastra / LangGraph.js** — fastest to a demo but
  commoditized: a thin moat, vendor lock-in, and a direct contradiction of the rebuild-clean ethos.
  The governed kernel + audit substrate is precisely what a wrapper cannot offer.
- **Config-bundle generator ONLY (the `.claude/` emitter on its own)** — it is codegen, not a runtime;
  it drops the governance/audit moat entirely and overlaps the P5 `create-caisson` generator. Kept as
  the emitter _half_, never the whole deliverable.
- **Claude-Code-coupled kernel** — reusing gridwork-core's hook taxonomy + `.claude/` layout verbatim
  is fastest, but narrows the buyer market and contradicts the provider-agnostic ethos. The operator
  requires the kernel usable from Codex / Cursor / any harness, with Claude Code as one emit target.

## Binding

The agent-dev edition is a governed, engine-neutral TS kernel (deterministic policy/guards + lifecycle
FSM whose steps are recorded into the ADR-0065/kernel audit-chain + versioning as a tamper-evident
record) plus a thin emitter that renders one typed Caisson schema into per-harness config bundles; the
kernel core MUST NOT run the LLM, hard-import a vendor SDK, or assume any single harness, and no
harness (Claude Code included) may become the substrate rather than an emit target. Future agent-dev
code and agents may not re-couple the kernel to one engine without superseding this ADR. Evidence:
ADR-0065 (`@caisson/agent-kernel` base package this consumes), ADR-0011 (provider-agnostic config),
ADR-0044 (packages stay framework-agnostic), ADR-0002 (TS-strict/Bun/Zod invariants), ADR-0023 +
ADR-0050 (uniform fully-commercial, AGPL flank closed); `kernel/src/{audit-chain,versioning}.ts`
substrate; research artifact `outputs/research/wave1-forks.md` (P4b-1 spine, P4b-4 engine coupling).
