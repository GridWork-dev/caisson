# ADR-0210 — mcp-server: declarative tool manifest + retired-tool ledger

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope lock).
**Relates:** ADR-0133 (clean-lift: MCP manifest + ledger), ADR-0112 (MCP rate-limit — untouched),
ADR-0161 (MCP HTTP transport).

## Context

Caisson's `packages/mcp-server` registers tools as bare `{name, requiredEntitlement, handler}` at runtime.
gridwork-core's harvestable pattern is the _governance_ shape — a declarative, schema-validated per-item
manifest plus a retirement ledger that prevents silent zombie references. Role asymmetry noted at
reconcile: gridwork-core's manifest governs which external servers an operator _consumes_; Caisson _is_
the server exposing tools to buyers — so the pattern transfers, a literal port does not.

## Decision

1. **Declarative tool manifest:** `ToolRegistration` extends with Zod-validated per-tool metadata
   (description, version, audit metadata). Additive to one interface; no auth/entitlement logic touched.
2. **Retired-tool ledger:** an append-only retired list checked in `handleToolCall` before the
   NotFoundError throw — a deliberately-deprecated tool answers with a distinct 410-Gone-style error and
   reason; a never-existed tool stays 404. Deprecation becomes an explicit, auditable state instead of a
   silent removal.

## Rejected

- **Port gridwork-core's consumed-server manifest literally** — wrong direction; the buyer-facing server
  needs per-tool governance, not a roster of upstream servers.
- **Fold retirement into entitlement logic** — retirement is a lifecycle fact, not a permission; mixing
  them would make a revoked entitlement indistinguishable from a retired tool.
