# ADR-0010 — Licensing, entitlements, and the open-core boundary

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

- **Entitlement model:** a purchase/subscription grants `entitlement` rows (edition | module |
  bundle | subscription); a buyer's **license** is an **Ed25519 offline-verifiable token**
  (← tessera's license kit — the **public** copy; the identical kit in pro-private `media-pipeline`
  is NOT used) carrying entitlements + tier + expiry, revocable via the issuer (`services/license`).
- **Open-core boundary:** the **Local-first AI edition core is AGPL** (community/distribution
  flank — tessera is already public AGPL); its license kit + hosted-inference/GPU credits + pro
  modules are paid. The Base has a free/OSS core with paid pro modules. **Compliance, AI
  Production Kit, and Agentic-Dev are paid** (commercial license).
- **Offline-first verification:** licenses verify without phone-home (Ed25519), **fail-safe-to-free**
  for OSS tiers; the MCP server (ADR-0008) gates paid modules on the same entitlement check.

**Pro-private firewall (binding, repo-wide):** nothing from `media-pipeline` (workers/ license
issuer, terraform, skills, emails, marketing, internal docs, config.yaml, models) seeds any
package — **patterns/ideas only, never implementation**. The harvestable license kit is taken
from public `tessera`.

Rejected: an online-only license check (breaks local-first + adds a failure mode). A single global
license (no per-module/edition entitlement → no à-la-carte commerce). AGPL on paid editions
(would force buyers to open-source their products).

Binding: every paid module checks entitlement before it loads; AGPL code never imports into a
commercial-licensed package; the firewall is asserted in review.
