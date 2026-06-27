# ADR-0008 — Buyer-facing MCP server, auth-gated

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

Every base + edition ships an **MCP server (with auth)** so the buyer's AI coding agent
(Claude Code / Cursor) can query the shipped codebase's conventions, modules, and tools — and
drive `create-stack` generation (ADR-0004). This is both a product feature and a market-validated
value-add (MakerKit/LaunchKit ship MCP servers; ours adds auth + the generation hook).

Auth is **license/Bearer-scoped** and **timing-safe** (`crypto.timingSafeEqual`, ADR-0002): the
MCP server validates the buyer's license/registry token on every request and exposes only the
modules that buyer is entitled to (the entitlement check, ADR-0010). Read-mostly over codebase
conventions; the one write-capable surface (drive a generation) re-checks credits (ADR-0007).

Rejected: an unauthenticated MCP server (leaks paid modules + lets anyone meter generations).
Bundling no MCP (forfeits the agent-native delivery that is core to the "AI production codebase"
positioning).

Binding: no MCP tool returns a module the caller isn't entitled to; every request re-validates
the license token in constant time.
