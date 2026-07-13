# ADR-0330 — Agent-ready DS surface: re-cut v1 + local stdio-only discovery MCP

Status: accepted · 2026-07-13 (product-SPEC design session + adversarial audit round + operator
re-lock, same day. Locks the forks of `outputs/specs/agent-ready-ds-surface/SPEC.md`.)

The agent-ready design-system surface (Astryx-pattern: manifest + CLI + MCP + doctor for
`@caisson/ui`) had its six forks locked in the 2026-07-13 design session, then challenged by an
18-lane red-team + a Codex `gpt-5.6-sol` adversarial review (CR-08/CR-09/WR-04/WR-10): the
both-servers + discovery-free locks forced a NEW unauthenticated public MCP against the security
floor (the existing buyer MCP transport is fail-closed pre-auth), the runtime-a11y doctor
contradicted the SPEC's own no-browser buyer story (jsdom cannot run the contrast check; no
renderer has an owner), and the CLI lock targeted `packages/cli` — the Apache-2.0, credit-metered
`create-caisson` scaffold, not a buyer CLI. The operator re-locked the same day.

## Decision

**v1 is re-cut to:** (1) a committed component manifest emitted by an own build-time generator
(sibling of `gen-tokens-css.ts`; TS prop types are the variant source — `data-*` attributes cover
only 28 of the 38 components); (2) deterministic CLI `describe --json`; (3) a STATIC doctor
(imports, version skew, token misuse, variant validity, the contrast-gate logic reused as a
library); (4) AUTHED MCP tools registered into the existing entitlement-gated
`packages/mcp-server` (ADR-0216 `registerTool`); (5) an open **LOCAL stdio-only discovery MCP**
for Apache-base discovery — no hosted unauthenticated HTTP surface exists anywhere in this
feature. Runtime axe/a11y checking is a later increment gated on the Storybook 10.5 trial
outcome. The buyer-CLI packaging boundary (extend `packages/cli` vs a new bin vs open thin
client) is REOPENED and resolves at PLAN. The SPEC carries the `security` tag — its own
condition (commercial-gated tooling + a new server surface) fired.

Fork record (supersedes the challenged same-day locks): A = no new hosted server (authed tools in
the buyer MCP + the local stdio discovery server) · B = own build-time generator, Storybook
`componentsManifest` merged later only if the trial sticks · C = one data layer, both fronts, but
v1 ships manifest + CLI describe + static doctor + authed MCP tools · D = discovery free
(committed manifest + stdio server), doctor gated — the ADR-0094 open-core line · E = static v1,
runtime axe behind the Storybook-trial gate · F = reopened → PLAN.

## Rejected

- **Open unauthenticated HTTP MCP** (the original A/D combination) — violates the
  `identity/security.md` route-auth floor and duplicates a second hosted server to maintain; the
  committed manifest + stdio server serves free discovery with no hosted surface (CR-09).
- **Runtime axe in v1** (original E lock) — needs a renderer in the buyer's environment that no
  v1 component owns; contradicts the no-browser buyer story (CR-08 lane + Claude lane converged).
- **`caisson ui doctor` via `packages/cli` as locked** — the package is Apache-2.0 and exposes
  only the `create-caisson` bin; shipping gated doctor logic there either gives it away or hides a
  remote-service dependency (CR-08). Boundary resolves at PLAN with three recorded options.

## Binding

The v1 agent-ready DS surface is exactly the five re-cut items above; no unauthenticated hosted
MCP ships at any tier; discovery stays free (manifest + stdio) and verification stays
entitlement-gated; variants derive from TS prop types over 38 components; entitlement-negative
tests prove unentitled callers are denied on every pro-metadata tool; the SPEC carries `security`
and its PLAN resolves the buyer-CLI boundary before any bin is promised. shadcn-registry
references use `bunx` and the `owner/repo/item` resolution reality; `@caisson/ui` is described
"native-first", never "zero-dependency". Evidence: `outputs/specs/agent-ready-ds-surface/SPEC.md`
(amended 2026-07-13); `outputs/audit/AUDIT-SYNTHESIS-2026-07-13.md` §B;
`outputs/reviews/codex-adversarial-review-2026-07-13.md` CR-08/CR-09/WR-04/WR-10; ADR-0094
(open-core line); ADR-0216 (mcp-server tool manifests); ADR-0254 (agent-visibility lineage).
