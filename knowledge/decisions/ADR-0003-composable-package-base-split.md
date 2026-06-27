# ADR-0003 — Composable capability packages; editions are compositions

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

The base is **decomposed into independent capability packages** — `auth`, `tenancy-rls`,
`billing`, `credits`, `ai-config`, `mcp-server`, `ui`, `jobs`, `email` (+ `kernel`) — each
built to the `tooling/` standard (ADR-0002) and **independently sellable**. An **edition**
(`compliance`, `ai-kit`, `local-ai`, `agent-dev`) is a **composition**: it depends on a curated
set of base packages and adds its vertical logic. Buying an edition = a curated package set;
buying à-la-carte = any single package.

This is the foundation of Option C (Gate 3) and the only structure that satisfies all three
locked requirements at once: a generic-competitive base, per-module commerce, and clean
four-edition composition without duplication.

Rejected: a monolithic `core` package (Option A) — forecloses per-module sales and bloats the
base. Forking per edition — duplicates the base N times, breaks the one-standard goal.

Binding: an edition never copies base code — it depends on the package. A package never
depends "up" on an edition. Cross-cutting concerns live in base packages, not edition packages.
