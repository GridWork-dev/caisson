# ADR-0094 — Open-core Base (Apache-2); editions + primitives + generator stay commercial

Status: accepted · 2026-06-29 (operator lock, GTM-report picker round) · **amends the
fully-commercial-everywhere stance** of ADR-0023 / ADR-0050 / ADR-0083 **for the BASE tier only**.
Composes on ADR-0003 (composable packages), ADR-0022 (boundary enforcement), specs/00 (Base =
table-stakes framed under differentiators).

## Context

Both 2026-06-29 Perplexity Computer reports (`outputs/research/{gtm-customer-acquisition,
market-competitive-analysis}.md`) repeatedly recommend **open-sourcing the non-differentiating Base
as a trust + acquisition layer** ("use Base as the trust and acquisition layer… unless it is
open-core"; rec #4 "open-source non-differentiating Base; commercialize premium modules"). The cross-
analysis (`gtm-market-analysis-2026-06.md` C1) flagged this as the strongest repeated external rec
against a hard lock. ADR-0083 had killed all open/AGPL flanks for licensing **uniformity** — a
decision about the Local-first _edition_ flank, not about Base-tier trust/discovery. specs/00 already
frames Base as **table-stakes, framed under differentiators** — it is explicitly not the moat.

The operator reopened the fork and chose open-core (picker, 2026-06-29).

## Decision

**The Base substrate is licensed Apache-2.0 (permissive open-core). The editions, the compliance
primitives, the generator, the registry, and all update subscriptions stay commercial.**

**OPEN (Apache-2.0):** `kernel`, `auth`, `tenancy-rls`, `ui`, `billing`, `credits`, `jobs`, `email`,
`ai-config`, `mcp-server` — the base substrate.

**COMMERCIAL (`LicenseRef-Caisson-Commercial`):** the four editions (`compliance`, `ai-kit`,
`local-ai`, `agent-dev` + their member packages: `audit-worm`, `ai-meter`, `ai-evals`,
`prompt-registry`, `guardrails`, `local-store`, `agent-kernel`, `license-verify`), the **compliance
primitive** `field-crypto`, the `create-caisson` generator (`cli`), the `registry`, and every update
subscription.

- **Apache-2.0, not MIT** — the patent grant matters for a compliance/security product.
- `field-crypto` + `audit-worm` are deliberately **commercial** even though they sit low in the graph:
  they are the differentiating compliance primitives (per-tenant HKDF crypto, WORM hash-chain), not
  table-stakes. The open Base depends only on the open set.
- The **monetization fence stays intact**: editions/primitives/generator/registry/updates are the
  product; the open Base is the discovery + trust layer. OSS-undercut is low-risk — Base alone has no
  compliance/AI/evidence value, the **Caisson** name is trademark-locked (ADR-0041), and the
  positioning is "the expert reference implementation agents extend."
- The `mcp-server` base package (auth-gated buyer-MCP transport skeleton) is open; the **commercial
  value it gates** — the `generate` tool driving `runGeneration`, entitlement expansion, the registry
  — stays commercial. Open transport, commercial product behind it.

**Implementation is scheduled as its own PR + verify** (operator picker): the `standards-gate` (which
currently _enforces_ `LicenseRef-Caisson-Commercial` on every module) must be changed to allow
Apache-2.0 on the open-base set and enforce the open↔commercial boundary (an open package may not
depend "up" on a commercial one); 10 base `manifest.ts` + `package.json` `license` fields → `Apache-2.0`;
Apache-2.0 `LICENSE` files added; `apps/site` licensing copy updated. Tracked as work item **W1** in
`docs/state/readiness-and-backlog.md`.

## Rejected

- **Source-available Base (BSL/FSL/Elastic-style)** — BSL exists to stop _cloud resellers_ of a hosted
  product; Caisson sells code, not hosting, so the threat BSL solves does not apply, and BSL adds
  developer skepticism + no real OSS/GitHub trust halo. (Reports' competitor set: Sentry/HashiCorp/
  Elastic use BSL precisely because they sell hosting.)
- **Keep fully-commercial (reaffirm ADR-0083 everywhere)** — highest acquisition friction, no OSS
  discovery, exposed to free-boilerplate undercut (ShipFast/t3 free). The reports rate the open-core
  acquisition lever as the higher-value path for a non-differentiating Base.
- **MIT** — rejected in favor of Apache-2.0 for the explicit patent grant.

## Binding

- Base substrate (the 10 packages above) ships `Apache-2.0`; everything else stays
  `LicenseRef-Caisson-Commercial`. The standards-gate enforces this split + the no-depend-up boundary.
- ADR-0023 / ADR-0050 / ADR-0083 remain in force for the **edition** tier (all four editions
  commercial; no free/AGPL edition flank). This ADR narrows "fully-commercial **everywhere**" to
  "fully-commercial **editions + primitives + generator + registry + updates**" — Base is now open.
- The pro-private firewall (ADR-0003 / CLAUDE.md) is unaffected: nothing from `media-pipeline` seeds
  any package, open or commercial.
- A free evaluation artifact built on the open Base is permitted + planned (ADR-0095).

Evidence: `outputs/research/gtm-market-analysis-2026-06.md` §3 C1 + Fork register; specs/00 (Base =
table-stakes); `tooling/standards-gate` (the license check to amend); the operator picker (2026-06-29).
