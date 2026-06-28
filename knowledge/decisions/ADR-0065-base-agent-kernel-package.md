# ADR-0065 — New base package @caisson/agent-kernel

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Extracts the agent
schema/FSM/hooks into a base package so base + edition can both consume it down-only.)

The agent/skill/rule schema, the lifecycle finite-state-machine, and the hooks dispatcher are needed
by **both** the agent-dev edition AND the base `cli` / `mcp-server` packages. Placed inside the
edition, any base→edition import fails the down-only gate (ADR-0022 Gate-3) — so the shared layer has
to live below the edition line.

## Decision

**A new base package `@caisson/agent-kernel`** owns the agent/skill/rule schema, the lifecycle FSM,
and the hooks dispatcher. The structural split is **forced by ADR-0022 Gate-3 (down-only)**: a base
package may not depend on an edition, so the shared agent layer must sit at base level where every
consumer reaches it downward.

- **`kind: base`**, consumable by both `cli` + `mcp-server` (base→base, legal) and by the agent-dev
  edition (edition→base, legal). No consumer ever imports "up" into an edition.
- **The agent-dev edition becomes a composition**, not a home for primitives: `agent-kernel` +
  curated agents/skills/rules **content** + a reference app. The edition contributes content and
  wiring; the kernel contributes the schema/FSM/hooks **mechanism**.
- TypeScript-strict, Bun runtime/PM, Zod `.strict()` at the schema boundary (ADR-0002). Ships under
  `LicenseRef-Caisson-Commercial` — base packages are fully commercial (ADR-0023); the former AGPL
  flank is closed now that ADR-0050 makes local-ai commercial too, so there is no AGPL contamination
  path into the kernel.

## Rejected

- **Everything inside the agent-dev edition** — the moment `cli` or `mcp-server` import the schema/
  FSM/hooks it is a base→edition edge; the down-only gate (ADR-0022 Gate-3, enforced in CI by the Bun
  standards-gate + dependency-cruiser) **fails the build**. Non-starter.
- **Fold into `@caisson/kernel`** — bloats the universal kernel with agent-specific schema, an
  agent-lifecycle FSM, and a hooks dispatcher that **every** base package would then transitively
  carry, whether or not it touches agents. The universal kernel stays minimal; agent concerns get
  their own base package.

## Binding

The agent/skill/rule schema, lifecycle FSM, and hooks dispatcher live in `@caisson/agent-kernel`
(`kind: base`); no base package may import an edition (ADR-0022 Gate-3), and the agent-dev edition is
a composition over this kernel (kernel + content + reference app), never the owner of the primitives.
Future agent-facing base consumers (cli, mcp-server) depend on `agent-kernel`, not on agent-dev.
Evidence: ADR-0022 Gate-3 (down-only base→edition CI gate); ADR-0003 (composable packages, no
upward/edition→edition deps); ADR-0023 + ADR-0050 (fully-commercial, AGPL flank closed);
`outputs/research/wave1-forks.md`.
