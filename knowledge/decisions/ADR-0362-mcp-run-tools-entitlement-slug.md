# ADR-0362 — MCP run tools gate on a dedicated module entitlement slug

- **Date:** 2026-07-18
- **Status:** Accepted (operator-locked)
- **Parent:** ADR-0360 (CAISSON-111 slice DAG) · `SPEC-caisson-111-loop-slices.md` §8 item 1
  (the one PLAN-gate item deliberately left open) · precedent ADR-0345 (the ds-doctor
  dedicated doctor entitlement slug)

## Context

Slice S5 (exposure + publish, the DAG's last slice) ships the MCP `run_start`/`run_status`
tools via the registerTool seam and then publishes the runtime's bundle membership +
pricing. The parent SPEC named — and deliberately did not lock — which entitlement slug
gates those tools: the Agentic-Dev bundle's fold slug, or a dedicated slug per the
ds-doctor decoupling precedent (ADR-0345, which gave the doctor tool its own slug so tool
gating stayed independent of bundle composition). `@caisson/agent-trajectory` and
`@caisson/agent-usage` already hold module ids in the registry ledger (the reserved-id /
first-consume convention), so a dedicated gate has an id family to sit on.

The other three §8 PLAN-gate items resolved as-built in earlier slices: the S2b package
name/adapter home landed as `@caisson/agent-usage` (PR #271), and the `caisson run
approve` transport went direct service/DB call in S3 (PR #272).

## Decision

**Dedicated slug.** `run_start`/`run_status` gate on the runtime module's OWN entitlement
id (the agent-trajectory slug family already in the ledger) — never on the Agentic-Dev
bundle slug. Bundles compose the module in as a member (Agentic-Dev today, any future
bundle the same way); a bundle purchase grants the module entitlement through the normal
bundle-expansion path, and the tool gate never has to know which bundle the grant came
from.

## Consequences

- The S5 PLAN binds MCP tool gating to the module slug; the entitlement check at the tool
  seam is module-scoped, mirroring ds-doctor (ADR-0345).
- Reselling the runtime in another bundle later is pure composition — no regating
  migration, no tool-seam change.
- One more catalog id than the fold option — accepted; it is the id the ledger already
  reserves.
