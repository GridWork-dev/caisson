# ADR-0345 — DS surface Fork F: doctor rides the open CLI as a thin authed client of the buyer MCP

Status: accepted · 2026-07-13 (operator picker round over `outputs/plans/agent-ready-ds-surface/PLAN.md` Fork F; closes the fork ADR-0330 reopened to PLAN)

## Decision

**Option (a).** `describe --json` (free, already locked) and `doctor` both live in the Apache-2.0
`@caisson/cli` as a second `caisson` bin — `doctor` is a THIN CLIENT calling the buyer-MCP
`check_usage` tool. The doctor's static-check logic is Apache source in
`@caisson/ds-manifest`/`packages/mcp-server`, gated at the MCP tool by **runtime entitlement**
enforced by the buyer MCP — exactly the shipped coach.ts pattern (accepted open-core porosity;
gating is runtime, not source secrecy). This is the only option that honors locked Fork D
(ADR-0330: check_usage stays entitlement-gated) without a new commercial package.

Riders (part of this lock):

- **v1 doctor transport is LOCAL STDIO** — the buyer runs the already-credentialed
  `@caisson/mcp-server` with their buyer token; no hosted HTTP buyer MCP exists or is promised.
- **A DEDICATED doctor/verify entitlement slug** gates `check_usage` (not an edition slug), so
  the doctor capability can be sold/granted independently of any component edition.
- CR-08's objections are resolved by construction: the open CLI carries no gated logic, and the
  remote dependency is the documented buyer MCP the buyer already configures.
