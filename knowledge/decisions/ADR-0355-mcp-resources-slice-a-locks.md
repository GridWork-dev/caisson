# ADR-0355 — MCP interop slice A: resources surface GO, prompts deferred

Status: accepted · 2026-07-17 (Kickoff-U Lane 4, CAISSON-117, PR #247; go/no-go research ran
first, operator locked GO at the 2026-07-17 picker; filed at the reconcile sitting per the
ADR-0328 wave convention. Extends ADR-0076/0216 (tool registry/manifest) and ADR-0161.)

## Decision

1. **GO on a readable resources surface for `@caisson/mcp-server`**, scoped to candidates
   (c) design-system + (a) registry-index. **Prompts are DEFERRED to a follow-up phase — no
   scaffolding added.**
2. **The resource registry mirrors the tool registry** (ADR-0076/0216): registration-time
   manifest validation (`resourceManifestSchema`), duplicate-URI fail-closed, entitlement scoping
   through the same constant-time `isEntitled` gate, the ADR-0112 `checkRateLimit` hook on reads,
   and the invisible-not-found contract extended to resources — unregistered URI ≡ unentitled
   URI ≡ `not_found`, checked pre-throttle.
3. **Transport wiring is deliberately duplicated** across `stdio.ts` and `http.ts`
   (`resources/list` + `resources/read`, `capabilities.resources`) per the ADR-0161
   zero-cross-file-coupling policy. URI scheme: `caisson://<namespace>/<name>`.
4. **`caisson://registry/index` serves the FULL catalog** to any authenticated bearer (null
   entitlement) — operator lock. Prices/tiers are already public marketing data on the site; the
   Bearer gate still fronts everything, and this closes the real discovery gap (agents could
   previously learn the catalog only via failed `generate` errors). Design-system resources
   (`components`/`tokens` authenticated; `pro-components` behind `@caisson/ui-pro`, invisible
   otherwise) are a second front over the SAME pure functions the tools use — one data layer, two
   fronts.

## Rejected / deferred

- **Prompts in this slice** — operator lock: follow-up phase.
- **Resources on `discovery-stdio.ts`** — the unauthenticated discovery server has no index and
  no entitlement dimension; a resources front there duplicates its tools with no new capability.
- **`apps/base` `mcpQuery` resource pass-through** — out of locked scope; the transports are the
  buyer surface.
