# ADR-0076 — Buyer MCP server: extensible tool registration + edition tools in v1

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Resolves fork X-12 — whether
editions may extend the buyer MCP or it stays a generation-only RPC.)

ADR-0008's buyer MCP exposes a fixed tool set — `list_modules` / `describe_module` / `generate`
behind a hard switch (`mcp-server/server.ts:134`) — closed to extension. That leaves the
"agent-native delivery" headline (ADR-0008/ADR-0040) as a generator RPC, not a product surface: an
edition has no way to ship tools that exercise what the buyer actually bought.

## Decision

**The buyer MCP gets a tool-registration seam with per-tool entitlement gating, and every edition
ships its edition-specific buyer tools in v1.** Full extensibility now, not a deferred seam.

- A **registration seam** replaces the hard switch: tools are registered, not enumerated in one
  `switch`. Each edition owns its tool registrations and declares the entitlement each tool requires.
- **Per-tool entitlement gating** — every tool re-validates the buyer's license/entitlement
  (ADR-0008/ADR-0010, timing-safe) and is invisible/denied unless the caller is entitled to the
  edition that registered it. Same fail-closed posture as the registry read-path.
- **Editions ship buyer tools in v1:** Compliance `explain_control` (control-X rationale + evidence),
  AI-Kit `run_eval` (drive the eval harness, ADR-0062), Agent-Dev kernel introspection (inspect
  agent/skill/rule schema + lifecycle state, ADR-0065), etc. Each edition owns its tool set + its
  entitlement scoping.
- **The generation tools stay:** `list_modules` / `describe_module` / `generate` remain base tools;
  `generate` keeps its credit re-check (402, ADR-0007). Edition tools are additive to this base.
- The MCP becomes a genuine **agent-native product surface** — ADR-0008's headline differentiator
  realized — not just a generator transport.

This **extends ADR-0008** (buyer MCP, generation-only) to a product surface; ADR-0008's auth model
(Bearer/license-scoped, timing-safe, entitlement-filtered) stands unchanged and now governs the
edition tools too.

## Rejected

- **Frozen to generation in v1, seam deferred** — keeps the MCP a generator RPC and leaves the
  agent-native headline unrealized; re-opening a closed `switch` to a registration model later is a
  bigger structural change than building the seam once now. Reject.
- **Seam now, but no edition tools in v1** — lands the registration mechanism but ships zero edition
  tools, so the surface is extensible on paper only. The operator chose to ship edition tools in v1
  for the maximal agent-native story, accepting the cost: more surface to build, gate, and test up
  front.

## Binding

The buyer MCP exposes a tool-registration seam, not a fixed switch; every registered tool declares
and re-validates (timing-safe) the entitlement it requires, and no tool — base or edition — returns
data the caller is not entitled to; each edition owns its tool registrations and their entitlement
scoping; the generation tools (`list_modules`/`describe_module`/`generate`, credit-gated) remain.
Edition buyer tools are commercial product surface — gated by the same entitlement layer as the
modules they expose, under ADR-0023's fully-commercial model (and ADR-0050, which made Local-first
AI commercial too). Evidence: ADR-0008 (buyer MCP, auth-gated; `mcp-server/server.ts:134` hard
switch + the `registryAllowlist` reject-before-side-effect pattern, ADR-0021); ADR-0010 (Ed25519
offline entitlements/license); ADR-0007 (credit re-check on generate); ADR-0062 (ai-kit eval
harness) + ADR-0065 (base agent kernel); ADR-0023/ADR-0050 (fully-commercial);
`outputs/research/wave1-forks.md` X-12.
