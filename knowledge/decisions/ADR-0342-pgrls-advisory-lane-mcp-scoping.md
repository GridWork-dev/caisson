# ADR-0342 — pgrls: advisory CI lane over the real migration composition; MCP wiring deferred to the gw-core manifest lane

Status: accepted · 2026-07-13 (Kickoff T platform session, tasks 9–10)

pgrls (github.com/pgrls/pgrls, PyPI, MIT) lints live Postgres RLS policies and proves tenant
isolation with Z3 (`lint` / `verify --mode {anon,cross-tenant,write}` / `diff`). It is BETA,
single-maintainer, created 2026-04 — high-value fit for caisson's tenancy-rls threat model, zero
mileage, zero trust earned.

## Decision

1. **Advisory CI lane** (`.github/workflows/pgrls-advisory.yml`): ephemeral postgres:17 service
   container migrated by **the same script Railway's preDeployCommand runs**
   (`bun apps/site/lib/deploy-migrate.ts` — the composed platform chain + site extras), so pgrls
   always grades the real shipped schema, never a CI-only stand-in. pgrls 0.48.2 pinned via uv.
   lint (SARIF+JSON) + verify in all three modes; `diff` skipped until a committed snapshot
   baseline exists. Weekly + dispatch + PR-on-migration-paths triggers. **Never blocks; never
   cited in customer evidence packs** until it earns trust (the kickoff's own gate). Ramp: after
   a triaged release cycle, promote lint/verify to blocking.
2. **MCP wiring is DEFERRED, and routes through gw-core when it happens.** The kickoff's
   preference (gw-core manifest + roster row, per the MCP-scoping review) is CONFIRMED as the
   lane — a project-scoped `.mcp.json` is rejected because an MCP server is an agent-facing
   trust surface and the gw-core roster (`identity/mcps.md` + `system/mcps/*.toml`) is the single
   audited registry for those; a repo-local registration would be the first invisible-to-roster
   MCP on the box. AND the wiring itself waits: `pgrls mcp` is part of an unaudited beta package
   from a single external maintainer — it earns the roster row the same way its CI lane earns
   gate status. Dependency recorded for the gw-core session: manifest + roster row + this ADR's
   trust gate, once the advisory lane has a triaged cycle behind it.

## Consequences

The agent loop does NOT get in-session RLS verification yet — `bun run` of the same pgrls CLI
against a local DB is the interim manual path. First real CI run's artifacts need an eyeball
(the SARIF/JSON shapes were doc-verified, not run-verified — no live container in the authoring
sandbox).
