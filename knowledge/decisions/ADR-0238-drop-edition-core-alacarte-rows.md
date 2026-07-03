# ADR-0238 — Drop the four edition-core à-la-carte rows (11-module catalog)

**Status:** accepted · 2026-07-03 (site-rework session, three-round operator picker). Resolves the
ADR-0237 F5 name-collision lock by REMOVAL instead of rename: the four à-la-carte module rows whose
ids named their own parent edition — `compliance` ($299) · `ai-kit` ($149) · `local-ai` ($299) ·
`agent-dev` ($99) — are dropped from the sellable catalog. **Extends ADR-0237 (F5)**; **supersedes
the ADR-0227 clause that keeps all 14 per-module SANDBOX products sellable** (the 11 standalone
module products remain; no price NUMBER changes anywhere). Type chips on every price surface (the
second half of F5) are unaffected and still ship. Append-only; supersede with a later ADR, never
edit. **Tags:** `billing`.

## Context — why rename collapsed into removal

The picker ran three rounds against build-time evidence:

1. **Round 1 (rename scope + grant semantics):** recon showed the collision is commerce-layer only —
   the registry holds exactly one `@caisson/compliance` / `@caisson/ai-kit`, both `kind: "edition"`;
   the colliding MODULE rows are marketing constructs in `apps/site/lib/pricing.ts` whose pricebook
   rows (`packages/pricebook/src/purchases.ts`) carry the EDITION id as their entitlement. Because
   `expandEntitlements` (`packages/registry-schema/src/entitlements.ts`) resolves edition-first, a
   module purchase granted the WHOLE parent edition ($299 module ⇒ $799 edition + its Discord role
   via the support-bot's verbatim-id role push). The collision also covered `local-ai`/`agent-dev`
   (the registry edition ids), not just the two ADR-0237 named — the operator locked "rename all
   four" + "grant the edition core package only." (ADR-0237's citation of the ADR-0216 retirement
   ledger as the registry mechanism was a misattribution — that ledger is mcp-server tool-names
   only; no registry-layer change was ever needed.)
2. **Round 2 (infeasibility):** the "core package only" grant is uninstallable. Every edition
   meta-package hard-depends on its commercial members (`@caisson/compliance` →
   field-crypto/audit-worm/retention-runner/alerting; likewise ai-kit/local-ai/agent-dev) — a buyer
   whose registry view holds only the core package fails mid-`bun install`. There is no separable
   "core" artifact; the closest feasible variant (core + transitive commercial deps) collapses to
   the whole edition for compliance and leaks cross-edition packages elsewhere.
3. **Round 3 (lock):** with rename-and-grant infeasible and whole-edition grants rejected as a
   $299-buys-$799 coherence hole, the operator locked **drop the rows**.

## Decision

- `apps/site/lib/pricing.ts` `MODULE_PRICES` loses the four rows → **11 standalone à-la-carte
  modules** (field-crypto · audit-worm · retention-runner · ai-meter · ai-evals · guardrails ·
  prompt-registry · alerting · local-store · agent-kernel · agent-runner). Editions are how
  composition is bought.
- `apps/site/lib/catalog.ts` `MODULE_PRICE_IDS` and the pricebook PLACEHOLDER + REAL rows for the
  four SKUs are removed; their sandbox price ids (`pri_01kwj6m31f…`, `pri_01kwj6m55y…`,
  `pri_01kwj6m5mz…`, `pri_01kwj6m6cb…`) now fail `resolvePurchase` closed. The four Paddle SANDBOX
  products sit orphaned — sandbox never ports to production (ADR-0227), so no Paddle-side action is
  required before the commerce flip.
- **Collision lint:** `catalog.test.ts` + `pricing.test.ts` + `purchases.test.ts` gain data-lints
  asserting no module id / module-row entitlement names an edition id (site slugs AND the registry
  edition ids `local-ai`/`agent-dev`) — the bug class cannot silently return.
- **Untouched:** `expandEntitlements` and the whole license/entitlement mechanism; edition ids,
  prices, and includes copy; kind-namespaced cart ids (kept as containment hygiene);
  `member_mgmt.py` (module purchases can no longer carry edition ids); the registry, worker,
  revocation list, mirror/oss export, and generator.

## Consequences

- Cart/StackBuilder/SkuMatrix/JSON-LD surfaces are data-driven and follow automatically; copy
  counts ("15 modules") sweep to 11 in the same change; the wave-2 copy rewrite inherits the
  11-module story.
- The compliance edition's à-la-carte sum ($547) now sits BELOW its $799 edition price, so the
  /build configurator no longer nudges a full-compliance selection to the edition — expected: the
  edition sells composition + the core runtime the modules alone don't include.
- `docs/state/package-catalog.md` §2b updated (11 rows + drop rationale; stale $749/harvest-pending
  cells corrected to the ADR-0227/Stage-2 facts in passing).
- Pre-launch there are no live grants to migrate (`entitlement-store.ts` confirms); a sandbox
  webhook re-delivery for a retired price id fails closed and Paddle retries against a mapped-row
  set that no longer includes it — acceptable, sandbox-only.
